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
