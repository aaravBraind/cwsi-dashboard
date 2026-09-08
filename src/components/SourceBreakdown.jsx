import { useState } from 'react'
import { useMetricSource } from '../hooks/useDashboardData'
import { num, eurExact } from '../data/format'
import { hasSource } from '../data/metricSources'
import { downloadCsv, csvMoney } from '../data/csv'
import { I, Icon } from './icons'

// ─────────────────────────────────────────────────────────────────────────────
// "Where does this number come from?" — for ANY registered figure.
//
// Margot, 6 Sep 2026: "someone who is going through the database should know where this
// number is coming from, which campaign, LinkedIn or any other thing… this is what I want
// for all the numbers."
//
// The earlier drill-downs each answered one figure. This one is driven by the metric
// registry (metricSources.js), so a single `<SourceBreakdown metric="totalMqls" />` opens
// the evidence behind whichever number it sits next to. Worked example — the Overview's
// 778 MQLs open as Email 562, Events & Webinars 148, Organic SEO 68.
//
// Three rules carried over from the reconciliation drill-downs, because they are what made
// those usable:
//   • Contributions are EXACT — counts in full, money to the cent, never the compact tile
//     value. You cannot tick off a rounded number.
//   • The breakdown FOOTS to the figure above it, on screen, and says so plainly when it
//     does not (which is a real answer, not a failure — see the MQL floor note).
//   • Rows come from the same scoped fetch the headline uses, so the two cannot be scoped
//     differently.
// ─────────────────────────────────────────────────────────────────────────────

