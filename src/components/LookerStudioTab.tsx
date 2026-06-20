const LOOKER_STUDIO_VIEW_URL =
  'https://datastudio.google.com/u/0/reporting/33f2a1d7-2f28-43b1-85ea-6cf3e8d579ac/page/p_q5mrcvqeyd'

function LookerStudioTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900 shadow-sm dark:border-brand-700 dark:bg-slate-800 dark:text-brand-300">
        <p className="font-medium">หมายเหตุ</p>
        <p className="mt-1 text-slate-700 dark:text-slate-300">
          รายงาน Looker Studio (Google Data Studio) นี้รวมข้อมูลจากหลายจังหวัด เนื่องจากเป็นลิงก์แบบสาธารณะที่ไม่สามารถกรองข้อมูลล่วงหน้าจากภายนอกได้
          กรุณาใช้ตัวกรอง (Filter control) ภายในรายงานเพื่อเลือกดูข้อมูลเฉพาะ
          <span className="font-semibold"> "มุกดาหาร" </span>
          ด้วยตนเอง
        </p>
        <p className="mt-2 text-slate-700 dark:text-slate-300">
          เจ้าของรายงานนี้ปิดการฝัง (embed) ลงในเว็บไซต์อื่นไว้ จึงไม่สามารถแสดงรายงานในหน้านี้ได้โดยตรง
          กรุณากดปุ่มด้านล่างเพื่อเปิดดูรายงานในแท็บใหม่แทน
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-5 py-16 text-center shadow-sm dark:border-slate-600 dark:from-slate-800 dark:to-slate-800">
        <div>
          <p className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">📊 รายงาน Telemedicine</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">(Looker Studio)</p>
        </div>
        <a
          href={LOOKER_STUDIO_VIEW_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-brand-700 hover:to-teal-700 active:scale-95 dark:from-brand-600 dark:to-teal-600"
        >
          <span>🔗</span>
          <span>เปิดรายงานในแท็บใหม่</span>
          <span>→</span>
        </a>
      </div>
    </div>
  )
}

export default LookerStudioTab
