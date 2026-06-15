// Static integration-readiness view (configuration / status, not store-backed).
// Kept faithful to the artifact; no data binding required.
export default function Salesforce() {
  const rows = [
    ['MQL tracking — lead qualification flags syncing to SF', 'green', 'Live'],
    ['SQL handoff — MQL→SQL status transitions tracked', 'green', 'Live'],
    ['Campaign-to-opportunity attribution', 'green', 'Live'],
    ['Closed-won revenue tracking — won opps mapped to source', 'green', 'Live'],
    ['Multi-touch attribution model — first/last/linear weighting', 'amber', 'In progress · Q3'],
    ['CLV & influenced margin reporting', 'amber', 'In progress · Q3'],
    ['Native Salesforce dashboard — single source of truth', 'neu', 'Planned · Q4'],
  ]
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Salesforce <span className="accent">Sync</span></div>
          <div className="page-sub">CRM connection · data readiness · attribution pipeline</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Integration Readiness</div>
            <div className="panel-sub">Status of all CRM data flows</div>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(([label, cls, status], i) => (
              <div className="def-row" key={i}>
                <span><strong>{label}</strong></span>
                <span className={`tl ${cls}`}><span className="tl-dot" />{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
