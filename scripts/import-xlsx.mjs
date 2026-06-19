#!/usr/bin/env node
/**
 * Import Hippo HIS telemedicine usage export(s) into per-snapshot JSON.
 *
 * Reads every *.xlsx file in data/raw/, parses the snapshot date and
 * province code from the filename, transforms each row into the
 * per-facility JSON shape, and writes:
 *   - public/data/snapshots/<snapshotDate>.json  (one per distinct date)
 *   - public/data/snapshots/index.json           (rebuilt from the full
 *     output directory contents, so it's idempotent across runs)
 *
 * When multiple files share the same snapshotDate (e.g. several Hippo
 * exports pulled the same day), they are merged into a single snapshot at
 * the facility (hospcode) level: files are processed in sorted filename
 * order and a later file's row for a given hospcode replaces an earlier
 * file's row for that same hospcode. The resulting snapshot's `sourceFile`
 * is a single string when only one file covers that date, or an array of
 * filenames (in merge order) when more than one file was combined.
 *
 * Usage: node scripts/import-xlsx.mjs
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_DIR = join(ROOT_DIR, 'data', 'raw');
const OUT_DIR = join(ROOT_DIR, 'public', 'data', 'snapshots');

// Filename pattern: YYYYMMDD_PP_telemed_hosp[_suffix][ (N)].xlsx
// The trailing suffix is optional and may be a running number (e.g. "_235")
// or a free-form tag (e.g. "_typein235" for the manually-typed-in subset
// export) since not every Hippo export includes one or uses the same scheme.
// The further optional " (N)"/"(N)" tolerates the suffix browsers add to a
// re-downloaded duplicate file (e.g. Chrome's "file (1).xlsx").
const FILENAME_PATTERN = /^(\d{4})(\d{2})(\d{2})_(\d{2})_telemed_hosp(?:_\w+)?(?: ?\(\d+\))?\.xlsx$/i;

const PROVINCE_NAMES = {
  49: 'มุกดาหาร',
};

// Keep in sync with FISCAL_YEARS in src/types/hdc.ts
const FISCAL_YEARS = ['68', '69'];

/**
 * Trim a value if it's a string; pass through otherwise.
 */
function trimStr(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value;
}

/**
 * Coerce a cell value into a number. Treats null/undefined/empty string as 0
 * for numeric usage-count fields (these columns represent counts, never
 * intentionally absent in the source data).
 */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse YYYYMMDD_PP_telemed_hosp_NNN.xlsx -> { snapshotDate: 'YYYY-MM-DD', provinceCode: 'PP' }
 */
function parseFilename(filename) {
  const match = FILENAME_PATTERN.exec(filename);
  if (!match) return null;
  const [, yyyy, mm, dd, provinceCode] = match;
  return {
    snapshotDate: `${yyyy}-${mm}-${dd}`,
    provinceCode,
  };
}

/**
 * Resolve a single fiscal year's YearStats from a raw row, supporting the 3
 * known Hippo export layouts:
 *  - Format A: Type2_Y / Type3_Y / Type5_Y + OP_Y (full type breakdown)
 *  - Format B: Telemed_Y total + OP_Y (no type breakdown)
 *  - Format C: Telemed_Y total + Service_Y as the OP fallback (no OP_Y at all)
 * A column "exists" if the row object has that key, even if its value is 0 —
 * only a truly absent key means the format doesn't track that metric.
 * Returns null if the format has no telemed AND no op/service data for this
 * year at all (year should be omitted from byYear entirely).
 */
function resolveYearStats(row, year) {
  const type2Key = `Type2_${year}`;
  const type3Key = `Type3_${year}`;
  const type5Key = `Type5_${year}`;
  const telemedKey = `Telemed${year}`;
  const opKey = `OP${year}`;
  const serviceKey = `Service${year}`;

  const hasTypeBreakdown = type2Key in row || type3Key in row || type5Key in row;
  const hasTelemedTotal = telemedKey in row;
  const hasOp = opKey in row;
  const hasService = serviceKey in row;

  if (!hasTypeBreakdown && !hasTelemedTotal && !hasOp && !hasService) {
    return null;
  }

  /** @type {{telemed: number, op: number, type2?: number, type3?: number, type5?: number}} */
  const stats = { telemed: 0, op: 0 };

  if (hasTypeBreakdown) {
    const type2 = toNumber(row[type2Key]);
    const type3 = toNumber(row[type3Key]);
    const type5 = toNumber(row[type5Key]);
    stats.telemed = type2 + type3 + type5;
    stats.type2 = type2;
    stats.type3 = type3;
    stats.type5 = type5;
  } else if (hasTelemedTotal) {
    stats.telemed = toNumber(row[telemedKey]);
  }

  if (hasOp) {
    stats.op = toNumber(row[opKey]);
  } else if (hasService) {
    stats.op = toNumber(row[serviceKey]);
  }

  return stats;
}

/**
 * Transform a single raw worksheet row into the per-facility JSON shape.
 */
function transformRow(row) {
  const byYear = {};
  for (const year of FISCAL_YEARS) {
    const stats = resolveYearStats(row, year);
    if (stats) byYear[year] = stats;
  }

  return {
    hospcode: trimStr(row.hospcode),
    hospname: trimStr(row.hospname),
    ampCode: trimStr(row.AMP_CODE),
    ampName: trimStr(row.AMP_NAME),
    hostypeCode: trimStr(row.HOSTYPECODE),
    hostypeName: trimStr(row.HOSTYPENAME),
    mcode: trimStr(row.MCODE),
    mName: trimStr(row.M_NAME),
    depName: trimStr(row.DEP_NAME),
    serviceAll: toNumber(row.ServiceAll),
    opAll: toNumber(row.OPAll),
    byYear,
    percentTelemed69PerOP68: toNumber(row.PercentTelemed69PerOP68),
  };
}

