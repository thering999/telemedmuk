# telemedmuk-save-snapshot Worker

This is a small Cloudflare Worker (a tiny serverless function) that lets the
dashboard's "Import Excel" tab save a Hippo export permanently to GitHub
(`data/raw/` on branch `main`) without asking the end user to ever see or
paste a GitHub token. The token lives only on Cloudflare's servers, as a
secret that this Worker reads — it is never sent to or stored in the
browser.

The instructions below assume you have never used Cloudflare before. Run
every command from inside this `worker/` folder, in order.

## One-time setup

1. **Install dependencies**

   ```
   npm install
   ```

2. **Log in to Cloudflare**

   ```
   npx wrangler login
   ```

   This opens your web browser and asks you to log in to (or create) a free
   Cloudflare account, then click "Allow" to authorize. Once you see
   "Successfully logged in" in the terminal, you can close the browser tab.

3. **Store the GitHub token as a secret**

   ```
   npx wrangler secret put GITHUB_TOKEN
   ```

   This will ask you to paste a value and press Enter. Paste a GitHub
   **fine-grained Personal Access Token** that you've created at
   https://github.com/settings/personal-access-tokens/new with:
   - Repository access: "Only select repositories" → `thering999/telemedmuk`
   - Permissions: "Contents" → "Read and write" (nothing else needed)

   The token is uploaded directly to Cloudflare and encrypted — it is never
   written to any file on your computer or committed to the repository.

4. **Choose and store the shared app key**

   ```
   npx wrangler secret put APP_SHARED_KEY
   ```

   This will ask you to paste a value. Make up any random string (for
   example, mash the keyboard, or use a password generator) and paste it
   here. Write this same value down — you will need to put it into the
   frontend's `.env` file as `VITE_APP_SHARED_KEY` later (see the root
   `.env.example`).

   Note: this key is **not** a real secret — it ends up inside the public
   website's JavaScript, so anyone could technically extract it. It only
   exists to deter random bots from hitting this endpoint. The real
   protection is that `GITHUB_TOKEN` above never leaves this Worker.

5. **Deploy the Worker**

   ```
   npx wrangler deploy
   ```

   When this finishes, it prints a URL that looks like
   `https://telemedmuk-save-snapshot.<your-subdomain>.workers.dev`. That is
   the live address of this Worker. Copy it — you will paste it into the
   frontend's `.env` file as `VITE_SAVE_WORKER_URL` (with `/save-snapshot`
   appended, e.g. `https://telemedmuk-save-snapshot.<your-subdomain>.workers.dev/save-snapshot`).

That's it — the Worker is now live. The dashboard's save button will work
once `VITE_SAVE_WORKER_URL` and `VITE_APP_SHARED_KEY` are set in the
frontend's environment and the site is rebuilt/redeployed.

## Local development (optional, for testing the Worker itself)

1. Copy `.dev.vars.example` to `.dev.vars` in this same folder and fill in
   both values (a real or test GitHub token, and any string for the app
   key). `.dev.vars` is gitignored and never committed.
2. Run:

   ```
   npm run dev
   ```

3. Wrangler will print a local URL (typically `http://localhost:8787`). POST
   to `http://localhost:8787/save-snapshot` with header `X-App-Key` matching
   your local `.dev.vars` value and a JSON body
   `{ "filename": "...", "contentBase64": "..." }` to test end-to-end.

## Endpoint reference

- **Route:** `POST /save-snapshot` (any other path or method returns a JSON
  404/405 error; `OPTIONS` is handled for CORS preflight)
- **Request body:** `{ "filename": string, "contentBase64": string }`
- **Required header:** `X-App-Key: <APP_SHARED_KEY>`
- **Success response (200):** `{ "ok": true, "actionsUrl": "https://github.com/thering999/telemedmuk/actions" }`
- **Failure response:** `{ "ok": false, "error": string }` with the relevant
  HTTP status code (400 for bad input, 401 for a missing/wrong app key, or
  whatever status GitHub's API returned, 500 for unexpected errors)
- **CORS:** only `https://thering999.github.io` and `http://localhost:5173`
  are allowed as request origins.
