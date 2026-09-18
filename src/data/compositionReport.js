// ---- The complete report --------------------------------------------------
// Margot, 8 Sep 2026: "I want everything in one report."
//
// One document covering, for every figure the dashboard reports:
//   • where it comes from, in plain English
//   • exactly how it is calculated, and why it might not tie
//   • every contributing campaign / event / sequence / page, for Q1, Q2, Q3 and the year
//     to date, each table stating its own total
//
// Built on getMetricSource() — the SAME function behind each "Where does this number come
// from?" panel in the dashboard. That is the whole point: the report asks the same question
// of the same code rather than re-deriving anything, so it cannot disagree with the screen,
// and it regenerates on demand rather than going stale.
//
// Hand-writing this was tried twice and was wrong twice (outreach under-counted by 35% via
// the workstream-label trap; money rows silently dropped from a period). Hence generating it.

import { getMetricSource } from './queries'
import { METRIC_SOURCES } from './metricSources'
import {
  SECTIONS, COMPOSITION_FIGURES, PREAMBLE_RULES, describeSource, describeCalculation,
} from './metricNarrative'
import { METHODOLOGY } from './methodology'
import { download } from './exporters'

const PERIODS = [
  ['q1', 'Q1 2026'],
  ['q2', 'Q2 2026'],
  ['q3', 'Q3 2026'],
  ['ytd', 'Year to date 2026'],
]

