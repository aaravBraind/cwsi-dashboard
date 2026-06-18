import { useEffect, useRef, useState } from 'react'
import { REGIONS } from '../data/constants'
import { useFilters } from '../filters/FilterContext'
import { useAuth, displayName } from '../auth/AuthContext'

const CRUMB = {
  overview: 'Overview', kpi: 'KPI Tracker', pipeline: 'Pipeline Report',
  'ch-linkedin': 'LinkedIn Paid', 'ch-search': 'Paid Search', 'ch-seo': 'Organic SEO',
  'ch-email': 'Email', 'ch-outreach': 'Outreach.io', 'ch-events': 'Events',
  board: 'Board Pack', salesforce: 'Salesforce Sync', export: 'Export',
  settings: 'Account Settings',
}

export default function Topbar({ active, onNavigate }) {
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
        <UserMenu onNavigate={onNavigate} />
      </div>
    </header>
  )
}

// Avatar button with a dropdown for account settings + sign out. Closes on
// outside-click and on Escape.
function UserMenu({ onNavigate }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = displayName(user)
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="avatar"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.email}
      >
        {initial}
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <div className="user-dropdown-name">{name}</div>
            <div className="user-dropdown-email">{user?.email}</div>
          </div>
          <button
            className="user-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNavigate('settings')
            }}
          >
            Account settings
          </button>
          <button
            className="user-dropdown-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
