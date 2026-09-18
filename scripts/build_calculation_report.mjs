// Generates docs/kpi/HOW_EVERY_NUMBER_IS_CALCULATED.md from the dashboard's OWN code.
//
// Margot, 8 Sep 2026: "can we create a report on the basis of current data, how each number
// is calculated as we are showing in the dashboard?"
//
// Why generate rather than write it: the calculation rules live in metricSources.js (source,
// columns, scoping, caveats) and methodology.js (the client-facing explanation). A
// hand-written report would drift from them within a week. This reads both, so the document
// cannot describe a calculation the dashboard is not actually doing.
//
//   node scripts/build_calculation_report.mjs
//
// Live VALUES are not read here — the dashboard's reads run as an authenticated user and this
// script has no session. Values go in the dated appendix, produced separately; the body is
// evergreen.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src', 'data')

// Node does not resolve Vite's extensionless imports, so rewrite them to absolute paths in a
// temp copy rather than restructuring the app's imports for the sake of a script.
async function loadModule(file) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8')
  const fixed = raw.replace(/from '\.\/([A-Za-z0-9_]+)'/g, (_, m) => `from '${path.join(SRC, m)}.js'`)
  const tmp = path.join(ROOT, `._gen_${file}`)
  fs.writeFileSync(tmp, fixed)
  try {
    return await import(`file://${tmp}`)
  } finally {
    fs.unlinkSync(tmp)
  }
}

const { METRIC_SOURCES } = await loadModule('metricSources.js')
const NARRATIVE = await loadModule('metricNarrative.js')
const { METHODOLOGY } = await loadModule('methodology.js').then((m) => ({
  METHODOLOGY: m.METHODOLOGY || m.default || {},
}))

// Prose comes from src/data/metricNarrative.js, shared with the in-app report, so the two
// documents can never describe the same figure differently.
const { SECTIONS, describeSource, describeCalculation } = NARRATIVE

// ---- Build ----------------------------------------------------------------
const seen = new Set()
let md = `# How every number on the dashboard is calculated

**CWSI marketing dashboard · generated ${new Date().toISOString().slice(0, 10)}**

This lists every figure the dashboard reports, where it comes from, and exactly how it is worked
out. It is **generated from the dashboard's own code**, so it cannot describe a calculation the
dashboard is not actually performing.

Every figure listed here can also be opened in the dashboard itself: click
**"Where does this number come from?"** beneath it on the KPI Tracker to see the individual
campaigns and records that make it up, with a CSV of every contributing row.

---

${NARRATIVE.PREAMBLE_RULES}

---
`

for (const [section, keys] of SECTIONS) {
  const present = keys.filter((k) => METRIC_SOURCES[k])
  if (!present.length) continue
  md += `\n## ${section}\n`
  for (const key of present) {
    seen.add(key)
    const s = METRIC_SOURCES[key]
    const meth = METHODOLOGY[key]
    md += `\n### ${s.label || key}\n\n`
    md += `**Source.** ${describeSource(s)}\n\n`
    md += `**How it is calculated.** ${describeCalculation(s, METRIC_SOURCES)}\n`
    if (s.note) md += `\n**Worth knowing.** ${s.note}\n`
    if (s.gapNote) md += `\n**Why it may not tie exactly.** ${s.gapNote}\n`
    if (meth?.what) md += `\n**What it means.** ${meth.what}\n`
    if (meth?.caveat) md += `\n**Caveat.** ${meth.caveat}\n`
  }
}

const rest = Object.keys(METRIC_SOURCES).filter((k) => !seen.has(k))
if (rest.length) {
  md += `\n## Other figures\n`
  for (const key of rest) {
    const s = METRIC_SOURCES[key]
    md += `\n### ${s.label || key}\n\n**Source.** ${describeSource(s)}\n\n**How it is calculated.** ${describeCalculation(s, METRIC_SOURCES)}\n`
    if (s.note) md += `\n**Worth knowing.** ${s.note}\n`
  }
}

md += `\n---\n\n## Figures the dashboard cannot yet report\n
Some KPIs in the register show **"not available yet"**. That is not a gap in this report: no system
we are connected to records them. Each states its own reason on the row — most commonly that the
per-channel spend, the download-to-email attribution, or the nurture-programme membership is not
recorded in any source we read.\n
---\n\n*Generated from \`src/data/metricSources.js\` and \`src/data/methodology.js\` by
\`scripts/build_calculation_report.mjs\`. Re-run it after any change to how a figure is calculated.*\n`

const outPath = path.join(ROOT, 'docs', 'kpi', 'HOW_EVERY_NUMBER_IS_CALCULATED.md')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, md)
console.log(`Wrote ${outPath}`)
console.log(`  ${seen.size} figures in sections, ${rest.length} other, ${Object.keys(METRIC_SOURCES).length} total`)
