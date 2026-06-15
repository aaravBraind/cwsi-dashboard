import { QUARTER_PILLS } from '../data/constants'
import { useFilters } from '../filters/FilterContext'

// Quarter is global (context), so a change re-scopes every figure on the page.
export default function QuarterPills() {
  const { filters, setQuarter } = useFilters()
  return (
    <div className="page-head-actions">
      <div className="quarter-pills">
        {QUARTER_PILLS.map((p) => (
          <button
            key={p.q}
            className={filters.quarter === p.q ? 'on' : ''}
            onClick={() => setQuarter(p.q)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
