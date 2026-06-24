// ---- Branded KPI Register / Pipeline HTML (HTML → headless-Chrome PDF) ------
// Builds the SAME CWSI-branded design as the board pack (shared cover + CSS +
// footer from boardPackHtml.js), filled with the live, scope-fresh figures for the
// KPI Register and Pipeline reports. The app POSTs these to the same n8n Gotenberg
// webhook the board pack uses → a real vector, selectable PDF. See pdfClient.js.
//
// Nothing here computes figures — it only presents the already-assembled data the
// KPI Tracker / Pipeline pages show, so an export can never disagree with a screen.

import { pageShell, esc, tableRows, block } from './boardPackHtml'
import { brand } from './brandKit'
import { REGIONS } from './constants'
import { scopeLabel, periodOf, achievement, fmtTarget } from './kpiRegister'
import { gbp, num, isNA } from './format'

const regionLabelOf = (region) => (REGIONS.find((r) => r.key === region || r.code === region) || REGIONS[0]).label
const scopeLineOf = (region, quarter) =>
  `${regionLabelOf(region)} · ${scopeLabel(quarter)} · FY2026 · ${new Date().toISOString().slice(0, 10)}`

// Achievement fraction → status dot (matches the dashboard's 95% / 80% bands).
const dotOf = (a) => (a == null ? 'neu' : a >= 0.95 ? 'green' : a >= 0.8 ? 'amber' : 'red')

// ---- KPI Register ----------------------------------------------------------
// Grouped register table: category band rows + metric rows (Actual / Target ·
// scope / vs Target with a status dot). Mirrors the KPI Tracker page + the prior
// jsPDF export, in the branded shell.
export function buildKpiRegisterHtml({ rows, targets, period, scope }, { region, quarter } = {}) {
  const period_ = period || periodOf(quarter)
  const scope_ = scope || scopeLabel(quarter)

  const trs = []
  for (const r of rows) {
    if (r.t === 'cat') {
      trs.push(`<tr class="cat"><td colspan="4">${esc(r.label)}</td></tr>`)
      continue
    }
    const tg = targets[r.key] || {}
    const a = r.key ? achievement(tg, period_, r.num) : null
    const live = r.t === 'live'
    const actual = live ? r.val : 'not available yet'
    const target = tg.unit ? (fmtTarget(tg.unit, tg[period_]) ?? '—') : '—'
    const pct = a == null ? '—' : `${Math.round(a * 100)}%`
    const dot = live && r.key ? dotOf(a) : 'neu'
    trs.push(
      `<tr>` +
        `<td>${esc(r.label)}</td>` +
        `<td class="r${live ? '' : ' na'}">${esc(actual)}</td>` +
        `<td class="r">${esc(target)}</td>` +
        `<td class="r">${esc(pct)}<span class="dot ${dot}"></span></td>` +
      `</tr>`,
    )
  }

  const banner = `<div class="banner"><span>⚠</span><div><b>Provisional targets.</b> Target values are placeholders pending CWSI sign-off; actuals are live and trace-to-data verified. Status dots use the default 95% / 80% bands.</div></div>`
  const table = `
    <table class="tbl">
      <thead><tr><th>Metric</th><th class="r">Actual</th><th class="r">Target · ${esc(scope_)}</th><th class="r">vs Target</th></tr></thead>
      <tbody>${trs.join('')}</tbody>
    </table>`
  const body = `
    <section class="page-block">
      ${banner}
      <div class="sec-head"><span class="rule"></span><h2>KPI Register</h2></div>
      ${table}
    </section>`

  return pageShell({
    title: 'CWSI KPI Register',
    eyebrow: `${brand.tagline} · KPI Register`,
    h1: 'KPI Register — Actuals vs Targets',
    scopeLine: scopeLineOf(region, quarter),
    body,
  })
}

// ---- Pipeline Report -------------------------------------------------------
// Headline funnel stat strip + by-channel contribution table. Mirrors the prior
// jsPDF export, in the branded shell.
export function buildPipelineHtml({ funnel, bySource }, { region, quarter } = {}) {
  const f = funnel || {}
  const real = (v, fmt) => (isNA(v) || v == null ? '—' : fmt(v))

  const stats = [
    ['Total leads', real(f.leads, num)],
    ['MQLs', real(f.mql, num)],
    ['SQLs', real(f.sql, num)],
    ['Opportunities', real(f.opp, num)],
    ['Closed-won (count)', real(f.closedWonCount, num)],
    ['Influenced pipeline', real(f.pipeline, gbp)],
    ['Closed-won value', real(f.closedWon, gbp)],
  ]
  const statCards = stats
    .map(([l, v]) => `<div class="stat"><div class="slabel">${esc(l)}</div><div class="sval${v === '—' ? ' na' : ''}">${esc(v)}</div></div>`)
    .join('')
  const funnelSection = block('Pipeline Funnel', `<div class="stat-grid">${statCards}</div>`)

  const channelSection = bySource?.length
    ? block(
        'By Channel',
        `<table class="tbl">
          <thead><tr><th>Channel</th><th class="r">Leads</th><th class="r">MQL</th><th class="r">SQL</th><th class="r">Pipeline</th><th class="r">Closed-won</th></tr></thead>
          <tbody>${tableRows(
            bySource.map((c) => [c.channel, real(c.leads, num), real(c.mql, num), real(c.sql, num), real(c.pipeline, gbp), real(c.closedWon, gbp)]),
          )}</tbody>
        </table>`,
      )
    : ''

  return pageShell({
    title: 'CWSI Pipeline Report',
    eyebrow: `${brand.tagline} · Pipeline Report`,
    h1: 'Pipeline Performance Report',
    scopeLine: scopeLineOf(region, quarter),
    body: funnelSection + channelSection,
  })
}
