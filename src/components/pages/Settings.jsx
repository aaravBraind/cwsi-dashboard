import { useState } from 'react'
import { useAuth, displayName } from '../../auth/AuthContext'

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
    </div>
  )
}
