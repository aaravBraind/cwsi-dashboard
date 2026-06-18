import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabaseClient'

// Full-screen sign-in gate, shown by App whenever there is no session. On
// success the AuthContext subscription flips the app to the dashboard — this
// component does not navigate itself.
export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    // GoTrue returns the same message for wrong password / unknown user, which
    // is what we want (no account enumeration).
    if (error) setError(error.message || 'Invalid email or password.')
  }

  async function onForgot() {
    setError('')
    if (!email.trim()) {
      setError('Enter your email above first, then choose “Forgot password”.')
      return
    }
    // Best-effort: only works once SMTP is configured for the project. We show a
    // neutral message either way so we never reveal whether an account exists.
    await supabase.auth.resetPasswordForEmail(email.trim())
    setNotice('If that email has an account, a reset link is on its way.')
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          CWSI<span>.</span>
        </div>
        <h1 className="auth-title">Marketing Intelligence</h1>
        <p className="auth-sub">Sign in to access the dashboard.</p>

        {error && <div className="auth-alert error">{error}</div>}
        {notice && <div className="auth-alert notice">{notice}</div>}

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <button className="btn primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <button type="button" className="auth-link" onClick={onForgot} disabled={busy}>
          Forgot password?
        </button>
      </form>
    </div>
  )
}
