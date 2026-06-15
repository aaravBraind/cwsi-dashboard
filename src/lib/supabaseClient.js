import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev rather than silently querying nothing.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.'
  )
}

// Single read-only client. RLS is assumed ON with the anon role granted
// SELECT on the canonical views only. This app never writes.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
})
