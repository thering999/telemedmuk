const POWER_BI_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiYjE4NGNjNzItYmM2ZS00MjFmLTlmNDEtOWQ1M2JiODk4N2M0IiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D'

function PowerBiTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900 shadow-sm">
        <p className="font-medium">หมายเหตุ</p>
        <p className="mt-1 text-slate-700">
          รายงาน Power BI นี้รวมข้อมูลจากหลายจังหวัด เนื่องจากเป็นลิงก์แบบสาธารณะ
          (publish to web) ที่ไม่สามารถกรองข้อมูลล่วงหน้าจากภายนอกได้
          กรุณาใช้ตัวกรอง (Slicer) ภายในรายงานเพื่อเลือกดูข้อมูลเฉพาะ
          <span className="font-semibold"> "มุกดาหาร" </span>
          ด้วยตนเอง
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative w-full" style={{ aspectRatio: '16 / 9', minHeight: '600px' }}>
          <iframe
            title="รายงาน Telemedicine Power BI"
            src={POWER_BI_URL}
            className="absolute inset-0 h-full w-full"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  )
}

export default PowerBiTab
