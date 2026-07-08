import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFilters } from '../filters/FilterContext'
import { getFxEurToGbp } from '../data/fx'
import { getBoardPack } from '../data/boardPack'
import { generateBoardNarrative, saveBoardPack, getLatestBoardPack } from '../data/boardPackClient'
import {
  getOverview,
  getKpiTracker,
  getKpiTargets,
  updateKpiTarget,
  getCampaignOverrides,
  upsertCampaignOverride,
  getPipeline,
  getCurrentVsOngoing,
  getOpportunityStage,
  getChannel,
  getEmailReport,
  getCampaignsForChannel,
  getCampaignThemes,
  getLinkedInSnapshot,
  getEmailEngagement,
  getMarketingSpend,
  getOutreach,
  getOutreachAttributedMeetings,
  getOutreachSteps,
  getEvents,
  getEventTypeFunnel,
  getEventsDetail,
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

// Editable KPI target register (kpi_targets table). Filter-independent — one set
// of targets for the whole dashboard; the KPI Tracker picks the active-quarter
// column at render. staleTime keeps it cached across quarter switches.
export function useKpiTargets() {
  return useQuery({ queryKey: ['kpi-targets'], queryFn: getKpiTargets, staleTime: 5 * 60 * 1000 })
}

// Save one period's target, then refresh the register so %-of-target + status
// lights recompute immediately.
export function useUpdateKpiTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kpiKey, period, value }) => updateKpiTarget(kpiKey, period, value),
    // Refresh both the target register (KPI Tracker + Overview read it) and the
    // board pack (which bakes targets into its computed figure set) so a target
    // edit recomputes everywhere.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpi-targets'] })
      qc.invalidateQueries({ queryKey: ['board-pack'] })
    },
  })
}

export function usePipeline() {
  const { filters } = useFilters()
  return useQuery({ queryKey: ['pipeline', filters], queryFn: () => getPipeline(filters) })
}

// Current-quarter activity vs ongoing impact of prior-quarter activities (X6) — region +
// quarter scoped. Optional `channel` override scopes it to one channel (EV5: Events page).
export function useCurrentVsOngoing(channel = null) {
  const { filters } = useFilters()
  const scoped = channel ? { ...filters, channel } : filters
  return useQuery({ queryKey: ['current-vs-ongoing', scoped], queryFn: () => getCurrentVsOngoing(scoped) })
}

// Editable campaign overrides (campaign_overrides table). Filter-independent — one
// map for the whole dashboard, keyed by campaign_key; components apply the friendly
// name/region over the Salesforce value. Cached; a rename invalidates it so every
// surface re-renders with the new label. Persists across re-ingests.
export function useCampaignOverrides() {
  return useQuery({ queryKey: ['campaign-overrides'], queryFn: getCampaignOverrides, staleTime: 5 * 60 * 1000 })
}

export function useUpdateCampaignOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignKey, field, value }) => upsertCampaignOverride(campaignKey, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-overrides'] })
      qc.invalidateQueries({ queryKey: ['campaign-themes'] }) // a theme re-assignment regroups the rollup
    },
  })
}

// Pipeline stage distribution — open-pipeline snapshot, region-scoped only (quarter
// intentionally excluded; it's a current-state snapshot, not a quarter slice).
export function useOpportunityStage() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['opportunity-stage', filters.region],
    queryFn: () => getOpportunityStage({ region: filters.region }),
  })
}

export function useChannel(channelName, campaign = 'all', excludeTypes = null) {
  const { filters } = useFilters()
  // The channel page owns its channel *and* its campaign selection (passed in as
  // page-local state). Strip the global `channel` and `campaign` so a campaign
  // picked on one channel page can never leak onto another channel page, the SEO
  // page (also uses useChannel), or any applyFilters-based page (Overview,
  // Pipeline, Board…). Region + quarter still come from the global filters.
  // excludeTypes (optional) drops rows by campaign_type — e.g. SEO excludes
  // "Content/White Paper" (those are reported on the Email page).
  const { channel, campaign: _globalCampaign, ...rest } = filters
  const scoped = { ...rest, campaign }
  return useQuery({
    queryKey: ['channel', channelName, scoped, excludeTypes],
    queryFn: () => getChannel(channelName, scoped, excludeTypes),
  })
}