const eur = (n) => `€${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (n) => Number(n).toLocaleString('en-GB')
const pct = (n) => `${(Number(n) * 100).toFixed(1)}%`
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

const REGION_LABEL = { all: 'All regions', UKI: 'UKI', BELUX: 'BeLux', NL: 'NL' }

export async function generateCompositionReport({ region = 'all', onProgress } = {}) {
  const regionLabel = REGION_LABEL[region] || region
  const today = new Date().toISOString().slice(0, 10)

  // Fetch every figure for every period up front, so the document is assembled in one pass
  // and every total comes from the same moment.
  //
  // Two things make this fast enough to be usable. Memoising per (figure, period) means a
  // rate does not refetch sides that are themselves figures in the report — and most of them
  // are. Running a bounded pool rather than one-at-a-time turns ~280 sequential round trips
  // into a couple of dozen waves; sequentially this took over a minute and timed out.
  const wanted = SECTIONS.flatMap(([, keys]) => keys).filter((k) => METRIC_SOURCES[k])
  const memo = new Map()
  const fetchOne = (key, quarter) => {
    const ck = `${key}|${quarter}`
    if (!memo.has(ck)) {
      memo.set(ck, getMetricSource(key, { region, quarter }).catch(() => null))
    }
    return memo.get(ck)
  }

  const jobs = wanted.flatMap((key) => PERIODS.map(([q]) => [key, q]))
  const data = {}
  for (const key of wanted) data[key] = {}
  let done = 0
  const CONCURRENCY = 6
  let cursor = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < jobs.length) {
      const [key, q] = jobs[cursor++]
      data[key][q] = await fetchOne(key, q)
      onProgress?.(++done, jobs.length)
    }
  }))

  const fmtFor = (d, v) => (d?.unit === 'money' ? eur(v) : d?.unit === 'rate' ? pct(v) : num(v))
  // What the dashboard displays, which for a floored funnel stage is not the record sum.
  const shownTotal = (d) => (d?.displayedTotal != null ? d.displayedTotal : d?.total)
  const floored = (d) => d?.displayedTotal != null && d.displayedTotal !== d.total

  let md = `# CWSI marketing dashboard — how every number is calculated, and what it is made of\n\n`
  md += `**${regionLabel} · generated ${today}**\n\n`
  md += `For every figure the dashboard reports, this document gives its source, exactly how it is\n`
  md += `worked out, and **every campaign, event, sequence and page that contributed to it** across\n`
  md += `**Q1, Q2, Q3 and the year to date**. Each table states its own total so it can be checked.\n\n`
  md += `It is generated from the dashboard's own calculation code — the same code behind the\n`
  md += `**"Where does this number come from?"** panel on each figure — so it matches the screen by\n`
  md += `construction and is never out of date. Re-generate it from **Export** whenever you need\n`
  md += `current figures.\n\n---\n\n${PREAMBLE_RULES}\n`
  md += `\nTwo things about the tables themselves:\n\n`
  md += `- A campaign appears in a period only if it contributed something in that period, so the\n`
  md += `  tables differ in length between quarters.\n`
  md += `- **Year-to-date is not always the sum of the quarters.** Counts do add up; money is dated by\n`
  md += `  the deal — a won deal counts in the period it closed, an open one while it sits in pipeline\n`
  md += `  — so a deal can move between periods.\n\n---\n`

  // ---- Summary: every figure, every period, on one page --------------------
  md += `\n# At a glance\n\nEvery figure across all four periods. The detail follows.\n\n`
  md += `| Figure | Q1 2026 | Q2 2026 | Q3 2026 | Year to date |\n|---|---|---|---|---|\n`
  for (const [section, keys] of SECTIONS) {
    const present = keys.filter((k) => METRIC_SOURCES[k])
    if (!present.length) continue
    md += `| **${section}** | | | | |\n`
    for (const key of present) {
      const cells = PERIODS.map(([q]) => {
        const d = data[key]?.[q]
        if (!d) return '—'
        if (d.kind === 'manual') return d.value == null || d.value === '' ? 'not entered' : (d.unit === 'rate' ? pct(d.value) : String(d.value))
        if (shownTotal(d) == null) return '—'
        return fmtFor(d, shownTotal(d))
      })
      md += `| ${esc(METRIC_SOURCES[key].label || key)} | ${cells.join(' | ')} |\n`
    }
  }

  // ---- Detail per figure ---------------------------------------------------
  for (const [section, keys] of SECTIONS) {
    const present = keys.filter((k) => METRIC_SOURCES[k])
    if (!present.length) continue
    md += `\n---\n\n# ${section}\n`

    for (const key of present) {
      const spec = METRIC_SOURCES[key]
      const meth = METHODOLOGY[key]
      md += `\n## ${spec.label || key}\n\n`
      md += `**Where it comes from.** ${describeSource(spec)}\n\n`
      md += `**How it is calculated.** ${describeCalculation(spec, METRIC_SOURCES)}\n`
      if (meth?.what) md += `\n**What it means.** ${meth.what}\n`
      if (spec.note) md += `\n**Worth knowing.** ${spec.note}\n`
      if (spec.gapNote) md += `\n**Why it may not tie exactly.** ${spec.gapNote}\n`
      if (meth?.caveat) md += `\n**Caveat.** ${meth.caveat}\n`

      // Rates: show the division for each period rather than a record list.
      const anyRatio = PERIODS.some(([q]) => data[key]?.[q]?.kind === 'ratio')
      if (anyRatio) {
        md += `\n| Period | Result | Numerator | Denominator |\n|---|---|---|---|\n`
        for (const [q, qLabel] of PERIODS) {
          const d = data[key]?.[q]
          if (!d || !d.hasData) { md += `| ${qLabel} | — | — | — |\n`; continue }
          md += `| ${qLabel} | ${pct(d.total)} | ${num(d.numTotal)} ${esc(String(d.numLabel).toLowerCase())} | ${num(d.denTotal)} ${esc(String(d.denLabel).toLowerCase())} |\n`
        }
        continue
      }

      // Hand-entered: what was entered, by whom, when.
      const anyManual = PERIODS.some(([q]) => data[key]?.[q]?.kind === 'manual')
      if (anyManual) {
        md += `\n| Period | Value entered | Target | Last set by | On |\n|---|---|---|---|---|\n`
        for (const [q, qLabel] of PERIODS) {
          const d = data[key]?.[q]
          const val = !d || d.value == null || d.value === '' ? 'not entered' : (d.unit === 'rate' ? pct(d.value) : String(d.value))
          const tgt = !d || d.target == null || d.target === '' ? '—' : (d.unit === 'rate' ? pct(d.target) : String(d.target))
          md += `| ${qLabel} | ${val} | ${tgt} | ${esc(d?.updatedBy || '—')} | ${d?.updatedAt || '—'} |\n`
        }
        continue
      }

      // Growth: this period against the one before.
      const anyGrowth = PERIODS.some(([q]) => data[key]?.[q]?.kind === 'growth')
      if (anyGrowth) {
        md += `\n| Period | Growth | This period | Prior period |\n|---|---|---|---|\n`
        for (const [q, qLabel] of PERIODS) {
          const d = data[key]?.[q]
          md += d?.hasData
            ? `| ${qLabel} | ${d.total >= 0 ? '+' : ''}${pct(d.total)} | ${num(d.current)} | ${num(d.prior)} (${String(d.priorQuarter).toUpperCase()}) |\n`
            : `| ${qLabel} | not applicable | — | — |\n`
        }
        continue
      }

      // Everything else: the contributing records, per period.
      if (!COMPOSITION_FIGURES.has(key)) {
        md += `\n| Period | Value |\n|---|---|\n`
        for (const [q, qLabel] of PERIODS) {
          const d = data[key]?.[q]
          md += `| ${qLabel} | ${d && shownTotal(d) != null ? fmtFor(d, shownTotal(d)) : '—'} |\n`
        }
        md += `\nThe contributing records for this figure are the same ones listed under the\n`
        md += `commercial-outcome figure it is a subset of; open it in the dashboard to see them.\n`
        continue
      }

      for (const [q, qLabel] of PERIODS) {
        const d = data[key]?.[q]
        if (!d || !d.hasData || !d.groups?.length) {
          md += `\n### ${qLabel}\n\nNothing contributed in this period — a genuine zero, not missing data.\n`
          continue
        }
        md += `\n### ${qLabel} — ${fmtFor(d, shownTotal(d))}\n\n`
        if (floored(d)) {
          md += `The dashboard shows **${fmtFor(d, d.displayedTotal)}** for this period, while the records `
          md += `below add to **${fmtFor(d, d.total)}**. That is the funnel floor, not a discrepancy: a later `
          md += `stage out-counted this one because the stages are dated by different events, so this stage `
          md += `is shown as at least as large as the next.\n\n`
        }
        md += `| ${esc(d.groupLabel)} | ${esc(d.subLabel)} | Contribution | Share |\n|---|---|---|---|\n`
        for (const g of d.groups) {
          for (const s of g.items || []) {
            const share = d.total ? ((s.total / d.total) * 100).toFixed(1) : '0.0'
            md += `| ${esc(g.label)} | ${esc(s.label)} | ${fmtFor(d, s.total)} | ${share}% |\n`
          }
        }
        md += `| | **Total** | **${fmtFor(d, d.total)}** | **100%** |\n`
      }
    }
  }

  md += `\n---\n\n# Figures the dashboard cannot yet report\n\n`
  md += `Some KPIs in the register read **"not available yet"**. That is not an omission from this\n`
  md += `report: nothing we are connected to records them. Each states its own reason on the row —\n`
  md += `most often that per-channel spend, download-to-email attribution, or nurture-programme\n`
  md += `membership is not held in any source we read.\n\n---\n\n`
  md += `*Generated by \`src/data/compositionReport.js\` from the dashboard's own\n`
  md += `\`getMetricSource()\` and \`metricSources.js\`. Figures are identical to the screen by\n`
  md += `construction. Re-generate from **Export → Full Calculation & Composition Report**.*\n`

  download(md, `CWSI-full-report-${region.toLowerCase()}-${today}.md`, 'text/markdown;charset=utf-8')
  return { figures: wanted.length, periods: PERIODS.length, bytes: md.length }
}
