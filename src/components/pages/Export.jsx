import { useState } from 'react'
import { useFilters } from '../../filters/FilterContext'
import { REGIONS, QUARTER_PILLS } from '../../data/constants'
import { I } from '../icons'

// The exporter module is loaded ON DEMAND — only when the user actually triggers an
// export — keeping the report builders out of the initial dashboard bundle.

// Export. Each format button opens a small dialog that asks for the region +
// quarter scope (defaulting to the current view), then generates the file: the PDF
// via the browser's print-to-PDF (printPdf.js), the deck via Gamma. Every figure is
// fetched fresh at the chosen scope, so the file is self-contained.

const REPORTS = [
  { id: 'kpi', title: 'Full KPI Register', sub: 'Every KPI · actual vs target · status', formats: ['PDF', 'PPTX'] },
  { id: 'board', title: 'Board Pack', sub: 'Branded board pack — figures, detail + AI narrative', formats: ['BRANDED', 'PPTX'] },
  { id: 'pipeline', title: 'Pipeline Report', sub: 'Funnel + by-channel breakdown', formats: ['PDF', 'PPTX'] },
  // Margot, 3 Sep: every record behind every figure, so the dashboard can be checked
  // rather than trusted. Excel, not PDF — it exists to be filtered and summed.
  { id: 'verification', title: 'All Underlying Data', sub: 'Every record behind every figure · for checking the dashboard', formats: ['XLSX'] },
  // Margot, 8 Sep: the campaigns behind each number, for every period at once.
  { id: 'composition', title: 'Full Calculation & Composition Report', sub: 'Every figure: source, method, and every contributing campaign · all periods in one document', formats: ['COMPOSITION'] },
]

// Every report offers the same two branded routes:
//   PDF ('BRANDED' on the board, 'PDF' elsewhere) = artifact-matching HTML rendered
//     by the browser's own print engine — vector, selectable text, no server.
//   PPTX = the attractive, editable Gamma deck via n8n (preserve-mode, figures kept
//     verbatim). 'BRANDED' is surfaced simply as "PDF".
const FORMAT_LABEL = { BRANDED: 'PDF', XLSX: 'Excel', COMPOSITION: 'Report' }
const fmtLabel = (f) => FORMAT_LABEL[f] || f

