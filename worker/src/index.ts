/**
 * telemedmuk-save-snapshot Cloudflare Worker
 * ============================================================================
 * Purpose: take the place of the browser-side "paste a GitHub Personal
 * Access Token" flow that used to live in src/components/ImportExcelTab.tsx.
 * The frontend now POSTs the uploaded Hippo export (as base64) to this
 * Worker, and the Worker — which holds the real GitHub write token as a
 * Cloudflare secret that never reaches the browser — performs the commit to
 * data/raw/ on the `main` branch via the GitHub Contents API.
 *
 * Route: POST /save-snapshot (any other path/method receives 404/405; see
 * below). The frontend (src/components/ImportExcelTab.tsx) must POST to
 * exactly this path on whatever *.workers.dev (or custom domain) URL this
 * Worker is deployed to, configured via VITE_SAVE_WORKER_URL.
 *
 * Request body (application/json):
 *   { "filename": string, "contentBase64": string }
 *
 * Response body (application/json):
 *   Success: { "ok": true, "actionsUrl": "https://github.com/thering999/telemedmuk/actions" }
 *   Failure: { "ok": false, "error": string }
 *
 * Security model — IMPORTANT, read before changing anything here:
 *   - `X-App-Key` (checked against env.APP_SHARED_KEY) is a *basic abuse
 *     deterrent only*. It ships inside the public frontend JS bundle that
 *     anyone can view in their browser's dev tools, so it is NOT a real
 *     secret and NOT a real access-control boundary — anyone who reads the
 *     deployed bundle can extract it and call this endpoint directly.
 *   - The actual security boundary is that `env.GITHUB_TOKEN` (the real
 *     GitHub write credential) lives ONLY as a Cloudflare Worker secret on
 *     the server side and is never sent to, stored in, or reachable from the
 *     browser. Even if someone extracts the app key and spams this endpoint,
 *     the blast radius is limited to "can commit Hippo-shaped filenames to
 *     data/raw/ on this one repo" — they can never obtain the GitHub token
 *     itself.
 */

export interface Env {
  GITHUB_TOKEN: string
  APP_SHARED_KEY: string
}

const GITHUB_OWNER = 'thering999'
const GITHUB_REPO = 'telemedmuk'
const GITHUB_BRANCH = 'main'

// Exact same pattern as src/lib/parseHippoExcel.ts's FILENAME_PATTERN. Keep
// these in sync if the upstream pattern ever changes. The trailing
// " (N)" / "(N)" is the suffix browsers add to a re-downloaded file that
// already exists in the Downloads folder (e.g. Chrome's "file (1).xlsx") —
// tolerate it so a re-saved duplicate doesn't get rejected outright.
const FILENAME_PATTERN = /^\d{4}\d{2}\d{2}_\d{2}_telemed_hosp(?:_\w+)?(?: ?\(\d+\))?\.xlsx$/i

// 10 MB cap on the *decoded* file size, to bound abuse via huge payloads.
const MAX_DECODED_BYTES = 10 * 1024 * 1024

const ALLOWED_ORIGINS = new Set([
  'https://thering999.github.io',
  'http://localhost:5173',
])

interface SaveSnapshotRequestBody {
  filename?: unknown
  contentBase64?: unknown
}

interface GitHubContentsErrorBody {
  message?: string
}

interface GitHubContentsGetResponse {
  sha?: string
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  })
}

/** Decode a base64 string to its byte length without materializing the full
 * Uint8Array twice — atob() then measuring .length is sufficient here since
 * we only need the size, and we immediately reuse the decoded bytes are not
 * needed (GitHub's API accepts the base64 string directly). */
function base64DecodedByteLength(base64: string): number {
  // Each base64 char encodes 6 bits; 4 chars -> 3 bytes, minus padding.
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

async function handleSaveSnapshot(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const appKey = request.headers.get('X-App-Key')
  if (!appKey || appKey !== env.APP_SHARED_KEY) {
    return jsonResponse(
      { ok: false, error: 'Unauthorized: missing or invalid X-App-Key header' },
      401,
      origin,
    )
  }

  let body: SaveSnapshotRequestBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, origin)
  }

  const { filename, contentBase64 } = body
  if (typeof filename !== 'string' || filename.length === 0) {
    return jsonResponse({ ok: false, error: 'Missing or invalid "filename"' }, 400, origin)
  }
  if (typeof contentBase64 !== 'string' || contentBase64.length === 0) {
    return jsonResponse({ ok: false, error: 'Missing or invalid "contentBase64"' }, 400, origin)
  }

  // Defensive path checks even though FILENAME_PATTERN already excludes
  // these characters — belt-and-suspenders against path traversal.
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return jsonResponse({ ok: false, error: 'Invalid filename' }, 400, origin)
  }
  if (!FILENAME_PATTERN.test(filename)) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Filename does not match the expected Hippo export pattern (YYYYMMDD_PP_telemed_hosp[_suffix].xlsx)',
      },
      400,
      origin,
    )
  }

  const decodedSize = base64DecodedByteLength(contentBase64)
  if (decodedSize > MAX_DECODED_BYTES) {
    return jsonResponse({ ok: false, error: 'File is too large (max 10MB)' }, 400, origin)
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/raw/${encodeURIComponent(filename)}`
  const githubHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'telemedmuk-save-snapshot-worker',
  }

  try {
    // Step 1: look up the existing file's sha (if any) so we can update it
    // rather than fail with a conflict. 404 = brand-new file, that's fine.
    let existingSha: string | undefined
    const getResponse = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: githubHeaders,
    })
    if (getResponse.ok) {
      const getBody = (await getResponse.json()) as GitHubContentsGetResponse
      existingSha = getBody.sha
    } else if (getResponse.status !== 404) {
      const errorBody = (await getResponse.json().catch(() => ({}))) as GitHubContentsErrorBody
      return jsonResponse(
        { ok: false, error: errorBody.message ?? getResponse.statusText },
        getResponse.status,
        origin,
      )
    }

    // Step 2: create or update the file via the Contents API PUT.
    const putResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...githubHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add Hippo export ${filename} via dashboard import tab`,
        content: contentBase64,
        branch: GITHUB_BRANCH,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    })

    if (!putResponse.ok) {
      const errorBody = (await putResponse.json().catch(() => ({}))) as GitHubContentsErrorBody
      return jsonResponse(
        { ok: false, error: errorBody.message ?? putResponse.statusText },
        putResponse.status,
        origin,
      )
    }

    return jsonResponse(
      { ok: true, actionsUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions` },
      200,
      origin,
    )
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Unexpected error' },
      500,
      origin,
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (url.pathname !== '/save-snapshot') {
      return jsonResponse({ ok: false, error: 'Not found' }, 404, origin)
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405, origin)
    }

    try {
      return await handleSaveSnapshot(request, env, origin)
    } catch (err) {
      return jsonResponse(
        { ok: false, error: err instanceof Error ? err.message : 'Unexpected error' },
        500,
        origin,
      )
    }
  },
}
