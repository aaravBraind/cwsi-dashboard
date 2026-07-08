import { useState } from 'react'
import { I } from './icons'
import { useUpdateCampaignOverride } from '../hooks/useDashboardData'

// Inline-editable friendly label for a campaign (B4/CC-4). Shows the current
// label with a pencil affordance; click → input; Enter/blur saves to the
// campaign_overrides table (persists across re-ingests), Esc cancels. When no
// override is set it shows the Salesforce value; once overridden, the SF original
// is kept in the tooltip so the mapping stays traceable.
//
//   <EditableName campaignKey={c.key} value={ov?.display_name} original={c.name} />
//   <EditableName campaignKey={c.key} field="display_region" value={ov?.display_region} original={c.region} />
export default function EditableName({ campaignKey, field = 'display_name', value, original, placeholder = 'Set label' }) {
  const upd = useUpdateCampaignOverride()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // No key to attribute the override to → just show the raw value, not editable.
  if (!campaignKey) return <span>{original || '—'}</span>

  const overridden = value != null && value !== ''
  const shown = overridden ? value : original || placeholder

  const begin = () => {
    setDraft(overridden ? value : '')
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next === (overridden ? value : '')) return // unchanged
    upd.mutate({ campaignKey, field, value: next })
  }

  if (editing) {
    return (
      <span className="edit-name editing">
        <input
          autoFocus
          value={draft}
          placeholder={original || placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      </span>
    )
  }

  // Name is plain, selectable text — only the pencil button triggers editing, so
  // reading/selecting the text never flips it into an input.
  return (
    <span className={`edit-name${overridden ? ' overridden' : ''}${upd.isPending ? ' saving' : ''}`}>
      <span className="edit-name-text" title={overridden ? `Salesforce: “${original}”` : undefined}>{shown}</span>
      <button
        type="button"
        className="edit-name-pen"
        onClick={begin}
        aria-label={`Rename${original ? ` “${original}”` : ''}`}
        title={overridden ? `Renamed — Salesforce: “${original}”. Click to edit.` : 'Rename (saves automatically)'}
      >
        <svg className="icon" viewBox="0 0 24 24">{I.pencil}</svg>
      </button>
    </span>
  )
}
