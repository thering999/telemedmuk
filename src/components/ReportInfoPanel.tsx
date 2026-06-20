export interface ReportInfoPanelProps {
  /** เป้าหมาย */
  objective: string
  /** วิธีคิด / นิยาม */
  methodology: string
  /** แหล่งข้อมูล */
  source: string
  /** Template/SQL ต้นฉบับ */
  template: string
}

function ReportInfoPanel({ objective, methodology, source, template }: ReportInfoPanelProps) {
  return (
    <details className="group rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 shadow-md hover:shadow-lg transition-shadow dark:border-cyan-700 dark:from-slate-800 dark:to-slate-800">
      <summary className="cursor-pointer list-none text-sm font-bold text-cyan-700 marker:content-none dark:text-cyan-400">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">ℹ️</span>
          📋 เกี่ยวกับรายงานนี้
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-cyan-500 dark:bg-slate-900/50">
          <p className="font-bold text-cyan-700 dark:text-cyan-400">🎯 เป้าหมาย</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{objective}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-blue-500 dark:bg-slate-900/50">
          <p className="font-bold text-blue-700 dark:text-blue-400">🔧 วิธีคิด</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{methodology}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-teal-500 dark:bg-slate-900/50">
          <p className="font-bold text-teal-700 dark:text-teal-400">📊 แหล่งข้อมูล</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{source}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-emerald-500 dark:bg-slate-900/50">
          <p className="font-bold text-emerald-700 dark:text-emerald-400">📝 Template/ที่มา</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{template}</p>
        </div>
      </div>
    </details>
  )
}

export default ReportInfoPanel
