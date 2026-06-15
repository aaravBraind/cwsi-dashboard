import { REGIONS } from '../data/constants'
import { useFilters } from '../filters/FilterContext'

const CRUMB = {
  overview: 'Overview', kpi: 'KPI Tracker', pipeline: 'Pipeline Report',
  'ch-linkedin': 'LinkedIn Paid', 'ch-search': 'Paid Search', 'ch-seo': 'Organic SEO',
  'ch-email': 'Email', 'ch-outreach': 'Outreach.io', 'ch-events': 'Events',
  board: 'Board Pack', salesforce: 'Salesforce Sync', export: 'Export',
}

export default function Topbar({ active }) {
  const { filters, setRegion } = useFilters()
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="crumb">
          <span>Marketing Intelligence</span>
          <span className="sep">/</span>
          <span className="here">{CRUMB[active] || 'Overview'}</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="region-tabs">
          {REGIONS.map((r) => (
            <button
              key={r.key}
              className={filters.region === r.key ? 'on' : ''}
              onClick={() => setRegion(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button className="btn">
          <svg className="icon-sm icon" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>{' '}
          Comments
        </button>
        <button className="btn primary">
          <svg className="icon-sm icon" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>{' '}
          Export
        </button>
        <div className="avatar">M</div>
      </div>
    </header>
  )
}
