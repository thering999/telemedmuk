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
    <details className="group rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 shadow-md hover:shadow-lg transition-shadow">
      <summary className="cursor-pointer list-none text-sm font-bold text-cyan-700 marker:content-none">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">ℹ️</span>
          📋 เกี่ยวกับรายงานนี้
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-cyan-500">
          <p className="font-bold text-cyan-700">🎯 เป้าหมาย</p>
          <p className="mt-1 text-slate-700">{objective}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-blue-500">
          <p className="font-bold text-blue-700">🔧 วิธีคิด</p>
          <p className="mt-1 text-slate-700">{methodology}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-teal-500">
          <p className="font-bold text-teal-700">📊 แหล่งข้อมูล</p>
          <p className="mt-1 text-slate-700">{source}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-3 border-l-4 border-emerald-500">
          <p className="font-bold text-emerald-700">📝 Template/ที่มา</p>
          <p className="mt-1 text-slate-700">{template}</p>
        </div>
      </div>
    </details>
  )
}

export default ReportInfoPanel
