// ---- Branded Board Pack HTML (Route 3: HTML → headless-Chrome PDF) ---------
// Builds the SAME CWSI-branded design as the approved artifact, filled with the
// live figure set + the latest trace-passed narrative, as a self-contained HTML
// string (inline CSS, embedded base64 logo). The app POSTs this to an n8n webhook
// that renders it via Gotenberg (Chromium) → a real, vector, selectable PDF that
// matches the artifact. See workflows/board_pack_pdf_render.json + pdfClient.js.
//
// Design tokens mirror brandKit.js / styles.css; the layout mirrors the artifact
// (docs reference). Nothing here computes figures — it only presents the pack.

import { hex, brand } from './brandKit'

// White CWSI wordmark (the artifact's cover logo), embedded so the render has no
// external fetch. Injected at build from docs/cwsi.png.
const LOGO = 'data:image/png;base64,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'

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Metric status → chip class + label (matches the dashboard traffic lights).
const CHIP = {
  'on-track': ['on', 'On track'],
  watch: ['watch', 'Watch'],
  behind: ['behind', 'Behind'],
  pending: ['pending', 'Pending data'],
  'no-target': ['pending', 'No target'],
}

function metricCard(m) {
  const [cls, label] = CHIP[m.status] || CHIP.pending
  const pct = m.status === 'pending' || m.pctOfTargetDisplay === 'n/a' ? '—' : m.pctOfTargetDisplay
  const trend = m.trend
    ? `<span class="qoq ${m.trend.dir}">${esc(m.trend.display)}</span>`
    : ''
  return `
    <div class="kpi">
      <div class="order mono">${String(m.order).padStart(2, '0')}</div>
      <div class="klabel">${esc(m.label)}</div>
      <div class="kval mono${m.status === 'pending' ? ' na' : ''}">${esc(m.valueDisplay)}</div>
      <div class="ktarget">Target · ${esc(m.targetDisplay)} · provisional${m.note ? ` · ${esc(m.note)}` : ''}</div>
      <div class="kfoot">
        <span class="kpct mono">${esc(pct)}${pct !== '—' ? ' of FY' : ''} ${trend}</span>
        <span class="chip ${cls}"><span class="pip"></span>${label}</span>
      </div>
    </div>`
}

// One narrative block (collapsed/expanded is a screen concern; in the PDF the full
// detailed paragraph is always shown). tone drives the accent colour.
const NARR = [
  ['onTrack', 'On Track', 'on'],
  ['behindAddressable', 'Behind & Addressable', 'watch'],
  ['channelInsights', 'Channel Insights', 'blue'],
  ['pipelineCommentary', 'Pipeline Commentary', 'blue'],
  ['riskFlags', 'Risks & Caveats', 'watch'],
  ['h2Plan', 'H2 Plan', 'blue'],
]

function narrativeStamp(generated) {
  const gen = generated?.generatedAt ? new Date(generated.generatedAt).toISOString().slice(0, 10) : ''
  return `AI narrative · generated ${esc(gen)}${generated?.model ? ` · ${esc(generated.model)}` : ''} · trace-to-data verified`
}

function narrativeSection(generated) {
  const n = generated?.narrative || {}
  const parts = NARR.filter(([k]) => n[k] && String(n[k]).trim())
  if (!parts.length) return ''
  const sections = parts
    .map(
      ([k, title, tone]) => `
      <div class="nsec ${tone}">
        <div class="ntag"><span class="npip"></span>${title}</div>
        <p>${esc(n[k])}</p>
      </div>`,
    )
    .join('')
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>AI Board Narrative</h2></div>
      ${sections}
      <div class="narr-foot">${narrativeStamp(generated)}</div>
    </section>`
}

function recommendationsSection(generated) {
  const recsList = generated?.recommendations || []
  if (!recsList.length) return ''
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Prioritised Recommendations</h2></div>
      <div class="recs">
        ${recsList
          .map(
            (r, i) => `
          <div class="rec">
            <div class="rnum mono">${i + 1}</div>
            <div class="rbody">
              <div class="rtitle">${esc(r.title)}</div>
              ${r.rationale ? `<div class="rrat">${esc(r.rationale)}</div>` : ''}
              <div class="rmeta">
                ${r.estimatedImpact ? `<span class="rchip">${esc(r.estimatedImpact)}</span>` : ''}
                ${r.metric ? `<span class="rchip neu">moves: ${esc(r.metric)}</span>` : ''}
              </div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </section>`
}

export function tableRows(rows) {
  return rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')
}

// Wrap inner HTML in a standard branded section with a ruled heading. Shared by
// the board pack and the KPI / Pipeline reports so every export reads identically.
export function block(title, inner) {
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>${esc(title)}</h2></div>
      ${inner}
    </section>`
}

