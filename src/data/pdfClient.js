// ---- Branded report PDF client (Route 3: HTML → headless-Chrome PDF) -------
// The app builds a CWSI-branded HTML document (the artifact design, filled with
// live scope-fresh figures + — for the board pack — the latest trace-passed
// narrative), POSTs it to an n8n webhook that renders it through Gotenberg
// (Chromium) and returns the PDF as base64, then downloads it. The renderer is
// real Chrome, so the output matches the on-screen design AND keeps selectable
// vector text. ONE webhook (report-agnostic: it just renders whatever HTML it is
// given) serves the Board Pack, KPI Register and Pipeline reports.
// See workflows/board_pack_pdf_render.json + boardPackHtml.js / reportHtml.js.

import { getBoardPack } from './boardPack'
import { getLatestBoardPack } from './boardPackClient'
import { buildBoardPackHtml } from './boardPackHtml'
import { buildKpiRegisterHtml, buildPipelineHtml } from './reportHtml'
import { download, assembleKpiRegister, assemblePipeline } from './exporters'
import { REGIONS } from './constants'
import { scopeLabel } from './kpiRegister'

const WEBHOOK_URL = import.meta.env.VITE_BOARDPACK_PDF_WEBHOOK_URL

const regionLabelOf = (region) => (REGIONS.find((r) => r.key === region || r.code === region) || REGIONS[0]).label

// Per-report filename stem; the HTML itself is built by the report-specific builder.
const FILE = { board: 'BoardPack', kpi: 'KPI_Register', pipeline: 'Pipeline' }

// n8n "Respond to Webhook" may return the object directly, wrapped in an array, or
// under a `json` key — unwrap defensively (same handling as the other clients).
function unwrap(data) {
  if (Array.isArray(data)) data = data[0]
  if (data && data.json && !data.pdfBase64) data = data.json
  return data || {}
}

// base64 → Blob so the shared download() helper can save it.
function b64ToBlob(b64, mime) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Build the branded HTML for `report` at `filters` scope. Board pack mirrors the
// Board page (fresh figures + the latest TRACE-PASSED narrative, or figures-only
// if none published yet); KPI / Pipeline pull the same scoped data their pages show.
async function buildHtml(report, filters) {
  if (report === 'kpi') return buildKpiRegisterHtml(await assembleKpiRegister(filters), filters)
  if (report === 'pipeline') return buildPipelineHtml(await assemblePipeline(filters), filters)
  // board (default)
  const [pack, generated] = await Promise.all([
    getBoardPack(filters),
    getLatestBoardPack(filters).catch(() => null),
  ])
  return { html: buildBoardPackHtml(pack, generated, filters), generated }
}

// Render the branded report to a downloaded PDF via the Gotenberg webhook.
export async function generateReportPdf(report, filters = {}) {
  if (!WEBHOOK_URL) {
    throw new Error(
      'Branded-PDF endpoint not configured. Set VITE_BOARDPACK_PDF_WEBHOOK_URL in .env ' +
        '(the n8n Gotenberg webhook — see workflows/board_pack_pdf_render.json).',
    )
  }

  const built = await buildHtml(report, filters)
  const html = typeof built === 'string' ? built : built.html
  const generated = typeof built === 'string' ? null : built.generated
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `CWSI_${FILE[report] || 'Report'}_${regionLabelOf(filters.region).replace(/\s+/g, '')}_${scopeLabel(filters.quarter)}_${stamp}.pdf`

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Branded-PDF render failed (${res.status}). ${detail.slice(0, 200)}`)
  }

  const out = unwrap(await res.json())
  if (!out.pdfBase64) throw new Error('Branded-PDF endpoint returned no file (check the Gotenberg URL in n8n).')
  download(b64ToBlob(out.pdfBase64, 'application/pdf'), filename)
  return { pdf: true, hadNarrative: !!generated?.narrative && Object.keys(generated.narrative).length > 0 }
}
