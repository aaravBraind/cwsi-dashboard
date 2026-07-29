// ---- Browser print → PDF -----------------------------------------------------
// Renders a branded report HTML string (from boardPackHtml.js / reportHtml.js) to
// a PDF using the browser's OWN print engine, replacing the previous n8n →
// Gotenberg round-trip. Chrome's print engine IS Chromium, the same renderer
// Gotenberg drove, so it honours the print CSS those builders already carry
// (`@page { size: A4 }`, `break-inside: avoid`, `thead { display:table-header-group }`)
// and produces the same vector, selectable-text PDF — with no server, no webhook
// and no extra dependency.
//
// Mechanics: the HTML goes into an offscreen iframe sized to exactly A4 at 96dpi,
// so viewport-relative CSS resolves against the page box as it did under
// Gotenberg. We wait for webfonts and images before printing, otherwise the
// dialog can capture a half-laid-out document.
//
// The one thing the browser owns and we do not is the "Save as PDF" dialog: the
// user confirms it and can rename the file. Chrome pre-fills the filename from
// the printed document's <title>, which the builders set, so the default is
// already the right name. See BACKGROUND_GRAPHICS below for the other caveat.

// A4 at 96 CSS px/in — 210mm x 297mm.
const A4_W = 794
const A4_H = 1123

// Chrome's print dialog has a "Background graphics" checkbox that defaults to OFF,
// and `print-color-adjust: exact` does not override it. With it off, CSS
// background fills are dropped. The builders defend against the cases where that
// would destroy meaning rather than just flatten styling (white-on-navy text and
// status dots are backed by SVG images / rings, since images always print), but
// the report only looks fully branded with it on. Chrome remembers the setting
// per user, so this is a one-time toggle — surfaced in the export UI.
export const BACKGROUND_GRAPHICS_HINT =
  'In the print dialog, open “More settings” and tick “Background graphics” so the ' +
  'branded colours are included. Chrome remembers this for next time.'

// Resolve once the iframe document's webfonts have settled. The builders pull
// Manrope / JetBrains Mono from Google Fonts, so this is a real network wait —
// capped, because an offline or blocked fetch must not deadlock the export (the
// CSS has a local fallback stack for exactly that case).
function fontsReady(doc, timeoutMs = 4000) {
  if (!doc.fonts?.ready) return Promise.resolve()
  return Promise.race([
    doc.fonts.ready.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

// Resolve once every <img> has either decoded or failed. The embedded base64 logo
// and cover artwork decode near-instantly, but "near-instantly" is not "before
// the next tick", and an undecoded image prints blank.
function imagesReady(doc, timeoutMs = 4000) {
  const imgs = Array.from(doc.images || [])
  const pending = imgs.filter((img) => !img.complete)
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

// Resolve once the frame holds a fully parsed copy of OUR document.
//
// Deliberately a poll rather than the `load` event: for a srcdoc frame the event
// ordering is not dependable — inserting the frame can fire `load` for its initial
// empty document, and depending on when srcdoc is applied the srcdoc document may
// get no observable event of its own. Acting on the wrong pass prints a blank page,
// or calls print() on a window that has since been detached, which silently hangs.
// Polling for the end state (parsed + our content present) is immune to all of that.
function documentReady(iframe, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const tick = () => {
      const doc = iframe.contentDocument
      // `.cover` is present in every report (it comes from the shared pageShell), so
      // it doubles as the marker that this is our document and not the blank one.
      if (doc && doc.readyState === 'complete' && doc.querySelector('.cover')) return resolve(doc)
      if (performance.now() - started > timeoutMs) {
        return reject(new Error('Could not prepare the report for printing — the document did not finish loading.'))
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

// Print `html` through the browser, resolving once the dialog has been dismissed
// (whether the user saved or cancelled — the browser does not tell us which).
//
// `filename` is used as the printed document title, which is what Chrome pre-fills
// the save dialog with; it should NOT carry the .pdf extension (Chrome appends it).
export async function printHtmlToPdf(html, { filename } = {}) {
  const iframe = document.createElement('iframe')
  // Offscreen rather than display:none / zero-size: a hidden or collapsed frame lays
  // out at the wrong size (or not at all), and the print output follows the layout,
  // not the stylesheet's intent.
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = `position:fixed; left:-10000px; top:0; width:${A4_W}px; height:${A4_H}px; border:0; visibility:hidden;`

  // Firefox/Safari take the save-dialog filename from the TOP document's title,
  // Chrome from the printed frame's. Set both, restore ours afterwards.
  const outerTitle = document.title

  try {
    iframe.srcdoc = html
    document.body.appendChild(iframe)

    const doc = await documentReady(iframe)
    const win = iframe.contentWindow
    if (!win) throw new Error('Could not prepare the report for printing.')

    await Promise.all([fontsReady(doc), imagesReady(doc)])
    // Two frames for layout to flush after fonts swap in — printing mid-reflow
    // produces clipped or misplaced text.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    if (filename) document.title = filename

    // Wait for the dialog to close. `afterprint` is the signal in Chrome, where
    // print() returns immediately; in engines where print() blocks until the dialog
    // closes the event has already fired by then, so the timeout covers both. Either
    // way we only need it to know when the iframe is safe to remove.
    await new Promise((resolve) => {
      win.addEventListener('afterprint', resolve, { once: true })
      win.focus()
      win.print()
      setTimeout(resolve, 60000)
    })
  } finally {
    document.title = outerTitle
    iframe.remove()
  }
}
