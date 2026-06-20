import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { ExportColumn } from './exportTable'
import { trendArrow, type TrendDirection } from './trend'

export type { TrendDirection } from './trend'
export { trendArrow, trendFromDelta } from './trend'

export interface ExportPdfOptions<T> {
  /** Used for the downloaded file name (no extension), e.g. "เปรียบเทียบ_2026-06-01_vs_2026-06-19". */
  filenameBase: string
  /** Report title shown in the PDF header. */
  title: string
  /** Optional subtitle line under the title -- typically the date-range text. */
  subtitle?: string
  columns: ExportColumn<T>[]
  rows: T[]
  /**
   * Optional per-row trend direction, rendered as an extra "แนวโน้ม" column
   * with an arrow glyph (↑/↓/•) at the end of the table.
   */
  trend?: (row: T) => TrendDirection
}

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const PAGE_MARGIN_PT = 32

/** Builds the off-screen, print-styled HTML used as the rasterization
 * source for the PDF. Kept visually close to exportTable's printTable()
 * output so PDF and "save as PDF via print" stay consistent, but rendered
 * via html2canvas instead of the browser print pipeline so it can be
 * triggered without opening a new window/tab (better on mobile). Using a
 * real DOM table + the page's own Sarabun/Noto Sans Thai font stack means
 * Thai glyphs rasterize correctly -- jsPDF's built-in fonts have no Thai
 * glyph coverage, so text must never be drawn with jsPDF's text APIs. */
function buildExportNode<T>(options: ExportPdfOptions<T>): HTMLDivElement {
  const { title, subtitle, columns, rows, trend } = options

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '1000px'
  container.style.background = '#ffffff'
  container.style.padding = '32px'
  container.style.fontFamily = "'Sarabun', 'Noto Sans Thai', system-ui, sans-serif"
  container.style.color = '#1e293b'

  const header = document.createElement('div')
  header.style.marginBottom = '16px'
  header.style.borderBottom = '2px solid #0d9488'
  header.style.paddingBottom = '12px'

  const h1 = document.createElement('h1')
  h1.textContent = title
  h1.style.fontSize = '20px'
  h1.style.fontWeight = '700'
  h1.style.margin = '0 0 4px 0'
  h1.style.color = '#0f172a'
  header.appendChild(h1)

  if (subtitle) {
    const sub = document.createElement('p')
    sub.textContent = subtitle
    sub.style.fontSize = '13px'
    sub.style.color = '#475569'
    sub.style.margin = '0'
    header.appendChild(sub)
  }

  container.appendChild(header)

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'
  table.style.fontSize = '12px'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const col of columns) {
    const th = document.createElement('th')
    th.textContent = col.label
    th.style.border = '1px solid #cbd5e1'
    th.style.padding = '8px 10px'
    th.style.textAlign = 'left'
    th.style.background = '#f0fdfa'
    th.style.color = '#0f766e'
    th.style.fontWeight = '700'
    headRow.appendChild(th)
  }
  if (trend) {
    const th = document.createElement('th')
    th.textContent = 'แนวโน้ม'
    th.style.border = '1px solid #cbd5e1'
    th.style.padding = '8px 10px'
    th.style.textAlign = 'center'
    th.style.background = '#f0fdfa'
    th.style.color = '#0f766e'
    th.style.fontWeight = '700'
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  rows.forEach((row, i) => {
    const tr = document.createElement('tr')
    tr.style.background = i % 2 === 0 ? '#ffffff' : '#f8fafc'
    for (const col of columns) {
      const td = document.createElement('td')
      td.textContent = String(col.value(row))
      td.style.border = '1px solid #e2e8f0'
      td.style.padding = '7px 10px'
      tr.appendChild(td)
    }
    if (trend) {
      const direction = trend(row)
      const td = document.createElement('td')
      td.textContent = trendArrow(direction)
      td.style.border = '1px solid #e2e8f0'
      td.style.padding = '7px 10px'
      td.style.textAlign = 'center'
      td.style.fontWeight = '700'
      td.style.color = direction === 'up' ? '#059669' : direction === 'down' ? '#e11d48' : '#94a3b8'
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  container.appendChild(table)

  document.body.appendChild(container)
  return container
}

/**
 * Renders the given columns/rows into a paginated A4 PDF and triggers a
 * download. The table is rasterized via html2canvas (so Thai text renders
 * using the browser's own font engine) then sliced across as many A4 pages
 * as needed, with a header repeated on each page and a footer carrying the
 * generation timestamp + page number.
 */
export async function exportToPdf<T>(options: ExportPdfOptions<T>): Promise<void> {
  const { filenameBase } = options
  const generatedAt = new Date().toLocaleString('th-TH')
  const node = buildExportNode(options)

  try {
    const canvas = await html2canvas(node, {
      scale: 1.5,
      backgroundColor: '#ffffff',
      useCORS: true,
    })

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const usableWidth = A4_WIDTH_PT - PAGE_MARGIN_PT * 2
    const usableHeight = A4_HEIGHT_PT - PAGE_MARGIN_PT * 2 - 24 // reserve space for footer

    const pxToPt = usableWidth / canvas.width
    const pageHeightPx = usableHeight / pxToPt

    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx))

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - page * pageHeightPx)
      sliceCanvas.height = sliceHeightPx

      const ctx = sliceCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          page * pageHeightPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        )
      }

      // JPEG at high quality keeps file size sane for long tables -- a
      // flat white/text table compresses far better as JPEG than as
      // lossless PNG, and the slight artifacting is imperceptible on text.
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.85)
      const imgHeightPt = sliceHeightPx * pxToPt
      pdf.addImage(imgData, 'JPEG', PAGE_MARGIN_PT, PAGE_MARGIN_PT, usableWidth, imgHeightPt)

      // Footer: generated-at timestamp (left) + page number (right). Drawn
      // with jsPDF's default font -- ASCII/digits only, so Thai glyph
      // coverage is not needed here.
      const footerY = A4_HEIGHT_PT - PAGE_MARGIN_PT + 10
      pdf.setFontSize(8)
      pdf.setTextColor(120, 120, 120)
      pdf.text(`Generated: ${generatedAt}`, PAGE_MARGIN_PT, footerY)
      pdf.text(`Page ${page + 1} / ${totalPages}`, A4_WIDTH_PT - PAGE_MARGIN_PT, footerY, {
        align: 'right',
      })
    }

    pdf.save(`${filenameBase}.pdf`)
  } finally {
    document.body.removeChild(node)
  }
}
