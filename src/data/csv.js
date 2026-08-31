// ---- CSV export ------------------------------------------------------------
// Dependency-free CSV writer for the deal-level drill-downs, so a figure can be
// taken off the screen and reconciled in Excel line by line.
//
// Kept separate from exporters.js (which pulls in the whole query + PDF/Gamma
// stack as its own bundle chunk) so a drill-down button costs nothing but this.
//
// Money is written as a PLAIN NUMBER at full precision — never the compact
// "€111k" the screen shows — because the point of the export is that the column
// adds up to the figure it came from.

// RFC 4180 escaping: quote anything containing a comma, quote or newline, and
// double any embedded quotes. A leading =/+/-/@ is prefixed with a quote so
// Excel treats it as text rather than a formula.
function cell(v) {
  if (v == null) return ''
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// columns: [{ header, get }] — `get(row)` returns the raw value for that cell.
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(',')]
  for (const r of rows) lines.push(columns.map((c) => cell(c.get(r))).join(','))
  // \r\n + a UTF-8 BOM so Excel opens accented campaign names correctly.
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename, columns, rows) {
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Money for a spreadsheet: full precision, 2dp, no symbol or separators.
export const csvMoney = (n) => (n == null ? '' : Number(n).toFixed(2))
