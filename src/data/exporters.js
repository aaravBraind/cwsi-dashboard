// ---- T-8 Export layer ------------------------------------------------------
// One-click PDF / PPTX export for the KPI Register, Pipeline Report and Board
// Pack. Every report now uses the SAME two branded routes:
//   • PDF  — CWSI-branded HTML → the browser's own print engine → vector PDF that
//            matches the on-screen design (printPdf.js + pdfClient.js + *Html.js).
//   • PPTX — an attractive, editable Gamma deck via n8n, preserve-mode so figures
//            are kept verbatim and never paraphrased (gammaClient.js).
// The PDF path is report-agnostic (it prints whatever HTML it is handed) and needs no
// server at all; the Gamma webhook likewise renders whatever Markdown it is given, so
// all three reports share the one path each.
//
// Scope (region + quarter) is chosen per-export in the UI dialog and passed in
// here; every figure is fetched FRESH at that scope (not the global filter), so an
// export is self-contained and matches what it claims to show. The KPI register
// rows come from the SAME builder the KPI Tracker page uses (kpiRegister.js), so an
// export can never drift from the screen. Actuals are real; targets are the
// (provisional) kpi_targets values.

import {
  getKpiTracker, getKpiTargets, getWebTraffic, getEventTypeFunnel, getEvents,
  getPipeline, getOutreach, getOutreachAttributedMeetings,
  getLinkedInSnapshot, getAeEmailEngagement, getEventAttendance,
  getEmailReport, getChannel, getLinkedInPage, getKpiManual, getOrganicTrafficGrowth,
} from './queries'
import { buildKpiRegisterRows, periodOf, scopeLabel } from './kpiRegister'

// ---- Download helper -------------------------------------------------------
// Shared by the PDF / Gamma clients to save the bytes the webhooks return. Kept
// here (a light, dependency-free module) so the clients can import one helper.
export function download(content, filename, mime) {
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

// ---- Data assembly (per scope) --------------------------------------------
// Exported so the PDF / Gamma clients build their documents from the exact same
// scoped figures, mirroring the dashboard pages.

export async function assembleKpiRegister(filters) {
  const [kpi, webRes, events, evtRes, targets, outreach, outreachMeetings, linkedin, aeEmail, eventAttendance, emailReport, webChannel, eventsChannel, linkedinPage, manual, organicGrowth] = await Promise.all([
    getKpiTracker(filters),
    getWebTraffic(filters),
    getEventTypeFunnel(filters),
    getEvents(filters),
    getKpiTargets(),
    getOutreach({ region: filters.region }),
    getOutreachAttributedMeetings(filters),
    getLinkedInSnapshot(filters),
    getAeEmailEngagement(filters),
    getEventAttendance(filters),
    getEmailReport(filters),
    getChannel('Organic SEO', filters, ['Content/White Paper']),
    getChannel('Events & Webinars', filters),
    // linkedinPage was missing here, so the LinkedIn engagement-rate and follower-growth
    // rows exported as "not available yet" while the screen showed real figures.
    getLinkedInPage(filters),
    getKpiManual(),
    getOrganicTrafficGrowth(filters),
  ])
  const rows = buildKpiRegisterRows({
    funnel: kpi.funnel,
    retention: kpi.retention,
    web: webRes?.totals,
    events,
    attendance: evtRes?.hasData ? evtRes.totals : null,
    outreach,
    outreachMeetings,
    linkedin,
    aeEmail,
    eventAttendance: eventAttendance?.hasData ? eventAttendance : null,
    emailFunnel: emailReport?.totals,
    webFunnel: webChannel?.totals,
    eventsFunnel: eventsChannel?.totals,
    linkedinPage,
    manual,
    organicGrowth,
    period: periodOf(filters.quarter),
  })
  return { rows, targets, period: periodOf(filters.quarter), scope: scopeLabel(filters.quarter) }
}

export async function assemblePipeline(filters) {
  const p = await getPipeline(filters)
  return { funnel: p.funnel, bySource: p.bySource || [] }
}

// ---- Dispatcher ------------------------------------------------------------
// report ∈ 'kpi' | 'pipeline' | 'board'; format ∈ 'PDF' | 'BRANDED' | 'PPTX'.
// 'PDF' (kpi/pipeline) and 'BRANDED' (board) are the same branded print-to-PDF;
// 'PPTX' is the Gamma deck. Clients are lazy-imported so the render libraries stay
// off the dashboard bundle until an export is actually triggered.
export async function runExport({ report, format, region, quarter }) {
  const filters = { region, quarter }

  if (format === 'PDF' || format === 'BRANDED') {
    const { generateReportPdf } = await import('./pdfClient')
    return generateReportPdf(report, filters)
  }
  if (format === 'PPTX') {
    const { generateReportPpt } = await import('./gammaClient')
    return generateReportPpt(report, filters)
  }
  throw new Error(`Unsupported export: ${report}/${format}`)
}
