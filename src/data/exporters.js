// ---- T-8 Export layer ------------------------------------------------------
// One-click CSV / PDF / PPTX export for the KPI Register, Pipeline Report and
// Board Pack. Scope (region + quarter) is chosen per-export in the UI dialog and
// passed in here; every figure is fetched FRESH at that scope (not the global
// filter), so an export is self-contained and matches what it claims to show.
//
// Data fidelity: the KPI register rows come from the SAME builder the KPI Tracker
// page uses (kpiRegister.js), so the export can never drift from the screen.
// Actuals are real; targets are the (provisional) kpi_targets values.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import PptxGen from 'pptxgenjs'

import {
  getKpiTracker, getKpiTargets, getWebTraffic, getEventTypeFunnel, getEvents,
  getPipeline,
} from './queries'
import { getBoardPack } from './boardPack'
import { buildKpiRegisterRows, periodOf, scopeLabel, achievement } from './kpiRegister'
import { REGIONS } from './constants'
import { gbp, num, pct, isNA } from './format'

const BRAND = { navy: [10, 44, 82], blue: [20, 113, 230], ink: [15, 23, 42], mute: [120, 134, 156], line: [226, 232, 240] }
const regionLabelOf = (region) => (REGIONS.find((r) => r.key === region || r.code === region) || REGIONS[0]).label
const stamp = () => new Date().toISOString().slice(0, 10)
const fileBase = (report, region, quarter) =>
  `CWSI_${report}_${regionLabelOf(region).replace(/\s+/g, '')}_${scopeLabel(quarter)}_${stamp()}`

// Format a kpi_targets value by unit, for human-facing PDF/PPTX cells.
function fmtTarget(unit, t) {
  if (t == null) return '—'
  if (unit === 'gbp') return gbp(t)
  if (unit === 'rate') return `${(Number(t) * 100).toFixed(1)}%`
  if (unit === 'x') return `${Number(t).toFixed(1)}×`
  return num(t)
}
const pctStr = (a) => (a == null ? '—' : `${(a * 100).toFixed(0)}%`)

// ---- Data assembly (per scope) --------------------------------------------

async function assembleKpiRegister(filters) {
  const [kpi, webRes, events, evtRes, targets] = await Promise.all([
    getKpiTracker(filters),
    getWebTraffic(filters),
    getEventTypeFunnel(filters),
    getEvents(filters),
    getKpiTargets(),
  ])
  const rows = buildKpiRegisterRows({
    funnel: kpi.funnel,
    retention: kpi.retention,
    web: webRes?.totals,
    events,
    attendance: evtRes?.hasData ? evtRes.totals : null,
  })
  return { rows, targets, period: periodOf(filters.quarter), scope: scopeLabel(filters.quarter) }
}

async function assemblePipeline(filters) {
  const p = await getPipeline(filters)
  return { funnel: p.funnel, bySource: p.bySource || [] }
}

async function assembleBoardPack(filters) {
  return getBoardPack(filters)
}

// ---- CSV -------------------------------------------------------------------

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

