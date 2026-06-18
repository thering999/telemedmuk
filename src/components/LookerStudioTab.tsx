const LOOKER_STUDIO_URL =
  'https://datastudio.google.com/embed/reporting/33f2a1d7-2f28-43b1-85ea-6cf3e8d579ac/page/p_q5mrcvqeyd'

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
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative w-full" style={{ aspectRatio: '16 / 9', minHeight: '600px' }}>
          <iframe
            title="รายงาน Telemedicine Looker Studio"
            src={LOOKER_STUDIO_URL}
            className="absolute inset-0 h-full w-full"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  )
}

export default LookerStudioTab