function channelTable(channels) {
  if (!channels?.length) return ''
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Channel Contribution</h2></div>
      <table class="tbl">
        <thead><tr><th>Channel</th><th class="r">MQLs</th><th class="r">Pipeline</th><th class="r">Share</th><th class="r">Closed-won</th></tr></thead>
        <tbody>${tableRows(channels.map((c) => [c.channel, c.mqlDisplay, c.pipelineDisplay, c.pipelineShareDisplay, c.closedWonDisplay]))}</tbody>
      </table>
    </section>`
}

function regionTable(pack) {
  if (!pack.meta?.scopeIsAllRegions || !pack.regions?.length) return ''
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Regional Split</h2></div>
      <table class="tbl">
        <thead><tr><th>Region</th><th class="r">MQLs</th><th class="r">Pipeline</th><th class="r">Share</th><th class="r">Closed-won</th></tr></thead>
        <tbody>${tableRows(pack.regions.map((r) => [r.region, r.mqlDisplay, r.pipelineDisplay, r.pipelineShareDisplay, r.closedWonDisplay]))}</tbody>
      </table>
    </section>`
}

function pipelineHealth(ph) {
  if (!ph?.hasData) return ''
  const stageRows = ph.stages.map((s) => [s.stage, s.probability == null ? '—' : `${s.probability}%`, s.countDisplay, s.valueDisplay])
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Pipeline Health</h2></div>
      <table class="tbl">
        <thead><tr><th>Open-pipeline stage</th><th class="r">Probability</th><th class="r">Open opps</th><th class="r">Value</th></tr></thead>
        <tbody>
          ${tableRows(stageRows)}
          <tr class="total"><td>Total open</td><td class="r">—</td><td class="r">${esc(ph.openCountDisplay)}</td><td class="r">${esc(ph.openValueDisplay)}</td></tr>
          <tr class="total"><td>Weighted forecast (prob-adjusted)</td><td class="r">—</td><td class="r">—</td><td class="r">${esc(ph.weightedDisplay)}</td></tr>
        </tbody>
      </table>
      <div class="note">Current-state open-pipeline snapshot${ph.snapshotDate ? ` (${esc(ph.snapshotDate)})` : ''}, for the selected region — not limited to one quarter.</div>
    </section>`
}

function retentionBlock(r) {
  if (!r?.hasData) return ''
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Retention</h2></div>
      <table class="tbl">
        <thead><tr><th>Measure</th><th class="r">Count</th><th class="r">Value</th></tr></thead>
        <tbody>${tableRows([
          ['Retained contracts (won renewals)', r.retainedCountDisplay, r.retainedValueDisplay],
          ['Expansion (upsell + cross-sell)', r.expansionCountDisplay, r.expansionValueDisplay],
        ])}</tbody>
      </table>
    </section>`
}

function leversBlock(levers) {
  if (!levers?.length) return ''
  return `
    <section class="page-block">
      <div class="sec-head"><span class="rule"></span><h2>Gaps to Close — ranked by pipeline impact</h2></div>
      ${levers
        .map(
          (l, i) => `
        <div class="lever">
          <div class="lnum mono">${i + 1}</div>
          <div class="lbody"><div class="ltitle">${esc(l.title)}</div><div class="lgap">Gap: ${esc(l.gapDisplay)} · ${esc(l.basis)}</div></div>
          <div class="limpact">${esc(l.impactDisplay)}</div>
        </div>`,
        )
        .join('')}
    </section>`
}