function download(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function kpiRegisterCsv({ rows, targets, period, scope }, region, quarter) {
  const out = [[
    'Category', 'KPI', 'Actual', `% of ${scope} target`,
    'Target Q1', 'Target Q2', 'Target Q3', 'Target Q4', 'Target FY', 'Unit', 'Live',
  ]]
  let cat = ''
  for (const r of rows) {
    if (r.t === 'cat') { cat = r.label; continue }
    const tg = targets[r.key] || {}
    const a = r.key ? achievement(tg, period, r.num) : null
    out.push([
      cat, r.label,
      r.t === 'live' ? (r.num != null ? r.num : r.val) : 'not available yet',
      pctStr(a),
      tg.q1 ?? '', tg.q2 ?? '', tg.q3 ?? '', tg.q4 ?? '', tg.fy ?? '', tg.unit ?? '',
      r.t === 'live' ? 'yes' : 'no',
    ])
  }
  download(toCsv(out), `${fileBase('KPI_Register', region, quarter)}.csv`, 'text/csv;charset=utf-8')
}

function pipelineCsv({ funnel, bySource }, region, quarter) {
  const f = funnel || {}
  const real = (v) => (isNA(v) || v == null ? '' : v)
  const out = [['Section', 'Metric', 'Value']]
  out.push(['Funnel', 'Leads', real(f.leads)])
  out.push(['Funnel', 'MQLs', real(f.mql)])
  out.push(['Funnel', 'SQLs', real(f.sql)])
  out.push(['Funnel', 'Opportunities', real(f.opp)])
  out.push(['Funnel', 'Closed-won (count)', real(f.closedWonCount)])
  out.push(['Funnel', 'Influenced pipeline (GBP)', real(f.pipeline)])
  out.push(['Funnel', 'Closed-won value (GBP)', real(f.closedWon)])
  out.push([])
  out.push(['By channel', 'Channel', 'Leads', 'MQL', 'SQL', 'Pipeline (GBP)', 'Closed-won (GBP)'])
  for (const c of bySource) out.push(['', c.channel, real(c.leads), real(c.mql), real(c.sql), real(c.pipeline), real(c.closedWon)])
  download(toCsv(out), `${fileBase('Pipeline', region, quarter)}.csv`, 'text/csv;charset=utf-8')
}

// ---- PDF -------------------------------------------------------------------

function pdfHeader(doc, title, region, quarter) {
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('CWSI', 40, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.setTextColor(207, 225, 247)
  doc.text('Marketing Intelligence', 82, 26)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(title, 40, 45)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(207, 225, 247)
  doc.text(`${regionLabelOf(region)} · ${scopeLabel(quarter)} · FY2026 · generated ${stamp()}`, 40, 45, { align: 'left', maxWidth: 400 })
  // right-aligned scope on the same band
  const w = doc.internal.pageSize.getWidth()
  doc.text(`${regionLabelOf(region)} · ${scopeLabel(quarter)}`, w - 40, 26, { align: 'right' })
}

function pdfFooterNote(doc, note) {
  const h = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...BRAND.mute)
  doc.text(note, 40, h - 24, { maxWidth: doc.internal.pageSize.getWidth() - 80 })
}

function kpiRegisterPdf({ rows, targets, period, scope }, region, quarter) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  pdfHeader(doc, 'KPI Register', region, quarter)
  const body = []
  let cat = ''
  for (const r of rows) {
    if (r.t === 'cat') { cat = r.label; body.push([{ content: cat, colSpan: 4, styles: { fillColor: [233, 240, 252], textColor: BRAND.navy, fontStyle: 'bold' } }]); continue }
    const tg = targets[r.key] || {}
    const a = r.key ? achievement(tg, period, r.num) : null
    body.push([
      r.label,
      r.t === 'live' ? r.val : 'not available yet',
      tg.unit ? fmtTarget(tg.unit, tg[period]) : '—',
      pctStr(a),
    ])
  }
  autoTable(doc, {
    startY: 70,
    head: [['Metric', 'Actual', `Target · ${scope}`, 'vs Target']],
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: BRAND.ink, lineColor: BRAND.line },
    headStyles: { fillColor: BRAND.blue, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' } },
    margin: { left: 40, right: 40 },
  })
  pdfFooterNote(doc, 'Actuals are live from the warehouse. Targets are provisional placeholders until CWSI enters the final register.')
  doc.save(`${fileBase('KPI_Register', region, quarter)}.pdf`)
}

