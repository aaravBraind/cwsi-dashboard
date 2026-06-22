import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev rather than silently querying nothing.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.'
  )
}

// Single client. The dashboard is gated behind Supabase Auth: every data read
// runs as the signed-in `authenticated` user (RLS grants SELECT on the canonical
// views/tables to `authenticated` only — `anon` has no read access). The session
// is persisted and auto-refreshed so a reload keeps the user signed in. Writes are
// limited to auth self-service (password / name) and the editable KPI target register
// (`kpi_targets` — authenticated INSERT/UPDATE only, anon revoked); all else is read-only.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
