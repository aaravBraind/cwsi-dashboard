// ---- Gamma board-pack deck client (PPTX via Gamma Generate API) -----------
// The app assembles a structured Markdown brief from the SAME figure set the
// screen shows + the latest TRACE-PASSED narrative, and POSTs it to an n8n
// webhook that calls Gamma's Generate API. Gamma renders an attractive,
// editable deck and exports it to .pptx; the workflow returns the file bytes
// and the app downloads it. See workflows/gamma-generation.json.
//
// CRITICAL — trace-to-data: the webhook MUST call Gamma with textMode:"preserve"
// (Gamma keeps the exact text, only adding structure) so the validated figures
// and the number-checked narrative can never be rewritten or invented. "generate"
// mode would let Gamma's model paraphrase/fabricate numbers and break the
// zero-invention guarantee the whole board pack rests on. The Markdown built here
// uses `\n---\n` card breaks, so the workflow also sets cardSplit:"inputTextBreaks"
// for a deterministic one-section-per-card deck.

import { getBoardPack } from './boardPack'
import { getLatestBoardPack } from './boardPackClient'
import { download, assembleKpiRegister, assemblePipeline } from './exporters'
import { brand } from './brandKit'
import { REGIONS } from './constants'
import { scopeLabel, periodOf, achievement, fmtTarget } from './kpiRegister'
import { gbp, num, isNA } from './format'

const WEBHOOK_URL = import.meta.env.VITE_GAMMA_WEBHOOK_URL
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const regionLabelOf = (region) => (REGIONS.find((r) => r.key === region || r.code === region) || REGIONS[0]).label

// Per-report filename stem (the prompt itself is built by the report-specific builder).
const FILE = { board: 'BoardPack', kpi: 'KPI_Register', pipeline: 'Pipeline' }
const scopeStr = (filters) => `${regionLabelOf(filters.region)} · ${scopeLabel(filters.quarter)} · FY2026`

// n8n "Respond to Webhook" may return the object directly, wrapped in an array, or
// under a `json` key — unwrap defensively (same handling as the other clients).
function unwrap(data) {
  if (Array.isArray(data)) data = data[0]
  if (data && data.json && data.status === undefined && data.generationId === undefined && !data.pptxBase64) data = data.json
  return data || {}
}

// base64 → Blob so the shared download() helper can save it.
function b64ToBlob(b64, mime) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Narrative sections in the agreed board order (mirrors boardPackHtml.js NARR).
const NARR = [
  ['onTrack', 'On Track'],
  ['behindAddressable', 'Behind & Addressable'],
  ['channelInsights', 'Channel Insights'],
  ['pipelineCommentary', 'Pipeline Commentary'],
  ['riskFlags', 'Risks & Caveats'],
  ['h2Plan', 'H2 Plan'],
]

const mdTable = (head, rows) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

