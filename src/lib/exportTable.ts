export interface ExportColumn<T> {
  key: string
  /** Thai column header shown in every export format. */
  label: string
  /** Extract/format this column's value for a given row. */
  value: (row: T) => string | number
}

function buildRows<T>(columns: ExportColumn<T>[], rows: T[]): Record<string, string | number>[] {
  return rows.map((row) => {
    const out: Record<string, string | number> = {}
    for (const col of columns) out[col.label] = col.value(row)
    return out
  })
}

export async function exportToExcel<T>(filenameBase: string, columns: ExportColumn<T>[], rows: T[]): Promise<void> {
  // Loaded on demand -- xlsx is a heavy dependency only needed when the user
  // actually requests an Excel export, so it gets its own chunk.
  const XLSX = await import('xlsx')
  const sheetRows = buildRows(columns, rows)
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: columns.map((c) => c.label) })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ข้อมูล')
  XLSX.writeFile(workbook, `${filenameBase}.xlsx`)
}

/** Escape a single CSV field per RFC 4180: wrap in quotes if it contains a
 * comma, quote, or newline, doubling any internal quotes. */
function csvField(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportToCsv<T>(filenameBase: string, columns: ExportColumn<T>[], rows: T[]): void {
  const lines = [
    columns.map((c) => csvField(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => csvField(c.value(row))).join(',')),
  ]
  // UTF-8 BOM so Excel detects the encoding correctly when double-clicked.
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildPrintableHtml<T>(title: string, columns: ExportColumn<T>[], rows: T[]): string {
  const generatedAt = new Date().toLocaleString('th-TH')
  const headerCells = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((c) => `<td>${escapeHtml(String(c.value(row)))}</td>`)
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; padding: 24px; color: #1e293b; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p.meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">พิมพ์เมื่อ: ${escapeHtml(generatedAt)} · จำนวน ${rows.length.toLocaleString('th-TH')} รายการ</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Opens a clean, minimal printable view of the table in a new window and
 * triggers the browser's print dialog. Choosing "Save as PDF" as the
 * destination IS the PDF export -- the browser renders Thai text correctly
 * via normal HTML/CSS, so no font-embedding library is needed. */
export function printTable<T>(title: string, columns: ExportColumn<T>[], rows: T[]): void {
  const html = buildPrintableHtml(title, columns, rows)
  const win = window.open('', '_blank')
  if (!win) {
    window.alert('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  // Give the new document a moment to finish laying out before printing.
  win.setTimeout(() => win.print(), 250)
}
