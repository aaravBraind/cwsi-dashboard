import { useMarketingSpend, useDataFreshness } from '../hooks/useDashboardData'
import { Loading, ErrorState, EmptyState } from './States'
import { eur } from '../data/format'
import { MARKETING_BUDGET_EUR, MDF_BUDGET_EUR, light } from '../data/thresholds'
import Explain from './Explain'

// Budget-vs-actual + spend-by-category/region from v_marketing_spend (EUR native).
// The whole board reports in EUR (Salesforce amounts are converted to EUR at
// ingest), so budget/actual render in their native EUR — no FX conversion.
// Net of correction rows. Budget figures are the CWSI-supplied 11 Aug numbers:
// total €466,394.92, of which MDF €86,394.92 (an exact €380,000 core + MDF).
// Utilisation is FULL-YEAR, ALL-REGIONS (the budget is annual) even when a
// quarter/region pill scopes the actual-spend tile. compact=true renders just
// the KPI tiles (Overview).
export default function MarketingBudget({ compact = false }) {
  const q = useMarketingSpend()
  const fresh = useDataFreshness()

  if (q.isLoading) return <Loading label="Loading marketing budget…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No marketing spend for this region / quarter." />

  const d = q.data
  const m = eur // EUR native — the board's reporting currency

  const fySpent = d.fy?.netActual ?? d.netActual
  const fyMdfSpent = d.fy?.mdfSpend ?? 0
  const util = fySpent / MARKETING_BUDGET_EUR
  const mdfUtil = fyMdfSpent / MDF_BUDGET_EUR

  // Budget-tracker freshness (W4): the spend sync went stale for two months and read as
  // "spend looks too low" — so the sync date is now on the face of the page, with a loud
  // amber state when it falls behind.
  const budgetFeed = (fresh.data?.sources || []).find((r) => /budget/i.test(r.source))
  const lastSynced = budgetFeed?.lastRefreshed ? String(budgetFeed.lastRefreshed).slice(0, 10) : null
  const staleDays = lastSynced ? Math.floor((Date.now() - new Date(lastSynced).getTime()) / 86400000) : null
  const isStale = staleDays != null && staleDays > 3

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

      {isStale && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <div className="callout-body">
            <strong>Spend figures may be behind the tracker.</strong> The budget tracker was last synced{' '}
            <strong>{lastSynced}</strong> ({staleDays} days ago). Recent entries in the tracker won't show here until
            the next sync runs.
          </div>
        </div>
      )}

      {/* MB2/MB4 (Margot, Jul 2026): dropped the "Spend lines" + "Correction rows"
          tiles — net actual already reflects corrections. W4 (11 Aug): real budget
          + MDF tiles from the client-supplied figures. */}
      <div className="kpis cols-3">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M18 6a7 7 0 1 0 0 12" /><line x1="3" y1="10" x2="13" y2="10" /><line x1="3" y1="14" x2="13" y2="14" /></svg></div>
            <span className="tl neu"><span className="tl-dot" />EUR</span>
          </div>
          <div className="kpi-label">Marketing Spend · actual <Explain id="marketingSpend" /></div>
          <div className="kpi-val">{m(d.netActual)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">current view{lastSynced ? ` · tracker synced ${lastSynced}` : ''}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M7 12l3-3 4 4 5-6" /></svg></div>
            <span className={`tl ${light(fySpent, MARKETING_BUDGET_EUR)}`}>
              <span className="tl-dot" />{`${(util * 100).toFixed(0)}% used`}
            </span>
          </div>
          <div className="kpi-label">Annual Budget</div>
          <div className="kpi-val">{m(MARKETING_BUDGET_EUR)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              {m(fySpent)} spent · {m(MARKETING_BUDGET_EUR - fySpent)} remaining · full year, all regions
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14" /><circle cx="16" cy="12" r="1.5" /><path d="M22 10v4a2 2 0 0 1-2 2" /></svg></div>
            <span className="tl neu"><span className="tl-dot" />{`${(mdfUtil * 100).toFixed(0)}% used`}</span>
          </div>
          <div className="kpi-label">MDF Available</div>
          <div className="kpi-val">{m(MDF_BUDGET_EUR)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              part of the total budget · {m(fyMdfSpent)} spent · {m(MDF_BUDGET_EUR - fyMdfSpent)} remaining
            </span>
          </div>
        </div>
      </div>

      {!compact && (
        <>
          {/* W4 — spent vs remaining, total and MDF */}
          <div className="panel">
            <div className="panel-head">
              <div className="left">
                <div className="panel-title">Budget Utilisation</div>
                <div className="panel-sub">Spent vs remaining · full year, all regions · MDF is part of the total</div>
              </div>
              <span className="chip blue">EUR</span>
            </div>
            <div className="panel-body">
              <div className="bar-list">
                <UtilBar label="Total budget" spent={fySpent} budget={MARKETING_BUDGET_EUR} />
                <UtilBar label="of which MDF" spent={fyMdfSpent} budget={MDF_BUDGET_EUR} />
              </div>
            </div>
          </div>

          <div className="cols-2">
            <Breakdown title="Spend by Budget Line" rows={d.byBudgetLine} m={m} />
            {/* MB3 (Margot, Jul 2026): "Unassigned" = shared spend across all regions, not a separate region. */}
            <Breakdown
              title="Spend by Region"
              rows={d.byRegion.map((r) => (r.bucket === 'UNASSIGNED' ? { ...r, bucket: 'All regions (shared)' } : r))}
              m={m}
            />
          </div>
        </>
      )}
    </>
  )
}

function UtilBar({ label, spent, budget }) {
  const pct = Math.min(Math.max(spent / budget, 0), 1)
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill bf-blue" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="bar-val">
        {eur(spent)} spent · {eur(budget - spent)} remaining
      </div>
    </div>
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