// Shared CSS for every CWSI branded report (board pack + KPI / Pipeline). One
// token set + layout so the three exports are visually identical.
const STYLE = `
  @page { size: A4; margin: 0; }
  :root{
    --navy:${hex.navy}; --navy-deep:${hex.navyDeep}; --blue:${hex.blue}; --blue-soft:${hex.blueSoft};
    --ink:${hex.ink}; --mute:${hex.mute}; --line:${hex.line};
    --green:${hex.green}; --amber:${hex.amber}; --red:${hex.red};
  }
  *{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
  body{margin:0; font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--ink); font-size:12px; line-height:1.5;}
  .mono{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;}
  .pad{padding:34px 48px;}
  /* Sections flow across pages and fill them; only atomic units (cards, rows,
     levers, narrative blocks) stay unbroken, so there are no large white gaps.
     Consistent 48px side margin + roomy vertical rhythm keeps everything aligned. */
  .page-block{padding:18px 48px;}
  /* Natural flow: sections stack and fill each page top-to-bottom. This is robust
     to ANY data size — pages fill whether there are 3 pipeline stages or 30. The
     rules below stop ugly breaks: headers never orphan from their content, atomic
     units never split, and long tables continue with a repeated header row. */
  table.tbl{break-inside:auto;}
  thead{display:table-header-group;}
  tr{break-inside:avoid;}

  /* cover — fills the whole first page: brand at the top, title block anchored at
     the bottom (space-between), so the page reads as a designed cover with no empty
     gap. Hard page break after it. */
  .cover{background:linear-gradient(135deg,var(--navy) 0%,var(--navy-deep) 80%); color:#fff; padding:72px 56px; position:relative; overflow:hidden;
    min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; break-after:page;}
  .cover::after{content:''; position:absolute; right:-90px; top:-90px; width:320px; height:320px; background:radial-gradient(circle,rgba(20,113,230,.45),transparent 68%);}
  .cover img{height:34px; width:auto; display:block;}
  .eyebrow{text-transform:uppercase; letter-spacing:.16em; font-size:11px; font-weight:700; color:var(--blue-soft); margin-top:16px;}
  .cover h1{font-size:42px; line-height:1.1; font-weight:800; margin:0 0 16px; max-width:640px;}
  .scope{font-size:14px; color:#c9d8ec;}
  .confid{margin-top:28px; padding-top:18px; border-top:1px solid rgba(255,255,255,.16); font-size:10.5px; color:#9fb4d0; max-width:640px;}

  .sec-head{display:flex; align-items:center; gap:10px; margin:0 0 14px; break-after:avoid;}
  /* keep a section heading glued to the first block that follows it */
  section.page-block{break-inside:auto;}
  .sec-head .rule{width:26px; height:3px; border-radius:2px; background:var(--blue);}
  .sec-head h2{font-size:12px; text-transform:uppercase; letter-spacing:.12em; font-weight:800; color:var(--navy); margin:0;}

  /* KPI cards */
  /* keep the 7-card scorecard together so it doesn't split across a page break
     and intermix with the next section. */
  .kpi-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:12px; break-inside:avoid;}
  .kpi{border:1px solid var(--line); border-radius:10px; padding:14px 16px; position:relative; break-inside:avoid;}
  .kpi .order{position:absolute; top:12px; right:14px; font-size:10px; color:var(--blue-soft); font-weight:700;}
  .klabel{font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--mute); font-weight:700; margin-bottom:7px;}
  .kval{font-size:26px; font-weight:700; line-height:1;}
  .kval.na{color:var(--mute); font-size:18px;}
  .ktarget{font-size:10.5px; color:var(--mute); margin-top:6px;}
  .kfoot{display:flex; align-items:center; justify-content:space-between; margin-top:11px;}
  .kpct{font-size:11px; font-weight:700; color:var(--ink);}
  .qoq{font-size:10px; font-weight:700; padding:1px 5px; border-radius:5px; margin-left:4px;}
  .qoq.up{background:#dcfce7; color:#15803d;} .qoq.down{background:#fee2e2; color:#b91c1c;} .qoq.flat{background:#f1f5f9; color:var(--mute);}
  .chip{display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; padding:3px 8px; border-radius:999px;}
  .chip .pip{width:6px; height:6px; border-radius:50%;}
  .chip.on{background:#dcfce7; color:#15803d;} .chip.on .pip{background:var(--green);}
  .chip.watch{background:#fef3c7; color:#b45309;} .chip.watch .pip{background:var(--amber);}
  .chip.behind{background:#fee2e2; color:#b91c1c;} .chip.behind .pip{background:var(--red);}
  .chip.pending{background:#f1f5f9; color:var(--mute);} .chip.pending .pip{background:var(--mute);}

  /* stat strip — headline figures for the Pipeline report (lighter than KPI cards) */
  .stat-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:12px; break-inside:avoid;}
  .stat{border:1px solid var(--line); border-radius:10px; padding:13px 15px;}
  .stat .slabel{font-size:9.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--mute); font-weight:700; margin-bottom:6px;}
  .stat .sval{font-size:22px; font-weight:700; line-height:1; font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;}
  .stat .sval.na{color:var(--mute); font-size:15px;}

  /* narrative */
  .nsec{border-left:3px solid var(--line); padding:2px 0 8px 14px; margin-bottom:12px; break-inside:avoid;}
  .nsec.on{border-color:var(--green);} .nsec.watch{border-color:var(--amber);} .nsec.blue{border-color:var(--blue);}
  .ntag{display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:5px; color:var(--navy);}
  .npip{width:8px; height:8px; border-radius:50%; background:var(--blue);}
  .nsec.on .npip{background:var(--green);} .nsec.watch .npip{background:var(--amber);}
  .nsec p{margin:0; font-size:12px; color:#334155;}
  .narr-foot{font-size:9px; font-style:italic; color:var(--mute); margin-top:8px;}
  .recs{display:flex; flex-direction:column; gap:9px;}
  .rec{display:flex; gap:12px; break-inside:avoid;}
  .rnum{width:24px; height:24px; border-radius:7px; background:var(--navy); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex:none;}
  .rtitle{font-size:12px; font-weight:700;}
  .rrat{font-size:11px; color:#475569; margin-top:2px;}
  .rmeta{margin-top:4px; display:flex; gap:6px;}
  .rchip{font-size:9.5px; font-weight:700; color:var(--blue); background:#eaf2fe; padding:2px 7px; border-radius:999px;}
  .rchip.neu{color:var(--mute); background:#f1f5f9;}

  /* tables */
  table.tbl{width:100%; border-collapse:collapse;}
  .tbl th{font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--mute); text-align:left; padding:7px 8px; border-bottom:1px solid var(--line);}
  .tbl td{font-size:11.5px; padding:7px 8px; border-bottom:1px solid var(--line);}
  .tbl th.r,.tbl td.r{text-align:right;}
  .tbl td.na{color:var(--mute);}
  .tbl tr.total td{font-weight:700; background:#f6f9fd;}
  /* category band rows in the KPI register */
  .tbl tr.cat td{background:#e9f0fc; color:var(--navy); font-weight:800; text-transform:uppercase; letter-spacing:.05em; font-size:10px; padding:6px 8px;}
  .dot{width:7px; height:7px; border-radius:50%; display:inline-block; margin-left:6px; vertical-align:middle;}
  .dot.green{background:var(--green);} .dot.amber{background:var(--amber);} .dot.red{background:var(--red);} .dot.neu{background:var(--line);}
  .note{font-size:10px; color:var(--mute); font-style:italic; margin-top:8px;}

  /* levers */
  .lever{display:flex; gap:14px; padding:11px 0; border-bottom:1px solid var(--line); break-inside:avoid;}
  .lever:last-child{border-bottom:none;}
  .lnum{width:26px; height:26px; border-radius:7px; background:var(--navy); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex:none;}
  .ltitle{font-size:12px; font-weight:700;}
  .lgap{font-size:10.5px; color:var(--mute);}
  .limpact{font-size:13px; font-weight:700; color:var(--blue); align-self:center; white-space:nowrap;}

  .banner{display:flex; gap:9px; background:#fffbeb; border:1px solid #fde68a; border-radius:9px; padding:11px 14px; font-size:10.5px; color:#92400e; margin:0 0 18px;}
  /* slim footer — sits under the last section (never needs its own page) */
  .footer{margin:18px 48px 0; padding:12px 0 0; border-top:2px solid var(--navy); display:flex; justify-content:space-between; align-items:center; gap:14px; break-inside:avoid; break-before:avoid;}
  .footer .fw{font-weight:800; color:var(--navy); font-size:15px; letter-spacing:-.01em;}
  .footer .fw span{color:var(--blue);}
  .footer .meta{font-size:9px; color:var(--mute); text-align:right; line-height:1.6;}`

