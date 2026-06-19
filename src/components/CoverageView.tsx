import { useMemo, useState } from 'react'
import type { Snapshot } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import mukdahanHospitals from '../data/mukdahanHospitals.json'
import ReportInfoPanel from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'

interface MasterHospital {
  hospcode: string
  hosname: string
  ampCode: string
  ampName: string
}

export interface CoverageViewProps {
  snapshot: Snapshot
}

const MASTER_LIST: MasterHospital[] = Object.entries(
  mukdahanHospitals as Record<string, { hosname: string; ampCode: string; ampName: string }>,
).map(([hospcode, v]) => ({ hospcode, ...v }))

function CoverageView({ snapshot }: CoverageViewProps) {
  const [search, setSearch] = useState('')

  const reportedCodes = useMemo(() => new Set(snapshot.facilities.map((f) => f.hospcode)), [snapshot])
  const masterCodes = useMemo(() => new Set(MASTER_LIST.map((h) => h.hospcode)), [])

  const missing = useMemo(
    () =>
      MASTER_LIST.filter((h) => !reportedCodes.has(h.hospcode)).sort(
        (a, b) => a.ampName.localeCompare(b.ampName, 'th') || a.hosname.localeCompare(b.hosname, 'th'),
      ),
    [reportedCodes],
  )

  const extra = useMemo(
    () => snapshot.facilities.filter((f) => !masterCodes.has(f.hospcode)),
    [snapshot, masterCodes],
  )

  const matchedCount = MASTER_LIST.length - missing.length
  const coveragePercent = MASTER_LIST.length > 0 ? (matchedCount / MASTER_LIST.length) * 100 : 0

  const filteredMissing = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return missing
    return missing.filter(
      (h) =>
        h.hosname.toLowerCase().includes(q) ||
        h.ampName.toLowerCase().includes(q) ||
        h.hospcode.toLowerCase().includes(q),
    )
  }, [missing, search])

  const exportColumns = useMemo<ExportColumn<MasterHospital>[]>(
    () => [
      { key: 'hospcode', label: 'รหัสสถาน', value: (h) => h.hospcode },
      { key: 'hosname', label: 'ชื่อหน่วยบริการ', value: (h) => h.hosname },
      { key: 'ampName', label: 'อำเภอ', value: (h) => h.ampName },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel
        objective="ตรวจสอบว่าหน่วยบริการในจังหวัดมุกดาหารตามทะเบียนหลักของ HDC ปรากฏอยู่ในรายงานภาพรวมของช่วงเวลานี้ครบหรือไม่ เพื่อช่วยให้ทราบว่ามีหน่วยบริการใดที่ยังไม่ได้ส่งหรือไม่ถูกรวมในรายงาน"
        methodology="เทียบรหัสสถาน (hospcode) ระหว่างรายชื่อหลัก (จากตาราง chospital ของ HDC กรองเฉพาะจังหวัดมุกดาหาร รหัส 49) กับรายชื่อที่ปรากฏในรายงานภาพรวมของช่วงเวลานี้ — หน่วยบริการที่ไม่ปรากฏไม่ได้แปลว่าผิดพลาดเสมอไป อาจเป็นเพราะหน่วยบริการประเภทนั้นไม่อยู่ในขอบเขตของรายงานโทรเวชกรรม (เช่น สสจ./สสอ./คลินิกเอกชนบางแห่ง)"
        source="ตาราง chospital (ฐานข้อมูล HDC ระดับประเทศ) เทียบกับรายงานภาพรวมที่นำเข้าจากระบบ Hippo"
        template="ไม่มี — เป็นข้อมูลอ้างอิงสถานบริการ (master data) ไม่ใช่ผลจากสมุดบันทึกวิเคราะห์"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="หน่วยบริการตามทะเบียนหลัก" value={MASTER_LIST.length.toLocaleString('th-TH')} />
        <KpiCard label="ปรากฏในรายงานนี้" value={matchedCount.toLocaleString('th-TH')} accent />
        <KpiCard label="ไม่ปรากฏในรายงานนี้" value={missing.length.toLocaleString('th-TH')} />
        <KpiCard label="ความครอบคลุม" value={`${coveragePercent.toFixed(1)}%`} accent />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">
            หน่วยบริการที่ไม่ปรากฏในรายงานนี้ ({snapshot.snapshotDate})
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`ความครอบคลุม_${snapshot.snapshotDate}`}
              title={`หน่วยบริการที่ไม่ปรากฏในรายงาน — ${snapshot.snapshotDate}`}
              columns={exportColumns}
              rows={filteredMissing}
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อหน่วยบริการ รหัสสถาน หรืออำเภอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
            />
          </div>
        </div>

        {filteredMissing.length === 0 ? (
          <p className="py-6 text-center text-slate-400">ไม่พบหน่วยบริการที่ขาดหายตามคำค้นหา</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                  <th className="px-3 py-2 font-medium">ชื่อหน่วยบริการ</th>
                  <th className="px-3 py-2 font-medium">อำเภอ</th>
                </tr>
              </thead>
              <tbody>
                {filteredMissing.map((h) => (
                  <tr key={h.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{h.hospcode}</td>
                    <td className="px-3 py-2 text-slate-800">{h.hosname}</td>
                    <td className="px-3 py-2 text-slate-600">{h.ampName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {extra.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-amber-900">
            หน่วยบริการในรายงานนี้ที่ไม่พบในทะเบียนหลัก ({extra.length.toLocaleString('th-TH')} แห่ง)
          </h3>
          <p className="mb-4 text-sm text-amber-800">
            อาจเกิดจากรหัสสถานพิมพ์ผิด หรือเป็นหน่วยบริการใหม่ที่ยังไม่ถูกเพิ่มในทะเบียนหลัก ควรตรวจสอบ
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200 text-amber-700">
                  <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                  <th className="px-3 py-2 font-medium">ชื่อหน่วยบริการ</th>
                  <th className="px-3 py-2 font-medium">อำเภอ</th>
                </tr>
              </thead>
              <tbody>
                {extra.map((f) => (
                  <tr key={f.hospcode} className="border-b border-amber-100">
                    <td className="px-3 py-2 text-amber-900">{f.hospcode}</td>
                    <td className="px-3 py-2 text-amber-900">{f.hospname}</td>
                    <td className="px-3 py-2 text-amber-900">{f.ampName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

export default CoverageView
