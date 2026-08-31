import { useState } from 'react'
import { num, eurExact } from '../data/format'
import { downloadCsv, csvMoney } from '../data/csv'

// ─────────────────────────────────────────────────────────────────────────────
// The campaigns and deals behind one "Activity run this period vs ongoing impact"
// figure — the audit trail for a number, not a second opinion on it.
//
// Margot, 31 Aug: "I've been trying to go through some of the data today to verify
// its accuracy, but I keep on getting different numbers than you guys… the very
// detailed breakdown is indeed what I'm looking for. So, for example, on ongoing
// impact, the campaigns, including value to get to the number."
//
// So this is built for RECONCILIATION, and three things follow from that:
//   1. Amounts are EXACT to the cent (€110,634.90, and full precision in the CSV), never
//      the compact "€111k" the tiles show — you cannot tick off a rounded number.
//   2. Every row states the amount IT contributed to the figure above, and the
//      subtotals are footed against that figure on screen, so the sum is visible
//      rather than asserted.
//   3. Where a deal's revenue and gross profit differ, both are shown side by side —
//      the panel reports gross profit, and summing the Value column instead is the
//      most likely reason an independent tally comes out higher.
//
// The rows come from the same accumulator loop in getCurrentVsOngoing() that produces
// the headline figure, so the breakdown cannot drift from what it explains.
// ─────────────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  { header: 'Bucket', get: (r) => r.bucket },
  { header: 'Campaign', get: (r) => r.campaign },
  { header: 'Channel', get: (r) => r.channel },
  { header: 'Opportunity', get: (r) => r.name },
  { header: 'Account', get: (r) => r.account },
  { header: 'Stage', get: (r) => r.stage },
  { header: 'Status', get: (r) => r.status },
  { header: 'Created', get: (r) => r.created },
  { header: 'Closed', get: (r) => r.closed },
  { header: 'Counts toward', get: (r) => (r.countsWon ? 'Closed-won' : r.countsOpen ? 'Open pipeline' : '') },
  { header: 'Closed-won gross profit EUR', get: (r) => csvMoney(r.wonGp) },
  { header: 'Open pipeline gross profit EUR', get: (r) => csvMoney(r.openGp) },
  { header: 'Closed-won value EUR', get: (r) => csvMoney(r.wonRevenue) },
  { header: 'Open pipeline value EUR', get: (r) => csvMoney(r.openRevenue) },
  { header: 'Gross profit in Salesforce', get: (r) => (r.noGrossProfit ? 'no' : 'yes') },
  { header: 'Salesforce opportunity ID', get: (r) => r.oppId },
]

const SF_BASE = (import.meta.env.VITE_SF_INSTANCE_URL || '').replace(/\/+$/, '')

