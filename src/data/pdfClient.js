// ---- Branded report PDF client (HTML → browser print → PDF) ----------------
// The app builds a CWSI-branded HTML document (the artifact design, filled with
// live scope-fresh figures + — for the board pack — the latest trace-passed
// narrative) and renders it to PDF through the BROWSER'S OWN print engine
// (printPdf.js). That engine is Chromium — the same renderer the previous n8n →
// Gotenberg round-trip used — so the output still matches the on-screen design
// and keeps selectable vector text, with no server, webhook or extra dependency
// to keep alive. The same three reports (Board Pack, KPI Register, Pipeline)
// share the one path; only the HTML builder differs.
// See boardPackHtml.js / reportHtml.js for the documents, printPdf.js for the render.

import { getBoardPack } from './boardPack'
import { getLatestBoardPack } from './boardPackClient'
import { buildBoardPackHtml } from './boardPackHtml'
import { buildKpiRegisterHtml, buildPipelineHtml } from './reportHtml'
import { assembleKpiRegister, assemblePipeline } from './exporters'
import { printHtmlToPdf } from './printPdf'
import { REGIONS } from './constants'
import { scopeLabel } from './kpiRegister'

const regionLabelOf = (region) => (REGIONS.find((r) => r.key === region || r.code === region) || REGIONS[0]).label

// Per-report filename stem; the HTML itself is built by the report-specific builder.
const FILE = { board: 'BoardPack', kpi: 'KPI_Register', pipeline: 'Pipeline' }

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

// Render the branded report to a PDF via the browser's print engine. Resolves once
// the print dialog is dismissed; the browser does not report whether the user saved
// or cancelled, so a resolved call means "handed off", not "file definitely on disk".
export async function generateReportPdf(report, filters = {}) {
  const built = await buildHtml(report, filters)
  const html = typeof built === 'string' ? built : built.html
  const generated = typeof built === 'string' ? null : built.generated
  const stamp = new Date().toISOString().slice(0, 10)
  // No .pdf extension: this becomes the printed document title, which the browser
  // pre-fills the save dialog with and then extends with .pdf itself.
  const filename = `CWSI_${FILE[report] || 'Report'}_${regionLabelOf(filters.region).replace(/\s+/g, '')}_${scopeLabel(filters.quarter)}_${stamp}`

  await printHtmlToPdf(html, { filename })
  return { pdf: true, print: true, hadNarrative: !!generated?.narrative && Object.keys(generated.narrative).length > 0 }
}
