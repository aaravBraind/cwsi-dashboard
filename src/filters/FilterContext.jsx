import { createContext, useContext, useMemo, useState } from 'react'

// Holds the active filter scope shared across the whole dashboard.
//   region:   'all' | 'UKI' | 'BeLux' | 'NL'        (topbar tabs)
//   quarter:  'q1' | 'q2' | 'q3' | 'q4' | 'ytd'     (quarter pills)
//   channel:  channel_name | null                   (set by channel pages)
//   campaign: campaign_key | 'all'                  (campaign picker)
//   pillar:   pillar_name | '__unmapped__' | null
//
// 'all' region applies no region predicate (so it INCLUDES Unassigned).
// 'ytd' applies no quarter predicate (year = REPORTING_YEAR only).
const FilterContext = createContext(null)

const DEFAULTS = {
  region: 'all',
  quarter: 'q2',
  channel: null,
  campaign: 'all',
  pillar: null,
}

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULTS)

  const value = useMemo(() => {
    const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }))
    return {
      filters,
      setFilter,
      setRegion: (region) => setFilter('region', region),
      setQuarter: (quarter) => setFilter('quarter', quarter),
      setCampaign: (campaign) => setFilter('campaign', campaign),
      setPillar: (pillar) => setFilter('pillar', pillar),
      reset: () => setFilters(DEFAULTS),
    }
  }, [filters])

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used within FilterProvider')
  return ctx
}