function pipelinePdf({ funnel, bySource }, region, quarter) {
  const f = funnel || {}
  const real = (v, fmt) => (isNA(v) || v == null ? '—' : fmt(v))
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  pdfHeader(doc, 'Pipeline Report', region, quarter)
  autoTable(doc, {
    startY: 70,
    head: [['Funnel stage', 'Value']],
    body: [
      ['Leads', real(f.leads, num)],
      ['MQLs', real(f.mql, num)],
      ['SQLs', real(f.sql, num)],
      ['Opportunities (open + won)', real(f.opp, num)],
      ['Closed-won (count)', real(f.closedWonCount, num)],
      ['Influenced pipeline', real(f.pipeline, gbp)],
      ['Closed-won value', real(f.closedWon, gbp)],
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 5, textColor: BRAND.ink, lineColor: BRAND.line },
    headStyles: { fillColor: BRAND.blue, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  })
  autoTable(doc, {
    head: [['Channel', 'Leads', 'MQL', 'SQL', 'Pipeline', 'Closed-won']],
    body: bySource.map((c) => [c.channel, real(c.leads, num), real(c.mql, num), real(c.sql, num), real(c.pipeline, gbp), real(c.closedWon, gbp)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: BRAND.ink, lineColor: BRAND.line },
    headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  })
  doc.save(`${fileBase('Pipeline', region, quarter)}.pdf`)
}

function boardPackPdf(pack, region, quarter) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  pdfHeader(doc, 'Board Pack — Figure Set', region, quarter)
  autoTable(doc, {
    startY: 70,
    head: [['#', 'Metric', 'Actual', 'Target', 'Status']],
    body: pack.metrics.map((m) => [m.order, m.label, m.valueDisplay, m.targetDisplay, m.status]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 5, textColor: BRAND.ink, lineColor: BRAND.line },
    headStyles: { fillColor: BRAND.blue, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center', cellWidth: 24 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
    margin: { left: 40, right: 40 },
  })
  if (pack.levers?.length)
    autoTable(doc, {
      head: [['Gap to close (ranked by pipeline impact)', 'Gap', 'Est. impact']],
      body: pack.levers.map((l) => [l.title, l.gapDisplay, l.impactDisplay]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: BRAND.ink, lineColor: BRAND.line },
      headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
  pdfFooterNote(doc, 'Figure set with trace-to-data discipline. Targets provisional. Generate the AI narrative on the Board Pack page.')
  doc.save(`${fileBase('Board_Pack', region, quarter)}.pdf`)
}

// ---- PPTX ------------------------------------------------------------------

function deckTitle(pptx, title, region, quarter) {
  const s = pptx.addSlide()
  s.background = { color: '0A2C52' }
  s.addText('CWSI', { x: 0.5, y: 0.5, fontSize: 20, bold: true, color: 'FFFFFF' })
  s.addText('Marketing Intelligence', { x: 1.6, y: 0.57, fontSize: 13, color: 'CFE1F7' })
  s.addText(title, { x: 0.5, y: 2.4, w: 9, fontSize: 34, bold: true, color: 'FFFFFF' })
  s.addText(`${regionLabelOf(region)}  ·  ${scopeLabel(quarter)}  ·  FY2026  ·  ${stamp()}`, { x: 0.5, y: 3.4, w: 9, fontSize: 14, color: 'CFE1F7' })
  return pptx
}

function tableSlide(pptx, title, head, body, note) {
  const s = pptx.addSlide()
  s.addText(title, { x: 0.4, y: 0.3, fontSize: 18, bold: true, color: '0A2C52' })
  const rows = [head.map((h) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: '1471E6' } }))]
  body.forEach((r) => rows.push(r.map((c) => ({ text: String(c ?? '—'), options: { color: '0F1729' } }))))
  s.addTable(rows, { x: 0.4, y: 0.9, w: 9.2, fontSize: 10, border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, autoPage: true, autoPageRepeatHeader: true })
  if (note) s.addText(note, { x: 0.4, y: 6.9, w: 9.2, fontSize: 8, italic: true, color: '78869C' })
}

async function kpiRegisterPptx({ rows, targets, period, scope }, region, quarter) {
  const pptx = new PptxGen()
  pptx.defineLayout({ name: 'W', width: 10, height: 7.5 }); pptx.layout = 'W'
  deckTitle(pptx, 'KPI Register', region, quarter)
  const body = []
  for (const r of rows) {
    if (r.t === 'cat') { body.push([{ text: r.label, options: { bold: true, color: '0A2C52', fill: 'E9F0FC', colspan: 4 } }]); continue }
    const tg = targets[r.key] || {}
    const a = r.key ? achievement(tg, period, r.num) : null
    body.push([r.label, r.t === 'live' ? r.val : 'n/a', tg.unit ? fmtTarget(tg.unit, tg[period]) : '—', pctStr(a)])
  }
  tableSlide(pptx, `KPI Register · Target ${scope}`, ['Metric', 'Actual', `Target · ${scope}`, 'vs Target'], body, 'Actuals live; targets provisional.')
  await pptx.writeFile({ fileName: `${fileBase('KPI_Register', region, quarter)}.pptx` })
}

async function boardPackPptx(pack, region, quarter) {
  const pptx = new PptxGen()
  pptx.defineLayout({ name: 'W', width: 10, height: 7.5 }); pptx.layout = 'W'
  deckTitle(pptx, 'Board Pack', region, quarter)
  tableSlide(pptx, 'Top-line metrics (agreed order)',
    ['#', 'Metric', 'Actual', 'Target', 'Status'],
    pack.metrics.map((m) => [m.order, m.label, m.valueDisplay, m.targetDisplay, m.status]),
    'Targets provisional. Generate the AI narrative on the Board Pack page.')
  if (pack.levers?.length)
    tableSlide(pptx, 'Gaps to close — ranked by pipeline impact',
      ['Lever', 'Gap', 'Est. impact'],
      pack.levers.map((l) => [l.title, l.gapDisplay, l.impactDisplay]))
  await pptx.writeFile({ fileName: `${fileBase('Board_Pack', region, quarter)}.pptx` })
}

// ---- Dispatcher ------------------------------------------------------------
// report ∈ 'kpi' | 'pipeline' | 'board'; format ∈ 'CSV' | 'PDF' | 'PPTX'.
export async function runExport({ report, format, region, quarter }) {
  const filters = { region, quarter }
  if (report === 'kpi') {
    if (format === 'CSV') return kpiRegisterCsv(await assembleKpiRegister(filters), region, quarter)
    if (format === 'PDF') return kpiRegisterPdf(await assembleKpiRegister(filters), region, quarter)
    if (format === 'PPTX') return kpiRegisterPptx(await assembleKpiRegister(filters), region, quarter)
  }
  if (report === 'pipeline') {
    if (format === 'CSV') return pipelineCsv(await assemblePipeline(filters), region, quarter)
    if (format === 'PDF') return pipelinePdf(await assemblePipeline(filters), region, quarter)
  }
  if (report === 'board') {
    if (format === 'PDF') return boardPackPdf(await assembleBoardPack(filters), region, quarter)
    if (format === 'PPTX') return boardPackPptx(await assembleBoardPack(filters), region, quarter)
  }
  throw new Error(`Unsupported export: ${report}/${format}`)
}