// Assemble a self-contained branded document: navy cover (logo + eyebrow + title +
// scope), then `body` flowing across pages, then the footer. Shared by every
// report so the cover / chrome is identical; only `body` differs per report.
export function pageShell({ title, eyebrow, h1, scopeLine, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title || 'CWSI Report')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body>
  <div class="cover">
    <div class="cover-top">
      <img src="${LOGO}" alt="CWSI">
      <div class="eyebrow">${esc(eyebrow)}</div>
    </div>
    <div class="cover-bottom">
      <h1>${esc(h1)}</h1>
      <div class="scope">${esc(scopeLine)}</div>
      <div class="confid">${esc(brand.confidentiality)}</div>
    </div>
  </div>

  <!-- Cover above (own page). Everything below flows continuously, filling each
       page top-to-bottom regardless of how much data the scope has. -->
  ${body}

  <div class="footer">
    <div class="fw">CWSI<span>.</span></div>
    <div class="meta">Generated ${new Date().toISOString().slice(0, 10)}<br>${esc(brand.confidentiality)}</div>
  </div>
</body></html>`
}

// Assemble the full self-contained Board Pack HTML for the renderer.
export function buildBoardPackHtml(pack, generated, { region, quarter } = {}) {
  const meta = pack.meta || {}
  const scopeLine = `${meta.regionLabel || 'All Regions'} · ${meta.quarterLabel || 'YTD'} · FY2026 · ${new Date().toISOString().slice(0, 10)}`
  const cards = pack.metrics.map(metricCard).join('')

  const kpiSection = `
    <section class="page-block">
      <div class="banner"><span>⚠</span><div><b>Provisional targets.</b> Target values are placeholders pending CWSI sign-off; actuals are live and trace-to-data verified. Status lights use the default 95% / 80% bands.</div></div>
      <div class="sec-head"><span class="rule"></span><h2>Top-line KPIs</h2></div>
      <div class="kpi-grid">${cards}</div>
    </section>`
  // Natural flow: emit sections in reading order and let them fill pages. Empty
  // sections return '' so nothing renders; the only forced break is after the
  // cover, so the layout adapts to however much data the scope contains.
  const flow = [
    kpiSection,
    channelTable(pack.channels),
    narrativeSection(generated),
    recommendationsSection(generated),
    leversBlock(pack.levers),
    pipelineHealth(pack.pipelineHealth),
    regionTable(pack),
    retentionBlock(pack.retention),
  ].join('\n')

  return pageShell({
    title: 'CWSI Board Pack',
    eyebrow: `${brand.tagline} · Board Pack`,
    h1: 'Marketing Performance — Board Review',
    scopeLine,
    body: flow,
  })
}