// Build the deterministic Markdown brief. Each `\n---\n`-delimited block becomes
// one card. Values are the SAME pre-formatted display strings shown on screen, so
// the deck can never disagree with the dashboard. Empty sections are omitted.
export function buildBoardPackPrompt(pack, generated) {
  const meta = pack.meta || {}
  const scope = `${meta.regionLabel || 'All Regions'} · ${meta.quarterLabel || 'YTD'} · FY2026`
  const cards = []

  // Cover
  cards.push(
    `# CWSI Board Pack\n## Marketing Performance — Board Review\n${scope}\n\n_${brand.tagline} · Confidential — for board use only._`,
  )

  // Top-line KPIs
  const kpiRows = pack.metrics.map((m) => [
    String(m.order).padStart(2, '0'),
    m.label,
    m.valueDisplay,
    m.targetDisplay,
    m.pctOfTargetDisplay === 'n/a' ? '—' : m.pctOfTargetDisplay,
    m.trend ? m.trend.display : '—',
    m.status,
  ])
  cards.push(
    `## Top-line KPIs\n> Provisional targets — placeholder values pending CWSI sign-off; actuals are live and trace-to-data verified.\n\n${mdTable(
      ['#', 'Metric', 'Actual', 'Target', '% of FY', 'QoQ', 'Status'],
      kpiRows,
    )}`,
  )

  // Channel contribution
  if (pack.channels?.length) {
    cards.push(
      `## Channel Contribution\n\n${mdTable(
        ['Channel', 'MQLs', 'Pipeline', 'Share', 'Closed-won'],
        pack.channels.map((c) => [c.channel, c.mqlDisplay, c.pipelineDisplay, c.pipelineShareDisplay, c.closedWonDisplay]),
      )}`,
    )
  }

  // AI narrative (trace-passed) — one card carrying all present sections
  const n = generated?.narrative || {}
  const narrParts = NARR.filter(([k]) => n[k] && String(n[k]).trim())
  if (narrParts.length) {
    const gen = generated?.generatedAt ? new Date(generated.generatedAt).toISOString().slice(0, 10) : ''
    const body = narrParts.map(([k, title]) => `**${title}.** ${String(n[k]).trim()}`).join('\n\n')
    cards.push(
      `## AI Board Narrative\n\n${body}\n\n_AI narrative · generated ${gen}${generated?.model ? ` · ${generated.model}` : ''} · trace-to-data verified._`,
    )
  }

  // Prioritised recommendations
  if (generated?.recommendations?.length) {
    cards.push(
      `## Prioritised Recommendations\n\n${mdTable(
        ['#', 'Recommendation', 'Rationale', 'Impact', 'Moves'],
        generated.recommendations.map((r, i) => [
          i + 1,
          r.title || '',
          r.rationale || '',
          r.estimatedImpact || '',
          r.metric || '',
        ]),
      )}`,
    )
  }

  // Gaps to close (levers)
  if (pack.levers?.length) {
    cards.push(
      `## Gaps to Close — ranked by pipeline impact\n\n${mdTable(
        ['#', 'Lever', 'Gap', 'Basis', 'Est. impact'],
        pack.levers.map((l, i) => [i + 1, l.title, l.gapDisplay, l.basis, l.impactDisplay]),
      )}`,
    )
  }

  // Pipeline health
  const ph = pack.pipelineHealth
  if (ph?.hasData) {
    const rows = ph.stages.map((s) => [s.stage, s.probability == null ? '—' : `${s.probability}%`, s.countDisplay, s.valueDisplay])
    rows.push(['Total open', '—', ph.openCountDisplay, ph.openValueDisplay])
    rows.push(['Weighted forecast (prob-adjusted)', '—', '—', ph.weightedDisplay])
    cards.push(
      `## Pipeline Health\n\n${mdTable(['Open-pipeline stage', 'Probability', 'Open opps', 'Value'], rows)}\n\n_Current-state open-pipeline snapshot${
        ph.snapshotDate ? ` (${ph.snapshotDate})` : ''
      }, region-scoped — not a quarter slice._`,
    )
  }

  // Regional split (all-regions scope only)
  if (meta.scopeIsAllRegions && pack.regions?.length) {
    cards.push(
      `## Regional Split\n\n${mdTable(
        ['Region', 'MQLs', 'Pipeline', 'Share', 'Closed-won'],
        pack.regions.map((r) => [r.region, r.mqlDisplay, r.pipelineDisplay, r.pipelineShareDisplay, r.closedWonDisplay]),
      )}`,
    )
  }

  // Retention
  const ret = pack.retention
  if (ret?.hasData) {
    cards.push(
      `## Retention\n\n${mdTable(
        ['Measure', 'Count', 'Value'],
        [
          ['Retained contracts (won renewals)', ret.retainedCountDisplay, ret.retainedValueDisplay],
          ['Expansion (upsell + cross-sell)', ret.expansionCountDisplay, ret.expansionValueDisplay],
        ],
      )}`,
    )
  }

  return cards.join('\n\n---\n\n')
}

// KPI Register brief — one card per category, each a Markdown table of the SAME
// pre-formatted display strings the KPI Tracker page shows. preserve mode keeps
// every figure verbatim. `data` is the assembleKpiRegister() output.
export function buildKpiRegisterPrompt({ rows, targets, period, scope }, filters = {}) {
  const period_ = period || periodOf(filters.quarter)
  const scope_ = scope || scopeLabel(filters.quarter)
  const cards = [
    `# CWSI KPI Register\n## Actuals vs Targets — Board Review\n${scopeStr(filters)}\n\n_${brand.tagline} · Confidential — for board use only._`,
  ]

  const head = ['Metric', 'Actual', `Target · ${scope_}`, 'vs Target']
  let cat = null
  let acc = []
  const flush = () => {
    if (cat && acc.length)
      cards.push(`## ${cat}\n> Provisional targets — placeholder values pending CWSI sign-off; actuals are live and trace-to-data verified.\n\n${mdTable(head, acc)}`)
    acc = []
  }
  for (const r of rows) {
    if (r.t === 'cat') {
      flush()
      cat = r.label
      continue
    }
    const tg = targets[r.key] || {}
    const a = r.key ? achievement(tg, period_, r.num) : null
    acc.push([
      r.label,
      r.t === 'live' ? r.val : 'not available yet',
      tg.unit ? (fmtTarget(tg.unit, tg[period_]) ?? '—') : '—',
      a == null ? '—' : `${Math.round(a * 100)}%`,
    ])
  }
  flush()
  return cards.join('\n\n---\n\n')
}

