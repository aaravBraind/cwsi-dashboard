import { useState } from 'react'
import { useFilters } from '../../filters/FilterContext'
import { REGIONS, QUARTER_PILLS } from '../../data/constants'
import { I } from '../icons'

// The export libraries (jsPDF, pptxgenjs) are heavy, so the exporter module is
// loaded ON DEMAND — only when the user actually triggers a download — keeping
// them out of the initial dashboard bundle.

// T-8 — Export. Each format button opens a small dialog that asks for the
// region + quarter scope (defaulting to the current view), then generates a
// one-click download: CSV (Blob), PDF (jsPDF), or PPTX (pptxgenjs). Every figure
// is fetched fresh at the chosen scope, so the file is self-contained.

const REPORTS = [
  { id: 'kpi', title: 'Full KPI Register', sub: 'Every KPI · actual vs target · status', formats: ['PDF', 'PPTX'] },
  { id: 'board', title: 'Board Pack', sub: 'Branded board pack — figures, detail + AI narrative', formats: ['BRANDED', 'PPTX'] },
  { id: 'pipeline', title: 'Pipeline Report', sub: 'Funnel + by-channel breakdown', formats: ['PDF', 'PPTX'] },
]

// Every report now offers the same two branded routes:
//   PDF ('BRANDED' on the board, 'PDF' elsewhere) = artifact-matching HTML →
//     headless-Chrome (Gotenberg) PDF via n8n.
//   PPTX = the attractive, editable Gamma deck via n8n (preserve-mode, figures kept
//     verbatim). 'BRANDED' is surfaced simply as "PDF".
const FORMAT_LABEL = { BRANDED: 'PDF' }
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

  const go = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { runExport } = await import('../../data/exporters')
      await runExport({ report, format, region, quarter })
      onClose()
    } catch (e) {
      setErr(e?.message || 'Export failed — please try again.')
      setBusy(false)
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
              Renders the <strong>CWSI-branded board pack</strong> (matches the on-screen design) via headless Chrome and downloads a PDF — figures, detail sections and the saved AI narrative. Generate the narrative on the Board Pack page first for this scope so it's included.
            </div>
          )}
          {report === 'board' && format === 'PPTX' && (
            <div className="modal-note">
              Renders an <strong>attractive, editable Gamma deck</strong> (.pptx) from the live figures + the latest trace-passed AI narrative — kept verbatim, never paraphrased. Generate the narrative on the Board Pack page first for this scope so it's included.
            </div>
          )}
          {report !== 'board' && format === 'PDF' && (
            <div className="modal-note">
              Renders a <strong>CWSI-branded PDF</strong> (matches the on-screen design) via headless Chrome — figures are pulled fresh for this scope and trace-to-data verified.
            </div>
          )}
          {report !== 'board' && format === 'PPTX' && (
            <div className="modal-note">
              Renders an <strong>attractive, editable Gamma deck</strong> (.pptx) from the live figures — kept verbatim, never paraphrased. This calls Gamma and can take a minute or two.
            </div>
          )}
          {err && <div className="modal-err">{err}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={go} disabled={busy}>
            {busy ? 'Preparing…' : format === 'PPTX' ? 'Generate deck' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
