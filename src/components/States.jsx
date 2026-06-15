// Shared loading / error / empty / not-available states. They reuse the
// artifact's existing classes (callout, info-pill) so styling is unchanged.

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="callout">
      <div className="callout-icn">
        <svg className="icon icon-lg" viewBox="0 0 24 24">
          <path d="M3 12a9 9 0 1 0 9-9" />
        </svg>
      </div>
      <div className="callout-body">{label}</div>
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
    <span className="info-pill" title={why || 'Not available in the current schema'}>
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