// Pipeline Report brief — funnel summary + by-channel contribution. `data` is the
// assemblePipeline() output.
export function buildPipelinePrompt({ funnel, bySource }, filters = {}) {
  const f = funnel || {}
  const real = (v, fmt) => (isNA(v) || v == null ? '—' : fmt(v))
  const cards = [
    `# CWSI Pipeline Report\n## Marketing Pipeline — Board Review\n${scopeStr(filters)}\n\n_${brand.tagline} · Confidential — for board use only._`,
  ]

  cards.push(
    `## Pipeline Funnel\n\n${mdTable(
      ['Funnel stage', 'Value'],
      [
        ['Leads', real(f.leads, num)],
        ['MQLs', real(f.mql, num)],
        ['SQLs', real(f.sql, num)],
        ['Opportunities (open + won)', real(f.opp, num)],
        ['Closed-won (count)', real(f.closedWonCount, num)],
        ['Influenced pipeline', real(f.pipeline, gbp)],
        ['Closed-won value', real(f.closedWon, gbp)],
      ],
    )}`,
  )

  if (bySource?.length) {
    cards.push(
      `## By Channel\n\n${mdTable(
        ['Channel', 'Leads', 'MQL', 'SQL', 'Pipeline', 'Closed-won'],
        bySource.map((c) => [c.channel, real(c.leads, num), real(c.mql, num), real(c.sql, num), real(c.pipeline, gbp), real(c.closedWon, gbp)]),
      )}`,
    )
  }

  return cards.join('\n\n---\n\n')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// POST to the single Gamma webhook. {prompt} starts a generation; {generationId}
// polls one tick. n8n Cloud sits behind Cloudflare (~100s hard timeout), so we
// CANNOT hold one synchronous request open for the whole generation — instead we
// start, then poll in short calls that each return well inside the limit.
async function callWebhook(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gamma webhook failed (${res.status}). ${detail.slice(0, 200)}`)
  }
  return unwrap(await res.json())
}

// Build the Markdown brief for `report` at `filters` scope. Board pack mirrors the
// Board page (fresh figures + the latest TRACE-PASSED narrative, figures-only if
// none published); KPI / Pipeline pull the same scoped data their pages show.
async function buildPrompt(report, filters) {
  if (report === 'kpi') return { prompt: buildKpiRegisterPrompt(await assembleKpiRegister(filters), filters), generated: null }
  if (report === 'pipeline') return { prompt: buildPipelinePrompt(await assemblePipeline(filters), filters), generated: null }
  const [pack, generated] = await Promise.all([
    getBoardPack(filters),
    getLatestBoardPack(filters).catch(() => null),
  ])
  return { prompt: buildBoardPackPrompt(pack, generated), generated }
}

// Build the brief for `report` at `filters` scope and render it to a downloaded
// .pptx via Gamma (ONE report-agnostic webhook serves all reports). Transport is
// async: start → poll until completed. onProgress(attempt) is optional UI hook.
export async function generateReportPpt(report, filters = {}, { onProgress } = {}) {
  if (!WEBHOOK_URL) {
    throw new Error(
      'Gamma deck endpoint not configured. Set VITE_GAMMA_WEBHOOK_URL in .env ' +
        '(the n8n Gamma webhook — see workflows/gamma-generation.json).',
    )
  }

  const { prompt, generated } = await buildPrompt(report, filters)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `CWSI_${FILE[report] || 'Report'}_${regionLabelOf(filters.region).replace(/\s+/g, '')}_${scopeLabel(filters.quarter)}_${stamp}.pptx`

  // 1. Start the generation — returns fast with a generationId. `type` lets the
  //    n8n workflow tell the reports apart ('kpi' | 'board' | 'pipeline').
  const started = await callWebhook({ type: report, prompt, filename })
  const generationId = started.generationId
  if (!generationId) throw new Error('Gamma did not return a generationId (check the API key in n8n).')

  // 2. Poll until completed/failed. ~5 min budget (Gamma decks usually finish in
  //    1–3 min); each poll is a short request, so Cloudflare's 100s cap never bites.
  const POLL_MS = 10000
  const MAX_ATTEMPTS = 30
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_MS)
    onProgress?.(attempt)
    const out = await callWebhook({ generationId })
    if (out.status === 'failed') throw new Error('Gamma reported the generation failed.')
    if (out.status === 'completed') {
      if (!out.pptxBase64) throw new Error('Gamma completed but returned no file (check the export step in n8n).')
      download(b64ToBlob(out.pptxBase64, PPTX_MIME), filename)
      return { pptx: true, hadNarrative: !!generated?.narrative && Object.keys(generated.narrative).length > 0 }
    }
    // else status 'pending' / generating → keep polling
  }
  throw new Error('Gamma deck timed out (still generating after ~5 min). Try again, or check the n8n execution.')
}
