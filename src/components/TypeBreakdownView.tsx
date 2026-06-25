import { useMemo, useState } from 'react'
import type { TypeBreakdownFacility, TypeBreakdownSnapshot } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import { useSortableTable } from '../lib/useSortableTable'
import ReportInfoPanel, { type ReportInfoPanelProps } from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'
import SortableTh from './SortableTh'
import KpiCard from './KpiCard'

export interface TypeBreakdownViewProps {
  snapshot: TypeBreakdownSnapshot
  /** Section title, e.g. "แยกประเภทบริการ" or "รายคน". */
  title: string
  /** Per-instance documentation content (differs between "all" and "person"). */
  docs: ReportInfoPanelProps
}

const ALL_HOSTYPES = '__all__'

function TypeBreakdownView({ snapshot, title, docs }: TypeBreakdownViewProps) {
  const [search, setSearch] = useState('')
  const [hostype, setHostype] = useState<string>(ALL_HOSTYPES)

  // Detect if this is person report (has all 5 types) vs service breakdown (has Type2,3,5 only)
  const isPersonReport = snapshot.category === 'person'

  const [prevSnapshot, setPrevSnapshot] = useState(snapshot)
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot)
    setSearch('')
    setHostype(ALL_HOSTYPES)
  }

  const hostypeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of snapshot.facilities) set.add(f.hostypeName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [snapshot])

  const filteredFacilities = useMemo<TypeBreakdownFacility[]>(() => {
    const q = search.trim().toLowerCase()
    return snapshot.facilities.filter((f) => {
      if (hostype !== ALL_HOSTYPES && f.hostypeName !== hostype) return false
      if (!q) return true
      return (
        f.hospname.toLowerCase().includes(q) ||
        f.ampName.toLowerCase().includes(q) ||
        f.hospcode.toLowerCase().includes(q)
      )
    })
  }, [snapshot, search, hostype])

  const kpis = useMemo(() => {
    let totalOp68 = 0
    let totalTypes69 = 0
    for (const f of filteredFacilities) {
      const op68 = f.byYear['68']
      const types69 = f.byYear['69']
      totalOp68 += op68?.op ?? 0
      totalTypes69 += ((types69?.type2 ?? 0) + (types69?.type3 ?? 0) + (types69?.type5 ?? 0))
    }
    const percent = totalOp68 > 0 ? (totalTypes69 / totalOp68) * 100 : 0
    return { totalOp68, totalTypes69, percent }
  }, [filteredFacilities])

  const exportColumns = useMemo<ExportColumn<TypeBreakdownFacility>[]>(() => {
    if (isPersonReport) {
      return [
        { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
        { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
        { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
        { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
        { key: 'op68', label: 'OP68', value: (f) => f.byYear['68']?.op ?? 0 },
        { key: 'type1', label: 'Person Type1 (69)', value: (f) => f.byYear['69']?.type1 ?? 0 },
        { key: 'type2', label: 'Person Type2 (69)', value: (f) => f.byYear['69']?.type2 ?? 0 },
        { key: 'type3', label: 'Person Type3 (69)', value: (f) => f.byYear['69']?.type3 ?? 0 },
        { key: 'type4', label: 'Person Type4 (69)', value: (f) => f.byYear['69']?.type4 ?? 0 },
        { key: 'type5', label: 'Person Type5 (69)', value: (f) => f.byYear['69']?.type5 ?? 0 },
        {
          key: 'telemedPercent',
          label: 'Telemedicine %',
          value: (f) => {
            const op68 = f.byYear['68']?.op ?? 0
            const type5 = f.byYear['69']?.type5 ?? 0
            return op68 > 0 ? Number(((type5 / op68) * 100).toFixed(2)) : 0
          },
        },
        {
          key: 'allTypesSum',
          label: 'All Types Sum',
          value: (f) => {
            const stats69 = f.byYear['69']
            if (!stats69) return 0
            return (
              (stats69.type1 ?? 0) +
              (stats69.type2 ?? 0) +
              (stats69.type3 ?? 0) +
              (stats69.type4 ?? 0) +
              (stats69.type5 ?? 0)
            )
          },
        },
      ]
    }
    return [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
      { key: 'op68', label: 'OP68', value: (f) => f.byYear['68']?.op ?? 0 },
      { key: 'type2', label: 'Type2 (69)', value: (f) => f.byYear['69']?.type2 ?? 0 },
      { key: 'type3', label: 'Type3 (69)', value: (f) => f.byYear['69']?.type3 ?? 0 },
      { key: 'type5', label: 'Type5 (69)', value: (f) => f.byYear['69']?.type5 ?? 0 },
      {
        key: 'typeSum',
        label: 'Type2+3+5 รวม',
        value: (f) => ((f.byYear['69']?.type2 ?? 0) + (f.byYear['69']?.type3 ?? 0) + (f.byYear['69']?.type5 ?? 0)),
      },
    ]
  }, [isPersonReport])

  const { sortedRows: sortedFacilities, sortKey, sortDir, toggleSort } = useSortableTable(filteredFacilities)

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel {...docs} />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        <div className="ml-auto flex flex-col gap-1">
          <label htmlFor="hostype-select" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            ประเภทสถานบริการ
          </label>
          <select
            id="hostype-select"
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={hostype}
            onChange={(e) => setHostype(e.target.value)}
          >
            <option value={ALL_HOSTYPES}>ทั้งหมด</option>
            {hostypeOptions.map((ht) => (
              <option key={ht} value={ht}>
                {ht}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isPersonReport ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        <KpiCard label="OP68 รวม" value={kpis.totalOp68.toLocaleString('th-TH')} />
        {isPersonReport ? (
          <>
            <KpiCard
              label="Type1 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type1 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type2 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type3 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type4 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type4 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type5 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
              variant="accent"
            />
          </>
        ) : (
          <>
            <KpiCard
              label="Type2 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type3 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
            />
            <KpiCard
              label="Type5 รวม"
              value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
              variant="accent"
            />
          </>
        )}
        <KpiCard
          label="รวมทั้งหมด"
          value={kpis.totalTypes69.toLocaleString('th-TH')}
          variant="accent"
        />
      </div>


      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`${title}_${snapshot.snapshotDate}`}
              title={`${title} (OP68 vs Type2+3+5/69) — ${snapshot.snapshotDate}`}
              columns={exportColumns}
              rows={filteredFacilities}
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อสถานพยาบาล รหัสสถาน หรืออำเภอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700 border-b-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                <SortableTh
                  label="รหัสสถาน"
                  active={sortKey === 'hospcode'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospcode', (f) => f.hospcode)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="สถานพยาบาล"
                  active={sortKey === 'hospname'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospname', (f) => f.hospname)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="อำเภอ"
                  active={sortKey === 'ampName'}
                  direction={sortDir}
                  onClick={() => toggleSort('ampName', (f) => f.ampName)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ประเภท"
                  active={sortKey === 'hostypeName'}
                  direction={sortDir}
                  onClick={() => toggleSort('hostypeName', (f) => f.hostypeName)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="OP68"
                  align="right"
                  active={sortKey === 'op68'}
                  direction={sortDir}
                  onClick={() => toggleSort('op68', (f) => f.byYear['68']?.op ?? 0)}
                  className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                />
                {isPersonReport ? (
                  <>
                    <SortableTh
                      label="T1"
                      align="right"
                      active={sortKey === 'type1'}
                      direction={sortDir}
                      onClick={() => toggleSort('type1', (f) => f.byYear['69']?.type1 ?? 0)}
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="T2"
                      align="right"
                      active={sortKey === 'type2'}
                      direction={sortDir}
                      onClick={() => toggleSort('type2', (f) => f.byYear['69']?.type2 ?? 0)}
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="T3"
                      align="right"
                      active={sortKey === 'type3'}
                      direction={sortDir}
                      onClick={() => toggleSort('type3', (f) => f.byYear['69']?.type3 ?? 0)}
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="T4"
                      align="right"
                      active={sortKey === 'type4'}
                      direction={sortDir}
                      onClick={() => toggleSort('type4', (f) => f.byYear['69']?.type4 ?? 0)}
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="T5"
                      align="right"
                      active={sortKey === 'type5'}
                      direction={sortDir}
                      onClick={() => toggleSort('type5', (f) => f.byYear['69']?.type5 ?? 0)}
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="TM%"
                      align="right"
                      active={sortKey === 'telemedPercent'}
                      direction={sortDir}
                      onClick={() =>
                        toggleSort('telemedPercent', (f) => {
                          const op68 = f.byYear['68']?.op ?? 0
                          const type5 = f.byYear['69']?.type5 ?? 0
                          return op68 > 0 ? (type5 / op68) * 100 : 0
                        })
                      }
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                    <SortableTh
                      label="Sum"
                      align="right"
                      active={sortKey === 'typeSum'}
                      direction={sortDir}
                      onClick={() =>
                        toggleSort('typeSum', (f) => {
                          const s = f.byYear['69']
                          return (s?.type1 ?? 0) + (s?.type2 ?? 0) + (s?.type3 ?? 0) + (s?.type4 ?? 0) + (s?.type5 ?? 0)
                        })
                      }
                      className="px-1.5 py-2 text-right font-bold text-xs"
                    />
                  </>
                ) : (
                  <>
                    <SortableTh
                      label="Type2 (69)"
                      align="right"
                      active={sortKey === 'type2'}
                      direction={sortDir}
                      onClick={() => toggleSort('type2', (f) => f.byYear['69']?.type2 ?? 0)}
                      className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                    />
                    <SortableTh
                      label="Type3 (69)"
                      align="right"
                      active={sortKey === 'type3'}
                      direction={sortDir}
                      onClick={() => toggleSort('type3', (f) => f.byYear['69']?.type3 ?? 0)}
                      className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                    />
                    <SortableTh
                      label="Type5 (69)"
                      align="right"
                      active={sortKey === 'type5'}
                      direction={sortDir}
                      onClick={() => toggleSort('type5', (f) => f.byYear['69']?.type5 ?? 0)}
                      className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                    />
                    <SortableTh
                      label="รวม"
                      align="right"
                      active={sortKey === 'typeSum'}
                      direction={sortDir}
                      onClick={() =>
                        toggleSort(
                          'typeSum',
                          (f) => (f.byYear['69']?.type2 ?? 0) + (f.byYear['69']?.type3 ?? 0) + (f.byYear['69']?.type5 ?? 0),
                        )
                      }
                      className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                    />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedFacilities.map((f) => {
                const op68 = f.byYear['68']?.op ?? 0
                const type1 = f.byYear['69']?.type1 ?? 0
                const type2 = f.byYear['69']?.type2 ?? 0
                const type3 = f.byYear['69']?.type3 ?? 0
                const type4 = f.byYear['69']?.type4 ?? 0
                const type5 = f.byYear['69']?.type5 ?? 0
                const typeSum = isPersonReport
                  ? type1 + type2 + type3 + type4 + type5
                  : type2 + type3 + type5
                return (
                  <tr key={f.hospcode} className="border-b border-slate-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm font-mono">{f.hospcode}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium">{f.hospname}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">{f.ampName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="text-xs">
                        {f.hostypeName.includes('ส่งเสริมสุขภาพตำบล') ? (
                          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-blue-700 dark:text-blue-300 font-medium">รพสต.</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-200 font-medium">รพ.</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{op68.toLocaleString('th-TH')}</td>
                    {isPersonReport ? (
                      <>
                        <td className="px-1.5 py-2 text-right text-slate-700 dark:text-slate-300 text-xs">{type1.toLocaleString('th-TH')}</td>
                        <td className="px-1.5 py-2 text-right text-slate-700 dark:text-slate-300 text-xs">{type2.toLocaleString('th-TH')}</td>
                        <td className="px-1.5 py-2 text-right text-slate-700 dark:text-slate-300 text-xs">{type3.toLocaleString('th-TH')}</td>
                        <td className="px-1.5 py-2 text-right text-slate-700 dark:text-slate-300 text-xs">{type4.toLocaleString('th-TH')}</td>
                        <td className="px-1.5 py-2 text-right font-medium text-brand-700 text-xs">{type5.toLocaleString('th-TH')}</td>
                        <td className="px-3 py-2 text-right text-brand-700">
                          {(() => {
                            const percent = op68 > 0 ? (type5 / op68) * 100 : 0
                            return `${percent.toFixed(2)}%`
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300 text-sm">{typeSum.toLocaleString('th-TH')}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{type2.toLocaleString('th-TH')}</td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{type3.toLocaleString('th-TH')}</td>
                        <td className="px-4 py-3 text-right font-medium text-brand-700">{type5.toLocaleString('th-TH')}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{typeSum.toLocaleString('th-TH')}</td>
                  </tr>
                )
              })}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={isPersonReport ? 12 : 9} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                    ไม่พบสถานพยาบาลที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
              {filteredFacilities.length > 0 && (
                <tr className="border-t-2 border-slate-400 dark:border-slate-600 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700 font-bold text-slate-800 dark:text-slate-100">
                  <td className="px-4 py-3">รวม</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right">{kpis.totalOp68.toLocaleString('th-TH')}</td>
                  {isPersonReport ? (
                    <>
                      <td className="px-1.5 py-2 text-right text-xs">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type1 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-1.5 py-2 text-right text-xs">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-1.5 py-2 text-right text-xs">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-1.5 py-2 text-right text-xs">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type4 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-1.5 py-2 text-right text-brand-700 text-xs">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right text-brand-700">
                        {(() => {
                          const totalType5 = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0)
                          const totalOp = filteredFacilities.reduce((sum, f) => sum + (f.byYear['68']?.op ?? 0), 0)
                          const percent = totalOp > 0 ? (totalType5 / totalOp) * 100 : 0
                          return `${percent.toFixed(2)}%`
                        })()}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 text-sm">
                        {(() => {
                          const type1Sum = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type1 ?? 0), 0)
                          const type2Sum = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0)
                          const type3Sum = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0)
                          const type4Sum = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type4 ?? 0), 0)
                          const type5Sum = filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0)
                          return (type1Sum + type2Sum + type3Sum + type4Sum + type5Sum).toLocaleString('th-TH')
                        })()}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right text-brand-700">
                        {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right text-brand-700">{kpis.totalTypes69.toLocaleString('th-TH')}</td>
                    </>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TypeBreakdownView