// Email page — the named whitepaper/workflow campaigns, scoped by campaign_key.
// Region + quarter only (the campaigns span SEO + Email channels).
export function useEmailReport() {
  const { filters } = useFilters()
  const scoped = { region: filters.region, quarter: filters.quarter }
  return useQuery({ queryKey: ['email-report', scoped], queryFn: () => getEmailReport(scoped) })
}

// Campaign-level theme rollup (X4/G3) — region + quarter scoped.
export function useCampaignThemes() {
  const { filters } = useFilters()
  return useQuery({ queryKey: ['campaign-themes', filters], queryFn: () => getCampaignThemes(filters) })
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

// Email engagement snapshot — region-scoped; quarter intentionally excluded
// (lifetime per-campaign snapshot, not a quarter slice), mirroring LinkedIn.
export function useEmailEngagement() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['email-engagement', filters.region],
    queryFn: () => getEmailEngagement({ region: filters.region }),
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
export function useOutreach(workstream = null, marketingOnly = true) {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['outreach', filters.region, workstream, marketingOnly],
    queryFn: () => getOutreach({ region: filters.region, workstream, marketingOnly }),
  })
}

// Outreach → SF meeting attribution (CC-6) — region + quarter (global) scoped.
// Pillar does NOT apply (meetings aren't practice-area tagged), so it's excluded.
export function useOutreachAttributedMeetings() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['outreach-attributed-meetings', filters.region, filters.quarter],
    queryFn: () => getOutreachAttributedMeetings({ region: filters.region, quarter: filters.quarter }),
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

// Webinar events (GoToWebinar attendance) — region + quarter scoped.
export function useEvents() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['events', filters.region, filters.quarter],
    queryFn: () => getEvents({ region: filters.region, quarter: filters.quarter }),
  })
}

// MQL rate by event type (Events & Webinars channel split by Campaign.Type).
export function useEventTypeFunnel() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['event-type-funnel', filters.region, filters.quarter],
    queryFn: () => getEventTypeFunnel({ region: filters.region, quarter: filters.quarter }),
  })
}

// Event-campaign detail (per-campaign SF funnel + types + by-type) — region + quarter scoped.
export function useEventsDetail() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['events-detail', filters.region, filters.quarter],
    queryFn: () => getEventsDetail({ region: filters.region, quarter: filters.quarter }),
  })
}

// ---- Board Pack (T-7) ----------------------------------------------------
// The figure set: every board number the app computes from the warehouse, in the
// agreed metric order, with gaps-to-close + ranked levers. Region + quarter scoped.
export function useBoardPack() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['board-pack', filters.region, filters.quarter],
    queryFn: () => getBoardPack({ region: filters.region, quarter: filters.quarter }),
  })
}

// The latest TRACE-PASSED pack saved for the active scope. Read path for the
// archive: lets the Board page re-hydrate the last published narrative on load,
// since the generate-mutation's result is in-memory only and lost on refresh.
export function useSavedBoardPack() {
  const { filters } = useFilters()
  return useQuery({
    queryKey: ['board-pack-saved', filters.region, filters.quarter],
    queryFn: () => getLatestBoardPack({ region: filters.region, quarter: filters.quarter }),
  })
}

// Generate the AI narrative + recommendations. mutate(figureSet) POSTs the
// computed figures to the n8n→Claude webhook, then validates every returned
// number against the figure set (trace-to-data). Manual trigger — exec generation
// is never automatic on page load.
export function useGenerateBoardPack() {
  const { filters } = useFilters()
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['board-pack-generate'],
    mutationFn: (figureSet) => generateBoardNarrative(figureSet),
    // Persist trace-passed packs (figure set stored FROZEN alongside the narrative)
    // so they can be re-exported + kept as history. Scope is the active region/quarter.
    // A save failure must never break the on-screen result — swallow + log only.
    // On a successful save, refresh the saved-pack read so the archive (which the
    // Board page falls back to after refresh) reflects this newly published pack.
    onSuccess: (generated, figureSet) => {
      saveBoardPack({ region: filters.region, quarter: filters.quarter, figureSet, generated })
        .then(() => qc.invalidateQueries({ queryKey: ['board-pack-saved', filters.region, filters.quarter] }))
        .catch((e) => console.error('Board pack persist failed (narrative still shown):', e))
    },
  })
}
