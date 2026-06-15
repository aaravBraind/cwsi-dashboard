// Export surface — kept as-is (no write paths). The buttons are inert
// placeholders until the export/AI layer is wired; they don't break.
export default function Export() {
  const noop = () => {}
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Export <span className="accent">Data</span></div>
          <div className="page-sub">Download reports as CSV, PDF or PPTX</div>
        </div>
      </div>
      <div className="cols-3">
        {[
          ['Full KPI Register', 'All KPIs · per quarter · per region', ['CSV', 'PDF', 'PPTX']],
          ['Board Pack', 'Executive summary · narrative · H2 plan', ['PDF', 'PPTX']],
          ['Pipeline Report', 'By region · by theme · by source', ['CSV', 'PDF']],
        ].map(([title, sub, btns]) => (
          <div className="panel" style={{ marginBottom: 0 }} key={title}>
            <div className="panel-head">
              <div className="left">
                <div className="panel-title">{title}</div>
                <div className="panel-sub">{sub}</div>
              </div>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {btns.map((b, i) => (
                  <button className={`btn${i === 0 ? ' primary' : ''}`} onClick={noop} key={b}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
