import { useCallback } from 'react'
import type {
  FiscalYear,
  FollowupFacility,
  GroupBreakdownFacility,
  GroupDef,
  ReportCategory,
  SnapshotIndexEntry,
  TypeBreakdownFacility,
} from '../types/hdc'
import { followupTotalVisits, fullFiscalYear } from '../types/hdc'
import { fmtNum, fmtPct } from '../lib/drill'
import DetailDrawer, { DrawerSection, DrawerTable } from './DetailDrawer'
import TrendSection from './TrendSection'

const subtitleOf = (f: { hospcode: string; hostypeName: string; ampName: string }) =>
  `รหัส ${f.hospcode} · ${f.hostypeName} · อ.${f.ampName}`

/** "แยกประเภทบริการ" / "รายคน": every fiscal year with all five service types. */
export function TypeBreakdownDetailDrawer({
  facility,
  fiscalYear,
  isPerson,
  snapshotIndex,
  category,
  onClose,
}: {
  facility: Pick<TypeBreakdownFacility, 'hospcode' | 'hospname' | 'ampName' | 'hostypeName' | 'byYear'>
  fiscalYear: FiscalYear
  isPerson: boolean
  snapshotIndex?: SnapshotIndexEntry[]
  category: Extract<ReportCategory, 'all' | 'person'>
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
  const trendValue = useCallback(
    (f: TypeBreakdownFacility) => {
      const s = f.byYear[fiscalYear]
      return s ? s.type2 + s.type3 + s.type5 : null
    },
    [fiscalYear],
  )

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
      <TrendSection
        title={`แนวโน้ม Telemed (Type2+3+5) ปีงบ ${fullFiscalYear(fiscalYear)} ข้าม snapshot`}
        snapshotIndex={snapshotIndex}
        category={category}
        hospcode={facility.hospcode}
        value={trendValue}
      />
    </DetailDrawer>
  )
}

/** NCD / MCH / LTC-Palliative: every group's visits vs telemed + yearly totals. */
export function GroupDetailDrawer({
  facility,
  groupDefs,
  fiscalYear,
  snapshotIndex,
  category,
  onClose,
}: {
  facility: GroupBreakdownFacility
  groupDefs: GroupDef[]
  fiscalYear: FiscalYear
  snapshotIndex?: SnapshotIndexEntry[]
  category: Extract<ReportCategory, 'ncd' | 'mch' | 'ltc_pal'>
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
  const trendValue = useCallback(
    (f: GroupBreakdownFacility) => {
      const fromYear = f.byYear[fiscalYear]?.telemed
      if (fromYear != null) return fromYear
      const groups = Object.values(f.groups)
      return groups.length ? groups.reduce((sum, g) => sum + g.tele, 0) : null
    },
    [fiscalYear],
  )

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
      <TrendSection
        title="แนวโน้ม Telemed ข้าม snapshot"
        snapshotIndex={snapshotIndex}
        category={category}
        hospcode={facility.hospcode}
        value={trendValue}
      />
    </DetailDrawer>
  )
}

const followupTelemedCount = (f: FollowupFacility) => f.followUpTelemed

/** ติดตามต่อเนื่อง: follow-up funnel for one facility. */
export function FollowupDetailDrawer({
  facility,
  fiscalYear,
  snapshotIndex,
  onClose,
}: {
  facility: FollowupFacility
  fiscalYear: FiscalYear
  snapshotIndex?: SnapshotIndexEntry[]
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
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
        ร้อยละการใช้ Telemed ตามไฟล์ต้นทาง: <strong>{facility.percentTelemedUsage.toFixed(2)}%</strong>
      </p>
      <TrendSection
        title="แนวโน้มจำนวนติดตามผ่าน Telemed ข้าม snapshot"
        snapshotIndex={snapshotIndex}
        category="followup"
        hospcode={facility.hospcode}
        value={followupTelemedCount}
      />
    </DetailDrawer>
  )
}
