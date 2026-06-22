import { I } from './icons'

const NAV = [
  { group: 'Performance' },
  { page: 'overview', label: 'Overview', icon: I.grid, badge: { kind: 'live', text: 'Live' } },
  { page: 'kpi', label: 'KPI Tracker', icon: I.chart, badge: { kind: 'num', text: '24' } },
  { page: 'pipeline', label: 'Pipeline Report', icon: I.target },
  { divider: true },
  { group: 'Channels' },
  { page: 'ch-linkedin', label: 'LinkedIn Paid', icon: I.linkedin },
  { page: 'ch-search', label: 'Paid Search', icon: I.search },
  { page: 'ch-seo', label: 'Organic SEO', icon: I.globe },
  { page: 'ch-email', label: 'Email', icon: I.mail },
  { page: 'ch-outreach', label: 'Outreach.io', icon: I.eye, badge: { kind: 'live', text: 'New' } },
  { page: 'ch-events', label: 'Events', icon: I.calendar, badge: { kind: 'live', text: 'Live' } },
  { divider: true },
  { group: 'Reporting' },
  { page: 'board', label: 'Board Pack', icon: I.board },
  { page: 'salesforce', label: 'Salesforce Sync', icon: I.box },
  { page: 'export', label: 'Export', icon: I.download },
]

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          src="https://cwsisecurity.com/wp-content/themes/bootscore-child/assets/img/logo/cwsi-logo.svg"
          alt="CWSI"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling.style.display = 'block'
          }}
        />
        <div className="logo-fallback" style={{ display: 'none' }}>
          CWSI<span>.</span>
        </div>
        <div className="brand-tag">FY26</div>
      </div>

      <nav className="nav">
        {NAV.map((item, i) => {
          if (item.group) return <div className="nav-label" key={`g${i}`}>{item.group}</div>
          if (item.divider) return <div className="nav-divider" key={`d${i}`} />
          return (
            <div
              key={item.page}
              className={`nav-item${active === item.page ? ' active' : ''}`}
              onClick={() => onNavigate(item.page)}
            >
              <span className="nav-icon">
                <svg className="icon" viewBox="0 0 24 24">{item.icon}</svg>
              </span>
              <span>{item.label}</span>
              {item.badge && (
                <span className={`nav-badge ${item.badge.kind}`}>{item.badge.text}</span>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="live-dot" />
        <div>Synced · <Timestamp /></div>
      </div>
    </aside>
  )
}

function Timestamp() {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return <span id="ts">{t}</span>
}
