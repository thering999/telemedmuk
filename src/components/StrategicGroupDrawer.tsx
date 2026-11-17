import type { FiscalYear } from '../types/hdc'
import type { CombinedFacility } from '../lib/strategic'
import { DRILL_ROW_CLASS, drillRowProps, fmtNum } from '../lib/drill'
import DetailDrawer, { DrawerSection } from './DetailDrawer'

interface Row {
  facility: CombinedFacility
  op: number
  type5: number
  rate: number | null
}

/** Strategic view: facilities inside a district / affiliation / facility-type group, ranked by rate. */
export default function StrategicGroupDrawer({
  title,
  fiscalYear,
  rows,
  onPick,
  onClose,
}: {
  title: string
  fiscalYear: FiscalYear
  rows: Row[]
  onPick: (f: CombinedFacility) => void
  onClose: () => void
}) {
  const sorted = [...rows].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
  return (
    <DetailDrawer title={title} subtitle={`ปีงบ ${fiscalYear} · ${rows.length} หน่วย · คลิกหน่วยบริการเพื่อดูรายละเอียด`} onClose={onClose}>
      <DrawerSection title="หน่วยบริการในกลุ่ม (เรียงตามอัตรา Type5/OP)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <th className="px-2 py-2 text-left">หน่วยบริการ</th>
              <th className="px-2 py-2 text-right">OP</th>
              <th className="px-2 py-2 text-right">Type5</th>
              <th className="px-2 py-2 text-right">อัตรา %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.facility.hospcode}
                {...drillRowProps(() => onPick(r.facility))}
                className={`${DRILL_ROW_CLASS} border-b border-slate-100 text-slate-800 hover:bg-blue-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800`}
              >
                <td className="px-2 py-2">{r.facility.hospname}</td>
                <td className="px-2 py-2 text-right">{fmtNum(r.op)}</td>
                <td className="px-2 py-2 text-right">{fmtNum(r.type5)}</td>
                <td className="px-2 py-2 text-right">{r.rate === null ? '-' : `${r.rate.toFixed(2)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DrawerSection>
    </DetailDrawer>
  )
}
