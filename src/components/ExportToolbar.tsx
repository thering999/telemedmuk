import { useState } from 'react'
import { exportToCsv, exportToExcel, printTable, type ExportColumn } from '../lib/exportTable'
import { useToast } from '../context/ToastContext'

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
  'min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'

function ExportToolbar<T>({ filenameBase, title, columns, rows }: ExportToolbarProps<T>) {
  const toast = useToast()
  const [pdfPending, setPdfPending] = useState(false)

  const handleExportExcel = () => {
    try {
      exportToExcel(filenameBase, columns, rows)
      toast.show('ดาวน์โหลด Excel สำเร็จ', 'success')
    } catch (error) {
      toast.show('ดาวน์โหลด Excel ไม่สำเร็จ', 'error')
    }
  }

  const handleExportCsv = () => {
    try {
      exportToCsv(filenameBase, columns, rows)
      toast.show('ดาวน์โหลด CSV สำเร็จ', 'success')
    } catch (error) {
      toast.show('ดาวน์โหลด CSV ไม่สำเร็จ', 'error')
    }
  }

  const handleExportPdf = async () => {
    setPdfPending(true)
    try {
      const { exportToPdf } = await import('../lib/exportPdf')
      await exportToPdf({ filenameBase, title, columns, rows })
      toast.show('ดาวน์โหลด PDF สำเร็จ', 'success')
    } catch (error) {
      toast.show('ดาวน์โหลด PDF ไม่สำเร็จ', 'error')
    } finally {
      setPdfPending(false)
    }
  }

  const handlePrint = () => {
    try {
      printTable(title, columns, rows)
      toast.show('เปิดหน้าพิมพ์สำเร็จ', 'success')
    } catch (error) {
      toast.show('เปิดหน้าพิมพ์ไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} onClick={handleExportExcel}>
        Excel
      </button>
      <button type="button" className={buttonClass} onClick={handleExportCsv}>
        CSV
      </button>
      <button
        type="button"
        className={`${buttonClass} border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50`}
        disabled={pdfPending}
        onClick={handleExportPdf}
      >
        {pdfPending ? 'กำลังสร้าง PDF...' : '📥 Export as PDF'}
      </button>
      <button type="button" className={buttonClass} onClick={handlePrint}>
        พิมพ์
      </button>
    </div>
  )
}

export default ExportToolbar
