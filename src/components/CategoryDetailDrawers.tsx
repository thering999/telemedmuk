import type {
  FiscalYear,
  FollowupFacility,
  GroupBreakdownFacility,
  GroupDef,
  TypeBreakdownFacility,
} from '../types/hdc'
import { followupTotalVisits, fullFiscalYear } from '../types/hdc'
import { fmtNum, fmtPct } from '../lib/drill'
import DetailDrawer, { DrawerSection, DrawerTable } from './DetailDrawer'

const subtitleOf = (f: { hospcode: string; hostypeName: string; ampName: string }) =>
  `รหัส ${f.hospcode} · ${f.hostypeName} · อ.${f.ampName}`

/** "แยกประเภทบริการ" / "รายคน": every fiscal year with all five service types. */
export function TypeBreakdownDetailDrawer({
  facility,
  fiscalYear,
  isPerson,
  onClose,
}: {
  facility: Pick<TypeBreakdownFacility, 'hospcode' | 'hospname' | 'ampName' | 'hostypeName' | 'byYear'>
  fiscalYear: FiscalYear
  isPerson: boolean
  onClose: () => void
}) {
  const years = Object.keys(facility.byYear).sort()
  const unit = isPerson ? 'คน' : 'ครั้ง'
  const yearRows = years.map((y) => {
    const s = facility.byYear[y]!
    const tele = s.type2 + s.type3 + s.type5
    return [fullFiscalYear(y), fmtNum(s.service), fmtNum(s.op), fmtNum(tele), fmtPct(tele, s.op)]
  })
  const cur = facility.byYear[fiscalYear]
  const typeTotal = cur ? cur.type1 + cur.type2 + cur.type3 + cur.type4 + cur.type5 : 0
  const typeRows = cur
    ? (
        [
          ['Type1 Walk-in', cur.type1],
          ['Type2 นัดหมาย/ส่งต่อ', cur.type2],
          ['Type3 เชิงรุก/ชุมชน', cur.type3],
          ['Type4 เยี่ยมบ้าน', cur.type4],
          ['Type5 Telemedicine', cur.type5],
        ] as const
      ).map(([label, v]) => [label, fmtNum(v), fmtPct(v, typeTotal)])
    : []

  return (
    <DetailDrawer title={facility.hospname} subtitle={subtitleOf(facility)} onClose={onClose}>
      <DrawerSection title={`แยกตามประเภทบริการ ปีงบ ${fullFiscalYear(fiscalYear)} (${unit})`}>
        {cur ? (
          <DrawerTable head={['ประเภท', 'จำนวน', 'สัดส่วน']} rows={typeRows} />
        ) : (
          <p className="text-sm text-slate-500">ไม่มีข้อมูลปีงบนี้</p>
        )}
      </DrawerSection>
      <DrawerSection title="รายปีงบประมาณ (Telemed = Type2+3+5)">
        <DrawerTable
          head={['ปีงบ', 'Service', 'OP', 'Telemed', '% ต่อ OP']}
          rows={yearRows}
          highlight={years.indexOf(fiscalYear)}
        />
      </DrawerSection>
    </DetailDrawer>
  )
}

/** NCD / MCH / LTC-Palliative: every group's visits vs telemed + yearly totals. */
export function GroupDetailDrawer({
  facility,
  groupDefs,
  fiscalYear,
  onClose,
}: {
  facility: GroupBreakdownFacility
  groupDefs: GroupDef[]
  fiscalYear: FiscalYear
  onClose: () => void
}) {
  const groupRows = groupDefs.map((g) => {
    const s = facility.groups[g.key] ?? { visit: 0, tele: 0 }
    return [g.label, fmtNum(s.visit), fmtNum(s.tele), fmtPct(s.tele, s.visit)]
  })
  const years = Object.keys(facility.byYear).sort()
  const yearRows = years.map((y) => {
    const s = facility.byYear[y]!
    return [fullFiscalYear(y), fmtNum(s.op), fmtNum(s.telemed), fmtPct(s.telemed, s.op)]
  })

  return (
    <DetailDrawer title={facility.hospname} subtitle={subtitleOf(facility)} onClose={onClose}>
      <DrawerSection title="แยกตามกลุ่มโรค / กลุ่มเป้าหมาย">
        <DrawerTable head={['กลุ่ม', 'Visit', 'Telemed', '% Telemed']} rows={groupRows} />
      </DrawerSection>
      {years.length > 0 && (
        <DrawerSection title="ภาพรวมรายปีงบประมาณ">
          <DrawerTable
            head={['ปีงบ', 'OP', 'Telemed', '% ต่อ OP']}
            rows={yearRows}
            highlight={years.indexOf(fiscalYear)}
          />
        </DrawerSection>
      )}
    </DetailDrawer>
  )
}

/** ติดตามต่อเนื่อง: follow-up funnel for one facility. */
export function FollowupDetailDrawer({
  facility,
  fiscalYear,
  onClose,
}: {
  facility: FollowupFacility
  fiscalYear: FiscalYear
  onClose: () => void
}) {
  const total = followupTotalVisits(facility)
  const rows = [
    [`Visit ทั้งหมด ปีงบ ${fullFiscalYear(fiscalYear)}`, fmtNum(total), ''],
    ['ติดตามต่อเนื่อง (รวม)', fmtNum(facility.followUpTotal), fmtPct(facility.followUpTotal, total)],
    ['  ติดตามแบบปกติ', fmtNum(facility.followUpNormal), fmtPct(facility.followUpNormal, facility.followUpTotal)],
    ['  ติดตามผ่าน Telemed', fmtNum(facility.followUpTelemed), fmtPct(facility.followUpTelemed, facility.followUpTotal)],
  ]
  return (
    <DetailDrawer title={facility.hospname} subtitle={subtitleOf(facility)} onClose={onClose}>
      <DrawerSection title="การติดตามต่อเนื่อง">
        <DrawerTable head={['รายการ', 'จำนวน', 'สัดส่วน']} rows={rows} />
      </DrawerSection>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        ร้อยละการใช้ Telemed ตามไฟล์ต้นทาง: <strong>{facility.percentTelemedUsage.toFixed(2)}%</strong>
      </p>
    </DetailDrawer>
  )
}
