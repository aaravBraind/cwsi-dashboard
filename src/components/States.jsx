// Shared loading / error / empty / not-available states.

// Default page-level loader: a centered, branded spinner with a soft-pulsing
// label. role=status + aria-live so screen readers announce the loading state.
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" />
      <div className="loading-label">{label}</div>
    </div>
  )
}

// Shimmer-skeleton building blocks for layout-matched loading (feels faster than
// a spinner because the page keeps its shape). Use LoadingSkeleton for the common
// "KPI row + panel" pages, or compose Skeleton / SkeletonPanel directly.
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function SkeletonKpis({ count = 3 }) {
  return (
    <div className="skel-kpis">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skel-kpi" key={i}>
          <Skeleton className="skel-line sm" style={{ width: '45%' }} />
          <Skeleton className="skel-line lg" style={{ width: '70%' }} />
          <Skeleton className="skel-line sm" style={{ width: '35%' }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPanel({ rows = 5 }) {
  return (
    <div className="skel-panel">
      <div className="skel-panel-head">
        <Skeleton className="skel-line" style={{ width: '30%' }} />
      </div>
      <div className="skel-panel-body">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton className="skel-line" key={i} style={{ width: `${90 - i * 9}%` }} />
        ))}
      </div>
    </div>
  )
}

// Common page shape: a KPI row above a panel. Drop-in alternative to <Loading/>.
export function LoadingSkeleton({ kpis = 3, rows = 5 }) {
  return (
    <div role="status" aria-live="polite" style={{ animation: 'fadeIn .3s ease' }}>
      <SkeletonKpis count={kpis} />
      <SkeletonPanel rows={rows} />
    </div>
  )
}

export function ErrorState({ error }) {
  return (
    <div className="callout amber">
      <div className="callout-icn">
        <svg className="icon icon-lg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="callout-body">
        <strong>Couldn’t load data.</strong> {String(error?.message || error)}
      </div>
    </div>
  )
}

// Distinct from a real 0 — "no rows for this region/quarter".
export function EmptyState({ message = 'No data for this region / quarter.' }) {
  return (
    <div className="callout">
      <div className="callout-icn">
        <svg className="icon icon-lg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <div className="callout-body">{message}</div>
    </div>
  )
}

// A measure that the store cannot serve yet (spend, clicks, meetings, …).
// Never zero-filled.
export function NotAvailable({ what = 'This measure', why }) {
  return (
    <span className="info-pill" title={why || 'Not available in the current data set'}>
      {what}: not available yet
    </span>
  )
}

export function NotAvailablePanel({ title, what, why }) {
  return (
    <div className="panel">
      {title && (
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">{title}</div>
          </div>
          <span className="chip neu">Not available yet</span>
        </div>
      )}
      <div className="panel-body">
        <div className="callout">
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            <strong>{what} is not available yet.</strong> {why}
          </div>
        </div>
      </div>
    </div>
  )
}

// Convenience wrapper for query states around a render function.
export function Async({ query, children, empty }) {
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState error={query.error} />
  if (empty && empty(query.data)) return <EmptyState />
  return children(query.data)
}
