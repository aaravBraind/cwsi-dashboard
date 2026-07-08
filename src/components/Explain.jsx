import { useState, useRef, useEffect, useId, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { I, Icon } from './icons'
import { methodologyOf } from '../data/methodology'

// ─────────────────────────────────────────────────────────────────────────────
// <Explain> — the "how did we get this number?" eye-button.
//
// Drop next to any figure. Clicking the eye opens a small callout-styled popover
// that explains, for the client, what the number counts, where it comes from,
// how it's calculated and any caveat. Content comes from the methodology
// registry (src/data/methodology.js) by id, or you can pass title/children
// inline for one-off notes.
//
//   <Explain id="leads" />                         // from the registry
//   <Explain title="Custom" >free text…</Explain>  // inline
//
// The popover is PORTALED to <body> with fixed positioning, so it is never
// clipped by a panel's `overflow:hidden` or a table's scroll container. Closes on
// outside-click, Escape, or scroll/resize. Keyboard + screen-reader accessible.
// ─────────────────────────────────────────────────────────────────────────────
export default function Explain({ id, title, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const popId = useId()

  const entry = id ? methodologyOf(id) : null
  const heading = title || entry?.label || 'How this is calculated'

  // Position the fixed popover: prefer below the button, flip above when there's
  // not enough room, and clamp with a scroll when it fits neither. Needs the real
  // popover height, so it runs in a layout effect once the popover has rendered.
  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect()
    const pop = popRef.current
    if (!b || !pop) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    const W = Math.min(320, vw - 16)
    const ph = pop.offsetHeight
    const below = vh - b.bottom - gap
    const above = b.top - gap

    let top
    let maxHeight
    if (ph <= below) {
      top = b.bottom + gap
      maxHeight = below
    } else if (ph <= above) {
      top = b.top - gap - ph
      maxHeight = above
    } else if (below >= above) {
      top = b.bottom + gap
      maxHeight = below
    } else {
      top = gap
      maxHeight = above
    }

    let left = align === 'left' ? b.left : b.right - W
    left = Math.max(8, Math.min(left, vw - W - 8))
    setPos({ top, left, width: W, maxHeight: Math.max(140, maxHeight) })
  }, [align])

  // Render the popover as soon as it opens (pos starts null → hidden), then measure
  // and position it in a layout effect before the browser paints, so there's no flash.
  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    // Scrolling *inside* the popover (its own overflow) must not dismiss it — only
    // an outside scroll should, and then we re-anchor to the button rather than
    // close, so a tall popover stays readable while the page moves.
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return
      place()
    }
    const onResize = () => place()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, place])

  // Nothing to show — render nothing rather than an empty popover.
  if (!id && !title && !children) return null
  if (id && !entry && !children) return null

  return (
    <span className={`explain ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={`explain-btn ${open ? 'is-open' : ''}`}
        aria-label={`How “${heading}” is calculated`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <Icon className="icon">{I.eyeOpen}</Icon>
      </button>

      {open &&
        createPortal(
          <div
            id={popId}
            ref={popRef}
            className="explain-pop"
            role="dialog"
            aria-label={heading}
            style={{
              position: 'fixed',
              top: pos ? pos.top : 0,
              left: pos ? pos.left : 0,
              width: pos ? pos.width : 320,
              maxHeight: pos ? pos.maxHeight : undefined,
              overflowY: 'auto',
              visibility: pos ? 'visible' : 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="explain-pop-head">
              <span className="explain-pop-title">{heading}</span>
              <button type="button" className="explain-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="explain-pop-body">
              {children ? (
                children
              ) : (
                <>
                  {entry.what && <p className="explain-what">{entry.what}</p>}
                  {entry.source && (
                    <p><span className="explain-k">Source</span> {entry.source}</p>
                  )}
                  {entry.calc && (
                    <p><span className="explain-k">How it's calculated</span> {entry.calc}</p>
                  )}
                  {entry.caveat && (
                    <p className="explain-caveat"><span className="explain-k">Good to know</span> {entry.caveat}</p>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
