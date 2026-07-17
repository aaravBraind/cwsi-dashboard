import { useMarketingSpend } from '../hooks/useDashboardData'
import { Loading, ErrorState, EmptyState } from './States'
import { eur } from '../data/format'
import { MARKETING_BUDGET_EUR, light } from '../data/thresholds'
import Explain from './Explain'

// Budget-vs-actual + spend-by-category/region from v_marketing_spend (EUR native).
// The whole board reports in EUR (Salesforce amounts are converted to EUR at
// ingest), so budget/actual render in their native EUR — no FX conversion.
// Net of correction rows. Planned budget is client-gated (MARKETING_BUDGET_EUR) —
// "not set" until provided. compact=true renders just the KPI tiles (Overview).
export default function MarketingBudget({ compact = false }) {
  const q = useMarketingSpend()

  if (q.isLoading) return <Loading label="Loading marketing budget…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No marketing spend for this region / quarter." />

  const d = q.data
  const m = eur // EUR native — the board's reporting currency

  const budgetEur = MARKETING_BUDGET_EUR
  const util = budgetEur ? d.netActual / budgetEur : null

  return (
    <>
      {d.mixedCurrency && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <div className="callout-body"><strong>Mixed currencies detected</strong> in the spend data — figures may be unreliable until they're converted to a single currency.</div>
        </div>
      )}

      {/* MB2/MB4 (Margot, Jul 2026): dropped the "Spend lines" + "Correction rows"
          tiles — net actual already reflects corrections. */}
      <div className="kpis cols-2">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M18 6a7 7 0 1 0 0 12" /><line x1="3" y1="10" x2="13" y2="10" /><line x1="3" y1="14" x2="13" y2="14" /></svg></div>
            <span className="tl neu"><span className="tl-dot" />EUR</span>
          </div>
          <div className="kpi-label">Marketing Spend · actual <Explain id="marketingSpend" /></div>
          <div className="kpi-val">{m(d.netActual)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M7 12l3-3 4 4 5-6" /></svg></div>
            <span className={`tl ${budgetEur ? light(d.netActual, budgetEur) : 'neu'}`}>
              <span className="tl-dot" />{util == null ? 'no budget' : `${(util * 100).toFixed(0)}% used`}
            </span>
          </div>
          <div className="kpi-label">Budget vs Actual</div>
          <div className="kpi-val">{budgetEur ? m(budgetEur) : '—'}</div>
          <div className="kpi-sub">
            <span className="kpi-target">{budgetEur ? `${eur(budgetEur)} planned` : 'budget not set (pending from CWSI)'}</span>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="cols-2">
          <Breakdown title="Spend by Budget Line" rows={d.byBudgetLine} m={m} />
          {/* MB3 (Margot, Jul 2026): "Unassigned" = shared spend across all regions, not a separate region. */}
          <Breakdown
            title="Spend by Region"
            rows={d.byRegion.map((r) => (r.bucket === 'UNASSIGNED' ? { ...r, bucket: 'All regions (shared)' } : r))}
            m={m}
          />
        </div>
      )}
    </>
  )
}

function Breakdown({ title, rows, m }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">{title}</div>
          <div className="panel-sub">
            Net EUR · negatives are corrections, not spend
          </div>
        </div>
        <span className="chip blue">EUR</span>
      </div>
      <div className="panel-body">
        <div className="bar-list">
          {rows.map((r) => (
            <div className="bar-row" key={r.bucket}>
              <div className="bar-label">{r.bucket}</div>
              <div className="bar-track">
                <div className={`bar-fill ${r.net < 0 ? 'bf-red' : 'bf-blue'}`} style={{ width: `${(Math.abs(r.net) / max) * 100}%` }} />
              </div>
              <div className="bar-val">{m(r.net)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
