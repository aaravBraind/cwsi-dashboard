import { useState } from 'react'
import { useCampaignOpportunities } from '../hooks/useDashboardData'
import { eur, num } from '../data/format'

// The deals behind a campaign's figures, so any number on the page can be checked against
// Salesforce line by line.
//
// Margot, 20 Aug: "These opportunities are showing in the campaign, that's why I could
// verify the numbers. You need to look at the campaign the opportunity is assigned to." —
// and, four separate times, "please provide a breakdown/an overview of the campaigns".
// The dashboard already attributes exactly that way (the ingestion reads Opportunity WHERE
// CampaignId != null, i.e. Primary Campaign Source); what was missing was the evidence.
// Since the 24 Aug re-ingest each deal carries its name, account and gross profit.
const SF_BASE = (import.meta.env.VITE_SF_INSTANCE_URL || '').replace(/\/+$/, '')

export default function DealDrilldown({ campaignKeys, label = 'deals' }) {
  const [open, setOpen] = useState(false)
  const q = useCampaignOpportunities(campaignKeys, open)
  const keys = (campaignKeys || []).filter(Boolean)
  if (!keys.length) return null

  return (
    <div style={{ padding: '6px 4px 10px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ font: 'inherit', fontSize: 12, background: 'none', border: 0, cursor: 'pointer', opacity: 0.8, padding: 0 }}
      >
        {open ? '▾' : '▸'} {open ? 'Hide' : 'Show'} the {label} behind these figures
      </button>

      {open && q.isLoading && <p className="panel-note" style={{ fontSize: 12, margin: '6px 0 0' }}>Loading deals…</p>}
      {open && q.data && !q.data.hasData && (
        <p className="panel-note" style={{ fontSize: 12, margin: '6px 0 0' }}>
          No opportunities are linked to this campaign in Salesforce.
        </p>
      )}
      {open && q.data?.hasData && (
        <div className="tbl-scroll" style={{ marginTop: 8 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Account</th>
                <th>Campaign it is credited to</th>
                <th>Stage</th>
                <th className="r">Value €</th>
                <th className="r">Gross profit €</th>
                <th>Created</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {q.data.opps.map((o) => (
                <tr key={o.oppId}>
                  <td>
                    {SF_BASE
                      ? <a href={`${SF_BASE}/lightning/r/Opportunity/${o.oppId}/view`} target="_blank" rel="noreferrer">{o.name}</a>
                      : o.name}
                  </td>
                  <td>{o.account}</td>
                  <td>{o.campaign}</td>
                  <td>
                    <span className={`chip ${o.status === 'Won' ? 'green' : o.status === 'Lost' ? 'neu' : 'blue'}`}>{o.status}</span>
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>{o.stage}</span>
                  </td>
                  <td className="r mono">{eur(o.amount)}</td>
                  <td className="r mono">{o.margin == null ? 'not in Salesforce' : eur(o.margin)}</td>
                  <td className="mono mono-d">{o.created || '—'}</td>
                  <td className="mono mono-d">{o.closed || '—'}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={4}>{num(q.data.opps.length)} opportunities · {eur(q.data.won)} won · {eur(q.data.open)} still open</td>
                <td className="r mono">{eur(q.data.opps.reduce((a, o) => a + o.amount, 0))}</td>
                <td className="r mono">{eur(q.data.opps.reduce((a, o) => a + (o.margin || 0), 0))}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
