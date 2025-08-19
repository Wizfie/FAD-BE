// Small date helper used by multiple views
function fmtDateToDDMMYYYY(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// helpers.js

function parseDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

// Helper function to get the start of the day
const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Helper function to get the end of the day
const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

// Helper function to parse various date formats (e.g., "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD", etc.)
const tryParseDate = (s) => {
  const t = s.trim()

  // YYYY-MM-DD or YYYY/MM/DD
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const yy = Number(m[1]),
      mm = Number(m[2]),
      dd = Number(m[3])
    const d = new Date(yy, mm - 1, dd)
    return d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null
  }

  // DD-MM-YYYY or DD/MM/YYYY
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const dd = Number(m[1]),
      mm = Number(m[2]),
      yy = Number(m[3])
    const d = new Date(yy, mm - 1, dd)
    return d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null
  }

  // NEW: DD/MM or DD-MM (without year) -> use current year
  m = t.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const now = new Date()
    const yy = now.getFullYear()
    const dd = Number(m[1]),
      mm = Number(m[2]) // DD/MM
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const d = new Date(yy, mm - 1, dd)
      return d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null
    }
  }

  return null
}

// Helper function to parse month-year format "YYYY-MM", "MM-YYYY"
const tryParseMonth = (s) => {
  const t = s.trim()

  // YYYY-MM or YYYY/MM
  let m = t.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) {
    const yy = Number(m[1]),
      mm = Number(m[2])
    if (mm >= 1 && mm <= 12) {
      const start = new Date(yy, mm - 1, 1, 0, 0, 0, 0)
      const end = new Date(yy, mm, 0, 23, 59, 59, 999)
      return { start, end }
    }
  }

  // MM-YYYY or MM/YYYY
  m = t.match(/^(\d{1,2})[-/](\d{4})$/)
  if (m) {
    const mm = Number(m[1]),
      yy = Number(m[2])
    if (mm >= 1 && mm <= 12) {
      const start = new Date(yy, mm - 1, 1, 0, 0, 0, 0)
      const end = new Date(yy, mm, 0, 23, 59, 59, 999)
      return { start, end }
    }
  }

  return null
}

export { startOfDay, endOfDay, tryParseDate, tryParseMonth, fmtDateToDDMMYYYY, parseDate }