// `alwaysOpen` drops the built-in toggle, for places where something else already chose
// which metric to show (the Overview funnel, where the stage tiles are the control).
export default function SourceBreakdown({ metric, value, label, compact = false, alwaysOpen = false, onClose }) {
  const [selfOpen, setSelfOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const open = alwaysOpen || selfOpen
  const q = useMetricSource(metric, open)
  if (!hasSource(metric)) return null

  const d = q.data
  const isMoney = d?.unit === 'money'
  const fmt = (v) => (isMoney ? eurExact(v) : num(v))

  // Does the evidence add up to the figure on screen? For most metrics it must. For MQLs
  // it deliberately does not — the funnel floor lifts the headline above the raw rows —
  // so the difference is explained rather than presented as an error.
  const shown = value == null ? null : Number(value)
  const diff = d && shown != null ? shown - d.total : null
  const foots = diff == null || Math.abs(diff) < 0.01

  // Defensive at every level: this component renders once per KPI, so an unexpected shape
  // from any one metric must not take the whole register down with it.
  const csvRows = (d?.groups || []).flatMap((g) =>
    (g.items || []).flatMap((s) => (s.rows || []).map((r) => ({
      group: g.label, sub: s.label, date: r.date, region: r.region, value: r.value,
    }))),
  )
  const csvCols = [
    { header: d?.groupLabel || 'Group', get: (r) => r.group },
    { header: d?.subLabel || 'Item', get: (r) => r.sub },
    { header: d?.rowLabel || 'Date', get: (r) => r.date },
    { header: 'Region', get: (r) => r.region },
    { header: isMoney ? 'Contribution EUR' : 'Contribution', get: (r) => (isMoney ? csvMoney(r.value) : r.value) },
  ]

  // Totals for the summary strip — how many things actually contributed, which is the
  // first question after "how much".
  const groupCount = d?.groups?.length || 0
  const itemCount = (d?.groups || []).reduce((a, g) => a + (g.items || []).length, 0)
  const share = (v) => (d?.total ? (v / d.total) * 100 : 0)
  const plural = (n, one) => `${num(n)} ${n === 1 ? one : `${one}s`}`

  return (
    <div className={compact ? 'srcbd is-compact' : 'srcbd'}>
      {alwaysOpen ? (
        <div className="srcbd-head">
          <strong>Where “{label || d?.label || metric}” comes from</strong>
          {onClose && (
            <button type="button" className="srcbd-x" onClick={onClose} aria-label="Close">×</button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`drill-toggle${open ? ' is-open' : ''}`}
          aria-expanded={open}
          onClick={() => setSelfOpen((o) => !o)}
        >
          <Icon className="icon chev">{I.chevronRight}</Icon>
          {open ? 'Hide where this comes from' : 'Where does this number come from?'}
        </button>
      )}

      {open && d?.kind === 'ratio' && (
        d.hasData ? (
          <div className="srcbd-panel">
            <div className="srcbd-top">
              <div className="srcbd-ratio">
                <span className="srcbd-total">{d.total == null ? '—' : `${(d.total * 100).toFixed(1)}%`}</span>
                <span className="srcbd-eq">=</span>
                <span className="srcbd-side">
                  <strong>{num(d.numTotal)}</strong> {String(d.numLabel).toLowerCase()}
                </span>
                <span className="srcbd-eq">÷</span>
                <span className="srcbd-side">
                  <strong>{num(d.denTotal)}</strong> {String(d.denLabel).toLowerCase()}
                </span>
              </div>
            </div>
            <p className="srcbd-note">
              This is a rate, so it has no records of its own — it divides two figures that do. Open either side to
              see the campaigns behind it.{d.note ? ` ${d.note}` : ''}
            </p>
            <div className="srcbd-nested">
              <SourceBreakdown metric={d.numMetric} value={d.numTotal} label={d.numLabel} compact />
              <SourceBreakdown metric={d.denMetric} value={d.denTotal} label={d.denLabel} compact />
            </div>
          </div>
        ) : (
          <p className="srcbd-note">
            This rate cannot be calculated at this region and quarter — the figure it divides by is zero.
          </p>
        )
      )}

      {/* Entered by hand — the honest answer is "a person typed it", with who and when. */}
      {open && d?.kind === 'manual' && (
        <div className="srcbd-panel">
          <div className="srcbd-top">
            <div className="srcbd-stats">
              <span className="srcbd-total">
                {d.value == null || d.value === ''
                  ? 'Not entered yet'
                  : d.unit === 'rate' ? `${(Number(d.value) * 100).toFixed(1)}%` : String(d.value)}
              </span>
              <span className="srcbd-meta">
                {d.target != null && d.target !== '' && (
                  <>target {d.unit === 'rate' ? `${(Number(d.target) * 100).toFixed(0)}%` : String(d.target)} · </>
                )}
                {String(d.period).toUpperCase()}
              </span>
            </div>
          </div>
          <p className="srcbd-note">
            <strong>No system records this measure</strong> — it is entered by hand in this register, so the source
            is a person rather than a feed. {d.note}
            {d.updatedBy
              ? ` Last set by ${d.updatedBy}${d.updatedAt ? ` on ${d.updatedAt}` : ''}.`
              : ' No one has entered a figure for this period yet.'}
          </p>
        </div>
      )}

      {/* Growth compares the same scoped figure across two quarters. */}
      {open && d?.kind === 'growth' && (
        d.hasData ? (
          <div className="srcbd-panel">
            <div className="srcbd-top">
              <div className="srcbd-ratio">
                <span className="srcbd-total">{`${d.total >= 0 ? '+' : ''}${(d.total * 100).toFixed(1)}%`}</span>
                <span className="srcbd-eq">=</span>
                <span className="srcbd-side"><strong>{num(d.current)}</strong> this quarter</span>
                <span className="srcbd-eq">vs</span>
                <span className="srcbd-side"><strong>{num(d.prior)}</strong> in {String(d.priorQuarter).toUpperCase()}</span>
              </div>
            </div>
            <p className="srcbd-note">{d.note}</p>
            {d.baseMetric && (
              <div className="srcbd-nested">
                <SourceBreakdown metric={d.baseMetric} value={d.current} label="this quarter’s sessions" compact />
              </div>
            )}
          </div>
        ) : (
          <p className="srcbd-note">
            {d.reason === 'ytd'
              ? 'Select a quarter — growth is measured against the quarter before it, so it has no meaning across the whole year.'
              : d.reason === 'no-prior-quarter'
                ? 'There is no earlier quarter in the reporting year to compare this one against.'
                : 'No sessions were recorded in the prior quarter, so there is nothing to compare against.'}
          </p>
        )
      )}

      {open && q.isLoading && (
        <div className="srcbd-panel">
          <div className="srcbd-skel" />
          <div className="srcbd-skel" />
          <div className="srcbd-skel short" />
        </div>
      )}
      {open && q.isError && <p className="srcbd-note warn">Could not load the breakdown — please try again.</p>}
      {/* Belt and braces: an open panel must never render as nothing. Opening many at once
          can leave a query briefly settled with no data, and silence reads as a bug. */}
      {open && !q.isLoading && !q.isError && !d && (
        <p className="srcbd-note">Still fetching the contributing records — reopen this if it does not appear.</p>
      )}
      {open && d && !d.hasData && !d.kind && (
        <p className="srcbd-note">
          Nothing contributed to {label || d.label} at this region and quarter — the figure is a genuine zero, not
          missing data.
        </p>
      )}

      {open && d?.hasData && !d.kind && (
        <div className="srcbd-panel">
          {/* What the number is, and how much evidence sits behind it, in one line. */}
          <div className="srcbd-top">
            <div className="srcbd-stats">
              <span className="srcbd-total">{fmt(d.total)}</span>
              <span className="srcbd-meta">
                from {plural(groupCount, String(d.groupLabel).toLowerCase())} ·{' '}
                {plural(itemCount, String(d.subLabel).toLowerCase())} · {plural(csvRows.length, 'record')}
              </span>
            </div>
            <button type="button" className="srcbd-csv" onClick={() => downloadCsv(`cwsi-${metric}-source`, csvCols, csvRows)}>
              <Icon className="icon icon-sm">{I.download}</Icon> CSV
            </button>
          </div>

          {d.note && <p className="srcbd-note">{d.note}</p>}

          <div className="tbl-scroll">
            <table className="tbl srcbd-tbl">
              <thead>
                <tr>
                  <th>{d.groupLabel} / {d.subLabel}</th>
                  <th className="r">{isMoney ? 'Contribution €' : 'Contribution'}</th>
                  <th className="r">Share</th>
                </tr>
              </thead>
              <tbody>
                {d.groups.map((g) => [
                  <tr key={g.key} className="srcbd-group">
                    <td>
                      <span className="srcbd-gname">{g.label}</span>
                      <span className="srcbd-gcount">{plural((g.items || []).length, String(d.subLabel).toLowerCase())}</span>
                    </td>
                    <td className="r mono srcbd-val">{fmt(g.total)}</td>
                    <td className="r">
                      <span className="srcbd-share">
                        <span className="srcbd-bar"><span style={{ width: `${share(g.total)}%` }} /></span>
                        <span className="mono">{share(g.total).toFixed(1)}%</span>
                      </span>
                    </td>
                  </tr>,
                  ...(g.items || []).map((s) => {
                    const k = `${g.key}|${s.key}`
                    const isOpen = !!expanded[k]
                    return [
                      <tr key={k} className={`srcbd-item${isOpen ? ' is-open' : ''}`}>
                        <td>
                          <button
                            type="button"
                            className={`drill-row-btn${isOpen ? ' is-open' : ''}`}
                            aria-expanded={isOpen}
                            title={isOpen ? 'Hide the individual records' : 'Show the individual records'}
                            onClick={() => setExpanded((e) => ({ ...e, [k]: !e[k] }))}
                          >
                            <Icon className="icon chev">{I.chevronRight}</Icon>
                            {s.label}
                          </button>
                        </td>
                        <td className="r mono">{fmt(s.total)}</td>
                        <td className="r">
                          <span className="srcbd-share">
                            <span className="srcbd-bar sub"><span style={{ width: `${share(s.total)}%` }} /></span>
                            <span className="mono">{share(s.total).toFixed(1)}%</span>
                          </span>
                        </td>
                      </tr>,
                      isOpen && (
                        <tr key={`${k}-rows`} className="srcbd-rows">
                          <td colSpan={3}>
                            <table className="tbl">
                              <thead>
                                <tr>
                                  <th>{d.rowLabel || 'Date'}</th>
                                  <th>Region</th>
                                  <th className="r">{isMoney ? 'Contribution €' : 'Contribution'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(s.rows || []).map((r, i) => (
                                  <tr key={i}>
                                    <td className="mono mono-d">{r.date || '—'}</td>
                                    <td style={{ opacity: 0.75 }}>{r.region || '—'}</td>
                                    <td className="r mono">{fmt(r.value)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ),
                    ]
                  }),
                ])}
                <tr className="total">
                  <td>Total of the records above</td>
                  <td className="r mono">{fmt(d.total)}</td>
                  <td className="r mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Does the evidence add up to the figure on screen? Stated as a status strip
              rather than a stray line, because it is the whole point of the panel. */}
          {shown != null && (
            <div className={`srcbd-verdict ${foots ? 'ok' : 'warn'}`}>
              <span className="srcbd-verdict-icn">{foots ? '✓' : '!'}</span>
              <span>
                {foots ? (
                  <>This matches the <strong>{fmt(shown)}</strong> shown above.</>
                ) : (
                  <>
                    The figure above reads <strong>{fmt(shown)}</strong>, which is {fmt(Math.abs(diff))}{' '}
                    {diff > 0 ? 'higher' : 'lower'} than these records add up to.
                    {d.gapNote
                      ? ` ${d.gapNote}`
                      : ' That is not expected — please flag it, as it points to a fault in the dashboard rather than in the source data.'}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
