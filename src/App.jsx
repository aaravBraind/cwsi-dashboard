import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { Loading } from './components/States'
import Login from './components/pages/Login'
import Settings from './components/pages/Settings'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './components/pages/Overview'
import KpiTracker from './components/pages/KpiTracker'
import Pipeline from './components/pages/Pipeline'
import Channel from './components/pages/Channel'
import Seo from './components/pages/Seo'
import Events from './components/pages/Events'
import Outreach from './components/pages/Outreach'
import Board from './components/pages/Board'
import Salesforce from './components/pages/Salesforce'
import Export from './components/pages/Export'
import { channelByPage } from './data/constants'

export default function App() {
  const { session, loading } = useAuth()
  const [active, setActive] = useState('overview')

  // Auth gate: resolve the stored session first, then either the login screen
  // (no session) or the dashboard. Every data read below runs as the
  // authenticated user, so this gate also gates the data.
  if (loading) return <Loading label="Loading…" />
  if (!session) return <Login />

  const renderPage = () => {
    switch (active) {
      case 'overview': return <Overview />
      case 'kpi': return <KpiTracker />
      case 'pipeline': return <Pipeline />
      case 'ch-outreach': return <Outreach />
      case 'ch-seo': return <Seo />
      case 'ch-events': return <Events />
      case 'board': return <Board />
      case 'salesforce': return <Salesforce />
      case 'export': return <Export />
      case 'settings': return <Settings />
      default: {
        const ch = channelByPage(active)
        if (ch) return <Channel key={ch.page} channel={ch} />
        return <Overview />
      }
    }
  }

  return (
    <div className="app">
      <Sidebar active={active} onNavigate={setActive} />
      <Topbar active={active} onNavigate={setActive} />
      <main className="main">
        <div className="content">
          {/* one page mounted at a time; `.page.active` keeps the fade-in animation */}
          <div className="page active">{renderPage()}</div>
        </div>
      </main>
    </div>
  )
}
