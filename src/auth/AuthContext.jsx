import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// Session state for the whole app. `loading` is true only until the initial
// session is resolved (from storage); after that the gate in App decides
// between the Login page and the dashboard. We subscribe to auth state changes
// so sign-in / sign-out / token-refresh propagate without a reload.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    [],
  )
  const signOut = useCallback(() => supabase.auth.signOut(), [])
  const updatePassword = useCallback((password) => supabase.auth.updateUser({ password }), [])
  const updateDisplayName = useCallback(
    (full_name) => supabase.auth.updateUser({ data: { full_name } }),
    [],
  )

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signOut,
    updatePassword,
    updateDisplayName,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// Display label for the signed-in user: their set display name, else the email
// local-part, else "User". The avatar initial derives from the same source.
export function displayName(user) {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
}