export default function Export() {
  const { filters } = useFilters()
  const [dlg, setDlg] = useState(null) // { report, title, format }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Export <span className="accent">Data</span></div>
          <div className="page-sub">Export any report as a branded PDF or an editable PPTX deck — pick the region &amp; quarter at export</div>
        </div>
      </div>

      <div className="cols-3">
        {REPORTS.map((r) => (
          <div className="panel" style={{ marginBottom: 0 }} key={r.id}>
            <div className="panel-head">
              <div className="left">
                <div className="panel-title">{r.title}</div>
                <div className="panel-sub">{r.sub}</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="export-formats">
                {r.formats.map((fmt, i) => (
                  <button
                    className={`btn${i === 0 ? ' primary' : ''}`}
                    onClick={() => setDlg({ report: r.id, title: r.title, format: fmt })}
                    key={fmt}
                  >
                    <svg className="icon icon-sm" viewBox="0 0 24 24">{I.download}</svg>
                    {fmtLabel(fmt)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {dlg && (
        <ExportDialog
          {...dlg}
          defaultRegion={filters.region || 'all'}
          defaultQuarter={filters.quarter || 'ytd'}
          onClose={() => setDlg(null)}
        />
      )}
    </>
  )
}

function ExportDialog({ report, title, format, defaultRegion, defaultQuarter, onClose }) {
  const [region, setRegion] = useState(defaultRegion)
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // The full report makes a few hundred queries; a silent minute reads as a hang, so it
  // reports how far through it is.
  const [prog, setProg] = useState(null)

  const go = async () => {
    setBusy(true)
    setErr(null)
    setProg(null)
    try {
      const { runExport } = await import('../../data/exporters')
      await runExport({ report, format, region, quarter, onProgress: (d, t) => setProg({ d, t }) })
      onClose()
    } catch (e) {
      setErr(e?.message || 'Export failed — please try again.')
      setBusy(false)
      setProg(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Export {title}<span className="fmt">{fmtLabel(format)}</span></div>
            <div className="modal-sub">Choose the scope — figures are pulled fresh for this selection.</div>
          </div>
          <button className="modal-x" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>Region</label>
            <select className="modal-select" value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy}>
              {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Quarter</label>
            <select className="modal-select" value={quarter} onChange={(e) => setQuarter(e.target.value)} disabled={busy}>
              {QUARTER_PILLS.map((q) => (
                <option key={q.q} value={q.q}>{q.q === 'ytd' ? 'YTD (full year)' : `${q.label} 2026`}</option>
              ))}
            </select>
          </div>

          {report === 'board' && format === 'BRANDED' && (
            <div className="modal-note">
              Renders the <strong>CWSI-branded board pack</strong> (matches the on-screen design) as a PDF — figures, detail sections and the saved AI narrative. Generate the narrative on the Board Pack page first for this scope so it's included.
            </div>
          )}
          {report === 'board' && format === 'PPTX' && (
            <div className="modal-note">
              Renders an <strong>editable PowerPoint deck</strong> (.pptx) from the live figures + the latest source-checked AI narrative — kept verbatim, never paraphrased. Generate the narrative on the Board Pack page first for this scope so it's included.
            </div>
          )}
          {format === 'XLSX' && (
            <div className="modal-note">
              Produces an <strong>Excel workbook</strong>: one sheet per data source (deals, campaign
              funnel, web traffic, LinkedIn, email, meetings, spend), plus a <strong>Figures</strong> sheet
              listing every headline number with the sheet and filter that reproduces it. Start there.
              The <strong>Read me</strong> sheet covers the four things that make a hand tally differ.
            </div>
          )}
          {report !== 'board' && format === 'PDF' && (
            <div className="modal-note">
              Renders a <strong>CWSI-branded PDF</strong> (matches the on-screen design) — figures are pulled fresh for this scope and checked against the source data.
            </div>
          )}
          {report !== 'board' && format === 'PPTX' && (
            <div className="modal-note">
              Renders an <strong>editable PowerPoint deck</strong> (.pptx) from the live figures — kept verbatim, never paraphrased. This can take a minute or two.
            </div>
          )}
          {/* The PDF is produced by the browser's own print-to-PDF, so the user finishes
              in the save dialog. Two settings there change the output, so say so up
              front rather than letting a plain-looking file be a surprise. */}
          {format === 'COMPOSITION' && (
            <div className="modal-note">
              <strong>Everything in one document.</strong> For every figure: where it comes from, how
              it is calculated, why it might not tie — and <strong>every contributing campaign, event,
              sequence and page</strong> across <strong>Q1, Q2, Q3 and the year to date</strong>, each
              table stating its own total. Opens with an at-a-glance summary of all four periods. The
              quarter chosen above is ignored; the report covers all of them. It reads the same
              calculation code as the dashboard, so figures match the screen by construction. This
              makes a few hundred queries and can take a minute or two.
            </div>
          )}
          {format !== 'PPTX' && format !== 'XLSX' && format !== 'COMPOSITION' && (
            <div className="modal-note">
              Your browser's <strong>Save as PDF</strong> window will open. Choose <strong>Save as PDF</strong> as the destination, then under <strong>More settings</strong> tick <strong>Background graphics</strong> so the CWSI colours are included and untick <strong>Headers and footers</strong>. Your browser remembers these for next time.
            </div>
          )}
          {err && <div className="modal-err">{err}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={go} disabled={busy}>
            {busy
              ? prog ? `Preparing… ${Math.round((prog.d / prog.t) * 100)}%` : 'Preparing…'
              : format === 'PPTX' ? 'Generate deck'
              : format === 'XLSX' ? 'Generate workbook'
              : format === 'COMPOSITION' ? 'Generate report'
              : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
