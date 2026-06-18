const LOOKER_STUDIO_VIEW_URL =
  'https://datastudio.google.com/u/0/reporting/33f2a1d7-2f28-43b1-85ea-6cf3e8d579ac/page/p_q5mrcvqeyd'

function LookerStudioTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900 shadow-sm">
        <p className="font-medium">หมายเหตุ</p>
        <p className="mt-1 text-slate-700">
          รายงาน Looker Studio (Google Data Studio) นี้รวมข้อมูลจากหลายจังหวัด เนื่องจากเป็นลิงก์แบบสาธารณะที่ไม่สามารถกรองข้อมูลล่วงหน้าจากภายนอกได้
          กรุณาใช้ตัวกรอง (Filter control) ภายในรายงานเพื่อเลือกดูข้อมูลเฉพาะ
          <span className="font-semibold"> "มุกดาหาร" </span>
          ด้วยตนเอง
        </p>
        <p className="mt-2 text-slate-700">
          เจ้าของรายงานนี้ปิดการฝัง (embed) ลงในเว็บไซต์อื่นไว้ จึงไม่สามารถแสดงรายงานในหน้านี้ได้โดยตรง
          กรุณากดปุ่มด้านล่างเพื่อเปิดดูรายงานในแท็บใหม่แทน
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
        <p className="text-slate-600">รายงาน Telemedicine (Looker Studio)</p>
        <a
          href={LOOKER_STUDIO_VIEW_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          เปิดรายงานในแท็บใหม่
        </a>
      </div>
    </div>
  )
}

export default LookerStudioTab
