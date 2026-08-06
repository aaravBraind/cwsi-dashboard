import { useState } from 'react'
import { useAuth, displayName } from '../../auth/AuthContext'
import { useDataFreshness } from '../../hooks/useDashboardData'
import { num } from '../../data/format'

// Account self-service: change display name and password. Rendered as a normal
// dashboard page (inside the shell). Each form reports its own success/error.
export default function Settings() {
  const { user, updateDisplayName, updatePassword } = useAuth()

  const [name, setName] = useState(displayName(user))
  const [nameState, setNameState] = useState({ busy: false, msg: '', err: '' })

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwState, setPwState] = useState({ busy: false, msg: '', err: '' })

  async function saveName(e) {
    e.preventDefault()
    setNameState({ busy: true, msg: '', err: '' })
    const { error } = await updateDisplayName(name.trim())
    setNameState({
      busy: false,
      msg: error ? '' : 'Display name updated.',
      err: error?.message || '',
    })
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pw.length < 8) {
      setPwState({ busy: false, msg: '', err: 'Password must be at least 8 characters.' })
      return
    }
    if (pw !== pw2) {
      setPwState({ busy: false, msg: '', err: 'Passwords do not match.' })
      return
    }
    setPwState({ busy: true, msg: '', err: '' })
    const { error } = await updatePassword(pw)
    if (error) {
      setPwState({ busy: false, msg: '', err: error.message })
      return
    }
    setPw('')
    setPw2('')
    setPwState({ busy: false, msg: 'Password changed.', err: '' })
  }

  return (
    <div className="settings">
      <div className="page-head">
        <h1 className="page-title">Account settings</h1>
        <p className="page-sub">Signed in as {user?.email}</p>
      </div>

      <div className="panel settings-panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Profile</div>
          </div>
        </div>
        <div className="panel-body">
          <form onSubmit={saveName}>
            {nameState.err && <div className="auth-alert error">{nameState.err}</div>}
            {nameState.msg && <div className="auth-alert notice">{nameState.msg}</div>}
            <label className="field">
              <span className="field-label">Display name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <button className="btn primary" type="submit" disabled={nameState.busy}>
              {nameState.busy ? 'Saving…' : 'Save name'}
            </button>
          </form>
        </div>
      </div>

      <div className="panel settings-panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Change password</div>
          </div>
        </div>
        <div className="panel-body">
          <form onSubmit={savePassword}>
            {pwState.err && <div className="auth-alert error">{pwState.err}</div>}
            {pwState.msg && <div className="auth-alert notice">{pwState.msg}</div>}
            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Re-enter password"
              />
            </label>
            <button className="btn primary" type="submit" disabled={pwState.busy}>
              {pwState.busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      <DataFreshness />
    </div>
  )
}

// "How current is this dashboard?" — per-source refresh status.
//
// Two dates, deliberately separate: LAST REFRESHED is when we last pulled the feed;
// DATA UP TO is the most recent date the data itself covers. They are not the same —
// a feed can refresh today and still only carry activity to last week — and showing
// one alone would misrepresent how current the numbers are.
function DataFreshness() {
  const q = useDataFreshness()
  const fmt = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return String(ts)
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }
  const ago = (ts) => {
    if (!ts) return null
    const h = (Date.now() - new Date(ts).getTime()) / 36e5
    if (!Number.isFinite(h)) return null
    if (h < 1) return 'just now'
    if (h < 24) return `${Math.round(h)}h ago`
    return `${Math.round(h / 24)}d ago`
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Data refresh</div>
          <div className="panel-sub">
            When each source last landed. <strong>Last refreshed</strong> is when we pulled the feed;{' '}
            <strong>data up to</strong> is the most recent date that feed's data actually covers.
          </div>
        </div>
      </div>
      <div className="panel-body no-pad">
        {q.isLoading && <p style={{ padding: 14, opacity: 0.7 }}>Checking…</p>}
        {q.isError && <p style={{ padding: 14, opacity: 0.7 }}>Could not read refresh status.</p>}
        {q.data?.hasData && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Source</th>
                <th>Last refreshed</th>
                <th>Data up to</th>
                <th className="r">Rows</th>
              </tr>
            </thead>
            <tbody>
              {q.data.sources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td className="mono mono-d">
                    {fmt(s.lastRefreshed)}
                    {ago(s.lastRefreshed) && <span style={{ opacity: 0.6 }}> · {ago(s.lastRefreshed)}</span>}
                  </td>
                  <td className="mono mono-d">{s.latestActivity || '—'}</td>
                  <td className="r mono">{num(s.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