/**
 * Parse a single xlsx file into its snapshot pieces, without writing
 * anything yet. Returns { snapshotDate, provinceCode, provinceName,
 * sourceFile, facilities }. Throws on any structural problem.
 */
function parseFile(filename) {
  const parsed = parseFilename(filename);
  if (!parsed) {
    throw new Error(
      `Filename "${filename}" does not match expected pattern YYYYMMDD_PP_telemed_hosp_NNN.xlsx`
    );
  }
  const { snapshotDate, provinceCode } = parsed;

  const filePath = join(RAW_DIR, filename);
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    throw new Error(`Failed to parse "${filename}": ${err.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`"${filename}" has no worksheets`);
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });

  const facilities = rows.map(transformRow);

  const provinceName = PROVINCE_NAMES[provinceCode] ?? null;
  if (!provinceName) {
    console.warn(
      `  [warn] Unknown province code "${provinceCode}" in "${filename}" — no name mapping found.`
    );
  }

  return {
    snapshotDate,
    provinceCode,
    provinceName,
    sourceFile: filename,
    facilities,
  };
}

/**
 * Merge multiple same-date parsed files into one snapshot at the facility
 * (hospcode) level. Files must already be sorted into the desired merge
 * order (later file's row for a given hospcode replaces the earlier one;
 * hospcodes absent from a later file keep whichever earlier file had them).
 * Province metadata is taken from the last file that has a known province
 * name, falling back to the first file's province otherwise.
 */
function mergeParsedFiles(snapshotDate, parsedFiles) {
  const facilityMap = new Map();
  for (const pf of parsedFiles) {
    for (const facility of pf.facilities) {
      facilityMap.set(facility.hospcode, facility);
    }
  }

  const withKnownProvince = parsedFiles.filter((pf) => pf.provinceName);
  const provinceSource = withKnownProvince[withKnownProvince.length - 1] ?? parsedFiles[0];

  const sourceFile =
    parsedFiles.length === 1 ? parsedFiles[0].sourceFile : parsedFiles.map((pf) => pf.sourceFile);

  if (parsedFiles.length > 1) {
    console.log(
      `[merge] snapshot ${snapshotDate} combined from ${parsedFiles.length} file(s): ${parsedFiles
        .map((pf) => pf.sourceFile)
        .join(', ')} (${facilityMap.size} unique facilities)`
    );
  }

  return {
    snapshotDate,
    sourceFile,
    province: {
      code: provinceSource.provinceCode,
      name: provinceSource.provinceName,
    },
    facilities: Array.from(facilityMap.values()),
  };
}

/**
 * Write a merged snapshot object to public/data/snapshots/<date>.json.
 */
function writeSnapshot(snapshot) {
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${snapshot.snapshotDate}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
}

/**
 * Rebuild public/data/snapshots/index.json by scanning the output directory
 * itself (not just files processed this run), sorted by date descending.
 */
function rebuildIndex() {
  let entries;
  try {
    entries = readdirSync(OUT_DIR, { withFileTypes: true });
  } catch {
    entries = [];
  }

  const snapshotFiles = entries
    .filter((e) => e.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(e.name))
    .map((e) => e.name);

  const index = [];
  for (const fname of snapshotFiles) {
    const fullPath = join(OUT_DIR, fname);
    try {
      const data = JSON.parse(readFileSync(fullPath, 'utf8'));
      index.push({
        date: data.snapshotDate,
        sourceFile: data.sourceFile,
        facilityCount: Array.isArray(data.facilities) ? data.facilities.length : 0,
      });
    } catch (err) {
      console.error(`  [error] Could not read snapshot file "${fname}" while building index: ${err.message}`);
    }
  }

  index.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');

  return index;
}

function main() {
  let rawEntries;
  try {
    rawEntries = readdirSync(RAW_DIR, { withFileTypes: true });
  } catch (err) {
    console.error(`[error] Could not read data/raw/ directory: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const xlsxFiles = rawEntries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.xlsx'))
    .map((e) => e.name)
    .sort();

  if (xlsxFiles.length === 0) {
    console.warn('[warn] No .xlsx files found in data/raw/. Nothing to import.');
  }

  let successCount = 0;
  let errorCount = 0;

  // Parse every file first (in sorted filename order), grouping the
  // successfully-parsed ones by snapshotDate so same-date files can be
  // merged at the facility level instead of overwriting each other.
  const byDate = new Map();

  for (const filename of xlsxFiles) {
    try {
      const parsedFile = parseFile(filename);
      const bucket = byDate.get(parsedFile.snapshotDate) ?? [];
      bucket.push(parsedFile);
      byDate.set(parsedFile.snapshotDate, bucket);
      successCount += 1;
    } catch (err) {
      console.error(`[error] ${filename}: ${err.message}`);
      errorCount += 1;
    }
  }

  for (const [snapshotDate, parsedFiles] of byDate) {
    const snapshot = mergeParsedFiles(snapshotDate, parsedFiles);
    writeSnapshot(snapshot);
    const fileList = parsedFiles.map((pf) => pf.sourceFile).join(', ');
    console.log(
      `[ok] ${fileList} -> snapshot ${snapshot.snapshotDate} (${snapshot.facilities.length} facilities)`
    );
  }

  const index = rebuildIndex();
  console.log(
    `[index] Rebuilt public/data/snapshots/index.json with ${index.length} snapshot(s).`
  );

  console.log(
    `[summary] ${successCount} file(s) imported, ${errorCount} error(s).`
  );

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main();
