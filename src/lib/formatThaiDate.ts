const THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

/** Formats an ISO date (YYYY-MM-DD) as a Thai Buddhist-era date, e.g. "18 มิ.ย. 2569". */
export function formatThaiDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate

  const day = d.getDate()
  const month = THAI_MONTHS[d.getMonth()]
  const buddhistYear = d.getFullYear() + 543
  return `${day} ${month} ${buddhistYear}`
}
