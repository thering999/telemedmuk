#!/usr/bin/env node
/**
 * Import Hippo HIS telemedicine usage export(s) into per-snapshot JSON.
 *
 * Reads every *.xlsx file in data/raw/, parses the snapshot date and
 * province code from the filename, transforms each row into the
 * per-facility JSON shape, and writes:
 *   - public/data/snapshots/<snapshotDate>.json  (one per source file)
 *   - public/data/snapshots/index.json           (rebuilt from the full
 *     output directory contents, so it's idempotent across runs)
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

// Filename pattern: YYYYMMDD_PP_telemed_hosp_NNN.xlsx
const FILENAME_PATTERN = /^(\d{4})(\d{2})(\d{2})_(\d{2})_telemed_hosp_\d+\.xlsx$/i;

const PROVINCE_NAMES = {
  49: 'มุกดาหาร',
};

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
 * Transform a single raw worksheet row into the per-facility JSON shape.
 */
function transformRow(row) {
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
    byYear: {
      68: {
        type2: toNumber(row.Type2_68),
        type3: toNumber(row.Type3_68),
        type5: toNumber(row.Type5_68),
        op: toNumber(row.OP68),
      },
      69: {
        type2: toNumber(row.Type2_69),
        type3: toNumber(row.Type3_69),
        type5: toNumber(row.Type5_69),
        op: toNumber(row.OP69),
      },
    },
    percentTelemed69PerOP68: toNumber(row.PercentTelemed69PerOP68),
  };
}

/**
 * Process a single xlsx file: parse, transform, write the snapshot JSON.
 * Returns { snapshotDate, sourceFile, facilityCount } on success.
 */
function processFile(filename) {
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

  const snapshot = {
    snapshotDate,
    sourceFile: filename,
    province: {
      code: provinceCode,
      name: provinceName,
    },
    facilities,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${snapshotDate}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  return { snapshotDate, sourceFile: filename, facilityCount: facilities.length };
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

  for (const filename of xlsxFiles) {
    try {
      const result = processFile(filename);
      console.log(
        `[ok] ${result.sourceFile} -> snapshot ${result.snapshotDate} (${result.facilityCount} facilities)`
      );
      successCount += 1;
    } catch (err) {
      console.error(`[error] ${filename}: ${err.message}`);
      errorCount += 1;
    }
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
