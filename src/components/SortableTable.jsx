import { useState, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Click-to-sort table headers.
//
// Robin, review call — asked whether the campaign list could be ordered "best to
// worst" rather than by recency. Rather than pick one ranking for everyone, every
// numeric column becomes sortable, so the reader chooses: most MQLs, biggest open
// pipeline, most revenue.
//
// Usage:
//   const { rows, sortProps } = useSortable(campaigns, 'pipeline')
//   <SortTh {...sortProps('mql')} className="r">MQLs</SortTh>
//
// Numbers sort high→low on first click (the useful direction for performance
// columns); text sorts A→Z first. Clicking the active column flips it. Values that
// are missing — null, undefined or the "n/a" sentinel — always sink to the bottom
// regardless of direction, so an unpopulated column never buries the real data.
// ─────────────────────────────────────────────────────────────────────────────

const isBlank = (v) => v == null || (typeof v === 'number' && !Number.isFinite(v)) || Number.isNaN(v)

export function useSortable(rows, defaultKey = null, defaultDir = 'desc') {
  const [sort, setSort] = useState(defaultKey ? { key: defaultKey, dir: defaultDir } : null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    // Copy first: the caller's array is often memoised query data we must not mutate.
    return [...rows].sort((a, b) => {
      const x = a?.[key]
      const y = b?.[key]
      const bx = isBlank(x)
      const by = isBlank(y)
      if (bx && by) return 0
      if (bx) return 1 // blanks last, in both directions
      if (by) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * mul
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * mul
    })
  }, [rows, sort])

  const sortProps = (key, type = 'number') => ({
    active: sort?.key === key,
    dir: sort?.key === key ? sort.dir : null,
    onSort: () =>
      setSort((s) =>
        s && s.key === key
          ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
          : { key, dir: type === 'text' ? 'asc' : 'desc' },
      ),
  })

  return { rows: sorted, sortProps, sort }
}

// A <th> that sorts on click. Renders as a button for keyboard + screen-reader
// access, and reports the current direction through aria-sort.
export function SortTh({ active, dir, onSort, className = '', children, title }) {
  return (
    <th
      className={`${className} sort-th${active ? ' is-sorted' : ''}`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="sort-btn"
        onClick={onSort}
        title={title || 'Sort by this column'}
      >
        <span>{children}</span>
        <span className="sort-caret" aria-hidden="true">
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  )
}
