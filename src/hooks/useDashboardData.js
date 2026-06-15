import { useQuery } from '@tanstack/react-query'
import { useFilters } from '../filters/FilterContext'
import { getFxEurToGbp } from '../data/fx'
import {
  getOverview,
  getKpiTracker,
  getPipeline,
  getChannel,
  getCampaignsForChannel,
  getLinkedInSnapshot,
  getMarketingSpend,
  getOutreach,
  getOutreachSteps,
  getWebTraffic,
  getSeo,
} from '../data/queries'

// Each hook reads the active filters from context, so every consumer re-scopes
// whenever region / quarter / channel / campaign / pillar change.

export function useOverview() {
  const { filters } = useFilters()
  return useQuery({ queryKey: ['overview', filters], queryFn: () => getOverview(filters) })
}

export function useKpiTracker() {
  const { filters } = useFilters()
  return useQuery({ queryKey: ['kpi', filters], queryFn: () => getKpiTracker(filters) })
}

export function usePipeline() {
  const { filters } = useFilters()
  return useQuery({ queryKey: ['pipeline', filters], queryFn: () => getPipeline(filters) })
}

export function useChannel(channelName) {
  const { filters } = useFilters()
  // channel page owns its channel; strip any global channel filter.
  const { channel, ...rest } = filters
  return useQuery({
    queryKey: ['channel', channelName, rest],
    queryFn: () => getChannel(channelName, rest),
  })
}

export function useCampaigns(channelId) {
  return useQuery({
    queryKey: ['campaigns', channelId],
    queryFn: () => getCampaignsForChannel(channelId),
  })
}

// LinkedIn delivery snapshot — region-scoped; quarter intentionally excluded
// (cumulative snapshot, not a quarter slice).
export function useLinkedInSnapshot() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['linkedin-snapshot', filters.region],
    queryFn: () => getLinkedInSnapshot({ region: filters.region }),
  })
}

// EUR marketing budget/spend — scoped by region + quarter.
export function useMarketingSpend() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['marketing-spend', filters.region, filters.quarter],
    queryFn: () => getMarketingSpend({ region: filters.region, quarter: filters.quarter }),
  })
}

// Outreach engagement snapshot — region (global) + pillar scoped. Pillar is
// passed in as PAGE-LOCAL state (not the global filter) because pillar_name is
// null across v_fact_enriched, so a global pillar would empty the other pages.
export function useOutreach(pillar = null) {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['outreach', filters.region, pillar],
    queryFn: () => getOutreach({ region: filters.region, pillar }),
  })
}

// EUR→GBP rate, pinned per day. staleTime Infinity so it's fetched once and
// reused across the session (the day-pinning + localStorage live in fx.js).
export function useFxRate() {
  return useQuery({
    queryKey: ['fx-eur-gbp'],
    queryFn: getFxEurToGbp,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

// Outreach per-step (email steps only) — region + page-local pillar scoped.
export function useOutreachSteps(pillar = null) {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['outreach-steps', filters.region, pillar],
    queryFn: () => getOutreachSteps({ region: filters.region, pillar }),
  })
}

// GA4 web traffic — region + quarter scoped.
export function useWebTraffic() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['web-traffic', filters.region, filters.quarter],
    queryFn: () => getWebTraffic({ region: filters.region, quarter: filters.quarter }),
  })
}

// Search Console — region + quarter scoped (top-pages table is quarter-only).
export function useSeo() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['seo', filters.region, filters.quarter],
    queryFn: () => getSeo({ region: filters.region, quarter: filters.quarter }),
  })
}
