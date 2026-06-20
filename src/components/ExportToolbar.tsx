import { exportToCsv, exportToExcel, printTable, type ExportColumn } from '../lib/exportTable'

export interface ExportToolbarProps<T> {
  /** Used for the downloaded file name (no extension), e.g. "ภาพรวม_2026-06-19". */
  filenameBase: string
  /** Report title shown in the PDF/print header. */
  title: string
  columns: ExportColumn<T>[]
  /** The currently filtered rows -- exports respect whatever filters/search are active. */
  rows: T[]
}

const buttonClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'

function ExportToolbar<T>({ filenameBase, title, columns, rows }: ExportToolbarProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} onClick={() => exportToExcel(filenameBase, columns, rows)}>
        Excel
      </button>
      <button type="button" className={buttonClass} onClick={() => exportToCsv(filenameBase, columns, rows)}>
        CSV
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          window.alert('เลือก "บันทึกเป็น PDF" เป็นปลายทางในหน้าต่างพิมพ์ที่จะเปิดขึ้น')
          printTable(title, columns, rows)
        }}
      >
        PDF
      </button>
      <button type="button" className={buttonClass} onClick={() => printTable(title, columns, rows)}>
        พิมพ์
      </button>
    </div>
  )
}

export default ExportToolbar
