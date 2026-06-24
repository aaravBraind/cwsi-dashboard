// ---- Board Pack AI client (T-7) ------------------------------------------
// The seam between the app and the AI layer. The Anthropic call CANNOT run in the
// browser (the API key is a secret), so it runs in n8n: the app POSTs the
// app-computed figure set to an n8n webhook, n8n builds the Claude prompt + calls
// the Anthropic API (key held as an n8n credential) and returns the structured
// narrative + recommendations. See workflows/board_pack_generate.json.
//
// The app then runs the trace-to-data validator over the response — the
// zero-invention guarantee is enforced HERE, in the app, regardless of what the
// AI endpoint returns. A pack that references an untraceable number is blocked.

import { validateBoardPack } from './traceValidator'
import { supabase } from '../lib/supabaseClient'

const WEBHOOK_URL = import.meta.env.VITE_BOARDPACK_WEBHOOK_URL

// n8n "Respond to Webhook" can return the object directly, wrapped in a single-
// element array, or under a `json` key — unwrap defensively.
function unwrap(data) {
  if (Array.isArray(data)) data = data[0]
  if (data && data.json && !data.narrative) data = data.json
  return data || {}
}

export async function generateBoardNarrative(figureSet) {
  if (!WEBHOOK_URL) {
    throw new Error(
      'Board-pack AI endpoint not configured. Set VITE_BOARDPACK_WEBHOOK_URL in .env ' +
        '(the n8n webhook that calls Claude — see workflows/board_pack_generate.json).',
    )
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figureSet }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Board-pack generation failed (${res.status}). ${detail.slice(0, 200)}`)
  }

  const payload = unwrap(await res.json())
  const response = {
    narrative: payload.narrative || {},
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
    model: payload.model || null,
  }

  // Enforce the trace-to-data guarantee at the display boundary.
  const validation = validateBoardPack(response, figureSet.traceTable)
  return { ...response, validation, generatedAt: new Date().toISOString() }
}

// Persist a generated pack to the `board_pack` table so it can be re-exported and
// kept as history (the on-screen narrative is otherwise ephemeral). Two rules:
//  • Only TRACE-PASSED packs are stored — a pack that failed the number-check is not
//    a publishable artifact, so it's never archived.
//  • The figure set is stored FROZEN alongside the narrative, so a saved pack stays
//    internally consistent (narrative ↔ figures) even after the warehouse moves.
// Returns the new row id, or null if nothing was stored (blocked pack).
export async function saveBoardPack({ region, quarter, figureSet, generated }) {
  if (!generated?.validation?.ok) return null // never persist a blocked pack
  const row = {
    region: region || 'all',
    quarter: quarter || 'ytd',
    model: generated.model || null,
    figure_set: figureSet,
    narrative: generated.narrative || {},
    recommendations: generated.recommendations || [],
    validation: generated.validation || null,
  }
  const { data, error } = await supabase.from('board_pack').insert(row).select('id').single()
  if (error) throw error
  return data
}

// Re-hydrate the latest TRACE-PASSED pack saved for a scope. The on-screen narrative
// otherwise lives only in the generate-mutation's in-memory state, so a refresh loses
// it; this read path lets the Board page show the last published pack on load. Shaped
// to match generateBoardNarrative()'s return so NarrativePanel can render it directly.
// Returns null if no pack has been saved for this scope yet.
export async function getLatestBoardPack({ region, quarter } = {}) {
  const { data, error } = await supabase
    .from('board_pack')
    .select('model,figure_set,narrative,recommendations,validation,generated_at')
    .eq('region', region || 'all')
    .eq('quarter', quarter || 'ytd')
    .order('generated_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data && data[0]
  if (!row) return null
  return {
    narrative: row.narrative || {},
    recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
    model: row.model || null,
    validation: row.validation || null,
    figureSet: row.figure_set || null,
    generatedAt: row.generated_at,
    saved: true, // flag: came from the archive, not a fresh generate this session
  }
}
