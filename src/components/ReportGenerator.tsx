import { useState } from 'react'
import type { TypeBreakdownSnapshot } from '../types/hdc'
import { useToast } from '../context/ToastContext'
import { exportToPdf } from '../lib/exportPdf'

interface ReportGeneratorProps {
  snapshot: TypeBreakdownSnapshot
  snapshotDate: string
}

type ReportType = 'monthly' | 'district' | 'facility'

function ReportGenerator({ snapshot, snapshotDate }: ReportGeneratorProps) {
  const toast = useToast()
  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [isGenerating, setIsGenerating] = useState(false)

  const generateReport = async () => {
    setIsGenerating(true)
    try {
      const facilities = snapshot.facilities
      const totalType5 = facilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0)
      const totalOP = facilities.reduce((sum, f) => sum + (f.byYear['69']?.op ?? 0), 0)
      const adoptionRate = totalOP > 0 ? ((totalType5 / totalOP) * 100).toFixed(2) : '0'

      const topFacilities = facilities
        .map((f) => {
          const fy69 = f.byYear['69']
          if (!fy69 || fy69.op === 0) return null
          return { name: f.hospname, rate: (fy69.type5 / fy69.op) * 100 }
        })
        .filter((x) => x !== null)
        .sort((a, b) => (b?.rate ?? 0) - (a?.rate ?? 0))
        .slice(0, 5)

      let reportTitle = ''
      let reportContent = ''

      if (reportType === 'monthly') {
        reportTitle = `Telemedicine Monthly Report - ${snapshotDate}`
        reportContent = `
EXECUTIVE SUMMARY
================
Overall Adoption Rate: ${adoptionRate}%
Total Facilities: ${facilities.length}
Telemedicine Services: ${totalType5.toLocaleString('th-TH')}
Total Outpatients: ${totalOP.toLocaleString('th-TH')}

TOP PERFORMERS
==============
${topFacilities.map((f, i) => `${i + 1}. ${f?.name}: ${f?.rate.toFixed(1)}%`).join('\n')}

KEY INSIGHTS
============
• Adoption shows steady progress across the province
• Top facilities serve as best practice examples
• Focus areas identified for improvement
• Recommend training for underperforming units
        `.trim()
      } else if (reportType === 'district') {
        reportTitle = `District Comparison Report - ${snapshotDate}`
        reportContent = `
District Performance Analysis
=============================
${facilities
  .map((f) => {
    const fy69 = f.byYear['69']
    if (!fy69 || fy69.op === 0) return null
    const rate = ((fy69.type5 / fy69.op) * 100).toFixed(1)
    return `${f.ampName}: ${rate}% (${fy69.type5}/${fy69.op})`
  })
  .filter((x) => x !== null)
  .slice(0, 10)
  .join('\n')}

Overall Province Rate: ${adoptionRate}%
Target Rate: 30%
Status: ${parseFloat(adoptionRate) >= 30 ? '✓ On Target' : '⚠ Below Target'}
        `.trim()
      } else {
        reportTitle = `Facility Performance Scorecard - ${snapshotDate}`
        reportContent = `
Individual Facility Performance
===============================
${facilities
  .map((f) => {
    const fy69 = f.byYear['69']
    if (!fy69) return null
    const rate = fy69.op > 0 ? ((fy69.type5 / fy69.op) * 100).toFixed(1) : 'N/A'
    return `${f.hospname} (${f.hostypeName})\nRate: ${rate}% | Services: ${fy69.type5} | OP: ${fy69.op}\n`
  })
  .filter((x) => x !== null)
  .slice(0, 20)
  .join('\n')}
        `.trim()
      }

      // Generate PDF
      await exportToPdf({
        filenameBase: `telemedicine-report-${reportType}-${snapshotDate}`,
        title: reportTitle,
        columns: [
          { key: 'text', label: 'Report Content', value: (row: any) => row },
        ],
        rows: [{ text: reportContent }],
      })

      toast.show(`${reportType} report generated successfully`, 'success')
    } catch (error) {
      toast.show('Failed to generate report', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-brand-300 bg-gradient-to-r from-brand-50 to-cyan-50 p-6 shadow-lg dark:border-brand-700 dark:from-slate-800 dark:to-slate-800">
      <h2 className="mb-4 text-xl font-bold text-brand-700 dark:text-brand-400">📄 Generate Report</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { type: 'monthly' as const, label: '📊 Monthly Summary', desc: 'Executive overview' },
            { type: 'district' as const, label: '🗺️ District Comparison', desc: 'By location' },
            { type: 'facility' as const, label: '🏥 Facility Scorecard', desc: 'Individual performance' },
          ].map((option) => (
            <button
              key={option.type}
              onClick={() => setReportType(option.type)}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                reportType === option.type
                  ? 'border-brand-500 bg-white dark:border-brand-600 dark:bg-slate-700'
                  : 'border-slate-200 bg-white/50 hover:border-brand-300 dark:border-slate-600 dark:bg-slate-800/50'
              }`}
            >
              <p className="font-semibold text-slate-800 dark:text-slate-100">{option.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</p>
            </button>
          ))}
        </div>

        <button
          onClick={generateReport}
          disabled={isGenerating}
          className="w-full rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 px-4 py-3 font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60"
        >
          {isGenerating ? '⏳ Generating...' : '📥 Generate & Download PDF'}
        </button>
      </div>
    </div>
  )
}

export default ReportGenerator
