import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './components/pages/Overview'
import KpiTracker from './components/pages/KpiTracker'
import Pipeline from './components/pages/Pipeline'
import Channel from './components/pages/Channel'
import Outreach from './components/pages/Outreach'
import Board from './components/pages/Board'
import Salesforce from './components/pages/Salesforce'
import Export from './components/pages/Export'
import { channelByPage } from './data/constants'

export default function App() {
  const [active, setActive] = useState('overview')

  const renderPage = () => {
    switch (active) {
      case 'overview': return <Overview />
      case 'kpi': return <KpiTracker />
      case 'pipeline': return <Pipeline />
      case 'ch-outreach': return <Outreach />
      case 'board': return <Board />
      case 'salesforce': return <Salesforce />
      case 'export': return <Export />
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
      <Topbar active={active} />
      <main className="main">
        <div className="content">
          {/* one page mounted at a time; `.page.active` keeps the fade-in animation */}
          <div className="page active">{renderPage()}</div>
        </div>
      </main>
    </div>
  )
}
