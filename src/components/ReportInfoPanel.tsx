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
    <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-medium text-brand-700 marker:content-none">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">ℹ️</span>
          เกี่ยวกับรายงานนี้
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <div>
          <p className="font-semibold text-slate-700">เป้าหมาย</p>
          <p className="mt-1 text-slate-600">{objective}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">วิธีคิด</p>
          <p className="mt-1 text-slate-600">{methodology}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">แหล่งข้อมูล</p>
          <p className="mt-1 text-slate-600">{source}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">Template/ที่มา</p>
          <p className="mt-1 text-slate-600">{template}</p>
        </div>
      </div>
    </details>
  )
}

export default ReportInfoPanel