export default function ImpactBreakdown({ campaigns, bucketLabel, closedWon, pipeline, periodStart, periodEnd, scopeNote }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const rows = campaigns || []
  if (!rows.length) return null

  const dealCount = rows.reduce((a, c) => a + c.dealCount, 0)
  const sumWon = rows.reduce((a, c) => a + c.closedWon, 0)
  const sumPipe = rows.reduce((a, c) => a + c.pipeline, 0)
  const sumWonRev = rows.reduce((a, c) => a + c.closedWonRevenue, 0)
  const sumPipeRev = rows.reduce((a, c) => a + c.pipelineRevenue, 0)
  // Guard against ever showing a breakdown that does not foot to the figure above it:
  // a mismatch beyond rounding is a bug, and saying so is better than hiding it.
  const off = Math.abs(sumWon - (closedWon || 0)) > 1 || Math.abs(sumPipe - (pipeline || 0)) > 1
  const anyMissingGp = rows.some((c) => c.deals.some((d) => d.noGrossProfit))

  const exportRows = rows.flatMap((c) => c.deals.map((d) => ({ ...d, bucket: bucketLabel })))
  const slug = bucketLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <div style={{ padding: '2px 4px 10px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ font: 'inherit', fontSize: 12, background: 'none', border: 0, cursor: 'pointer', opacity: 0.85, padding: 0, color: 'inherit' }}
      >
        {open ? '▾' : '▸'} {open ? 'Hide' : 'Show'} the {num(rows.length)} campaigns and {num(dealCount)} deals behind “{bucketLabel}”
      </button>

      {open && (
        <>
          <p className="panel-note" style={{ fontSize: 12, opacity: 0.75, margin: '8px 0 6px' }}>
            Every opportunity credited to a campaign that contributed to this figure, with the exact amount it
            contributed. Campaign subtotals add to the figure above. {scopeNote}{' '}
            A won deal is counted in the period it <strong>closed</strong> in ({periodStart} to {periodEnd}); an open
            deal is counted while it sits in pipeline. The panel reports <strong>gross profit</strong> — the Value
            column is the deal’s full revenue and is shown for comparison only, so summing it will give a higher number.
          </p>

          <button
            type="button"
            onClick={() => downloadCsv(`cwsi-${slug}-${periodStart}-to-${periodEnd}`, CSV_COLUMNS, exportRows)}
            style={{ font: 'inherit', fontSize: 12, background: 'none', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', color: 'inherit', marginBottom: 8 }}
          >
            Download all {num(dealCount)} deals as CSV
          </button>

          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Channel</th>
                  <th className="r">Deals</th>
                  <th className="r">Closed-won €</th>
                  <th className="r">Open pipeline €</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const key = c.campaignKey || '(none)'
                  const isOpen = !!expanded[key]
                  return [
                    <tr key={key}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                          style={{ font: 'inherit', background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit', textAlign: 'left' }}
                        >
                          {isOpen ? '▾' : '▸'} {c.campaign}
                        </button>
                      </td>
                      <td style={{ opacity: 0.75 }}>{c.channel}</td>
                      <td className="r mono">{num(c.dealCount)}</td>
                      <td className="r mono">{eurExact(c.closedWon)}</td>
                      <td className="r mono">{eurExact(c.pipeline)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${key}-deals`}>
                        <td colSpan={5} style={{ padding: '0 0 10px 18px', background: 'rgba(255,255,255,0.015)' }}>
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>Opportunity</th>
                                <th>Account</th>
                                <th>Stage</th>
                                <th>Created</th>
                                <th>Closed</th>
                                <th>Counts toward</th>
                                <th className="r">Gross profit €</th>
                                <th className="r">Value €</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.deals.map((d) => (
                                <tr key={d.oppId}>
                                  <td>
                                    {SF_BASE
                                      ? <a href={`${SF_BASE}/lightning/r/Opportunity/${d.oppId}/view`} target="_blank" rel="noreferrer">{d.name}</a>
                                      : d.name}
                                  </td>
                                  <td>{d.account}</td>
                                  <td>
                                    <span className={`chip ${d.status === 'Won' ? 'green' : d.status === 'Lost' ? 'neu' : 'blue'}`}>{d.status}</span>
                                    <span style={{ marginLeft: 6, opacity: 0.7 }}>{d.stage}</span>
                                  </td>
                                  <td className="mono mono-d">{d.created || '—'}</td>
                                  <td className="mono mono-d">{d.closed || '—'}</td>
                                  <td style={{ fontSize: 12, opacity: 0.85 }}>
                                    {d.countsWon ? 'Closed-won' : d.countsOpen ? 'Open pipeline' : '—'}
                                  </td>
                                  <td className="r mono">
                                    {d.noGrossProfit
                                      ? <span title="Salesforce holds no Gross Profit for this deal, so it is left out of the gross-profit total rather than counted at full value.">not in Salesforce</span>
                                      : eurExact(d.countsWon ? d.wonGp : d.openGp)}
                                  </td>
                                  <td className="r mono mono-d">{eurExact(d.countsWon ? d.wonRevenue : d.openRevenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ),
                  ]
                })}
                <tr className="total">
                  <td colSpan={2}>Total — the “{bucketLabel}” figure above</td>
                  <td className="r mono">{num(dealCount)}</td>
                  <td className="r mono">{eurExact(sumWon)}</td>
                  <td className="r mono">{eurExact(sumPipe)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ opacity: 0.7, fontSize: 12 }}>Same deals at full revenue, for comparison</td>
                  <td />
                  <td className="r mono mono-d">{eurExact(sumWonRev)}</td>
                  <td className="r mono mono-d">{eurExact(sumPipeRev)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {anyMissingGp && (
            <p className="panel-note" style={{ fontSize: 12, opacity: 0.75, margin: '8px 0 0' }}>
              Rows marked “not in Salesforce” have no Gross Profit on the opportunity. They are left out of the
              gross-profit total rather than counted at full value, so their revenue appears in the Value column
              but not in the figure above.
            </p>
          )}
          {off && (
            <p className="panel-note" style={{ fontSize: 12, margin: '8px 0 0', color: 'var(--amber)' }}>
              These subtotals do not currently foot to the figure above — please flag this, it is a fault in the
              dashboard rather than in the underlying Salesforce data.
            </p>
          )}
        </>
      )}
    </div>
  )
}
