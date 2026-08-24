import { useUpdateCampaignOverride } from '../hooks/useDashboardData'

// Editable REGION for a campaign (campaign_overrides.regions).
//
// Margot, 20 Aug — two asks that are really one:
//   "What regional value should I select for activities that span across the entire group?"
//   "If I update the region for a specific campaign, will the regional overviews update
//    automatically to reflect this change?"
// …plus the LinkedIn case: "The Data That Moves campaign covered BeNeLux, so it should
// include the Netherlands as well."
//
// So a campaign's region is a SET, not a single value, and the set is authoritative: the
// regional views filter on it (see overrideRegionMap in queries.js), rather than on the
// region derived from each deal's Salesforce account. "Auto" clears the override and hands
// the campaign back to that derived region.
const PRESETS = [
  { id: 'auto', label: 'Auto (from Salesforce)', regions: null },
  { id: 'UKI', label: 'UKI', regions: ['UKI'] },
  { id: 'BeLux', label: 'BeLux', regions: ['BeLux'] },
  { id: 'NL', label: 'NL', regions: ['NL'] },
  { id: 'BeNeLux', label: 'BeNeLux (BeLux + NL)', regions: ['BeLux', 'NL'] },
  { id: 'Group', label: 'Group — all regions', regions: ['UKI', 'BeLux', 'NL'] },
]

const idOf = (regions) => {
  if (!Array.isArray(regions) || regions.length === 0) return 'auto'
  const key = [...regions].sort().join(',')
  return PRESETS.find((p) => p.regions && [...p.regions].sort().join(',') === key)?.id || 'auto'
}

export default function RegionSelect({ campaignKey, regions, original }) {
  const upd = useUpdateCampaignOverride()
  if (!campaignKey) return <span>{original || '—'}</span>

  const current = idOf(regions)
  const overridden = current !== 'auto'

  return (
    <select
      className="region-select"
      value={current}
      title={overridden ? `Salesforce region: ${original || 'none'}` : 'Set by Salesforce — pick a value to override'}
      style={{ font: 'inherit', padding: '2px 4px', opacity: overridden ? 1 : 0.75 }}
      onChange={(e) => {
        const preset = PRESETS.find((p) => p.id === e.target.value)
        upd.mutate({ campaignKey, field: 'regions', value: preset?.regions ?? null })
      }}
    >
      {PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id === 'auto' && original ? `Auto — ${original}` : p.label}
        </option>
      ))}
    </select>
  )
}
