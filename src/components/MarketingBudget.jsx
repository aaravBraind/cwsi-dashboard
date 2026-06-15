import { useMarketingSpend, useFxRate } from '../hooks/useDashboardData'
import { Loading, ErrorState, EmptyState } from './States'
import { eur, gbp, num } from '../data/format'
import { MARKETING_BUDGET_EUR, light } from '../data/thresholds'
import { hasRate, fxLabel } from '../data/fx'

// Budget-vs-actual + spend-by-category/region from v_marketing_spend (EUR native).
// Tiles DISPLAY in GBP (board currency) converted at a per-day-pinned ECB rate.
// If the FX API is unavailable there is NO fallback rate — amounts render in
// their native EUR (a stale rate could silently produce false GBP). Net of
// correction rows. Planned budget is client-gated (MARKETING_BUDGET_EUR) —
// "not set" until provided. compact=true renders just the KPI tiles (Overview).
export default function MarketingBudget({ compact = false }) {
  const q = useMarketingSpend()
  const fxq = useFxRate()

  if (q.isLoading) return <Loading label="Loading marketing budget…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No marketing spend for this region / quarter." />

  const d = q.data
  const fx = fxq.data
  const showGbp = hasRate(fx) // false while loading or if FX failed → native EUR
  // money(): GBP (converted) when a live rate exists, else native EUR. Never a stale rate.
  const m = (vEur) => (showGbp ? gbp(vEur * fx.rate) : eur(vEur))
  const cur = showGbp ? 'GBP' : 'EUR'

  const budgetEur = MARKETING_BUDGET_EUR
  const util = budgetEur ? d.netActual / budgetEur : null // ratio is currency-agnostic

  return (
    <>
      {d.mixedCurrency && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <div className="callout-body"><strong>Mixed currencies detected</strong> in the spend feed — figures may be unreliable until normalised.</div>
        </div>
      )}

      <div className="kpis cols-4">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
            <span className="tl neu"><span className="tl-dot" />{cur}</span>
          </div>
          <div className="kpi-label">Marketing Spend · actual (net)</div>
          <div className="kpi-val">{m(d.netActual)}</div>
          <div className="kpi-sub"><span className="kpi-target">{showGbp ? `${eur(d.netActual)} · ` : ''}{num(d.spendEventCount)} events</span></div>
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
            <span className="kpi-target">{budgetEur ? `${eur(budgetEur)} planned` : 'budget not set (client-gated)'}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg></div>
          </div>
          <div className="kpi-label">Spend lines</div>
          <div className="kpi-val">{num(d.lineCount)}</div>
          <div className="kpi-sub"><span className="kpi-target">finance-grained items</span></div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn red"><svg className="icon icon-lg" viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg></div>
          </div>
          <div className="kpi-label">Correction rows</div>
          <div className="kpi-val">{num(d.negCount)}</div>
          <div className="kpi-sub"><span className="kpi-target">{m(d.negSum)} netted off</span></div>
        </div>
      </div>

      {/* Rate provenance — labelled for board-pack reproducibility */}
      <div className="info-pill" style={{ marginBottom: compact ? 0 : 18 }}>
        {showGbp ? `Converted at ${fxLabel(fx)}` : (fxq.isLoading ? 'EUR→GBP loading… showing EUR' : fxLabel(fx))}
      </div>

      {!compact && (
        <div className="cols-2">
          <Breakdown title="Spend by Budget Line" rows={d.byBudgetLine} m={m} cur={cur} />
          <Breakdown title="Spend by Region" rows={d.byRegion} m={m} cur={cur} />
        </div>
      )}
    </>
  )
}

function Breakdown({ title, rows, m, cur }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">{title}</div>
          <div className="panel-sub">
            Net {cur === 'GBP' ? 'GBP (converted from EUR)' : 'EUR (native — FX unavailable)'} · negatives are corrections, not events
          </div>
        </div>
        <span className="chip blue">{cur}</span>
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
              <div className="bar-pct">{r.lines}×</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
