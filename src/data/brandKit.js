// ---- CWSI brand kit — single source of truth -----------------------------
// Canonical brand tokens for BOTH the code exporters (jsPDF needs RGB tuples) and
// the Google Slides decks / CSS (hex). Mirrors styles.css :root and the sample
// deck (docs/Data-That-Moves-Your-Business-Forward.pdf). exporters.js will import
// `BRAND` (RGB) from here in place of its old inline const so the code exporters
// and the Slides decks can never drift apart. See docs/CWSI_BRAND_KIT.md.

// Hex — for Google Slides theme colours, CSS, and the brand-kit doc.
export const hex = {
  navy: '#0a2c52', // cover / table headers
  navyDeep: '#071f3b', // gradient end
  blue: '#1471e6', // accent
  blueHover: '#2680ee',
  blueSoft: '#87b8e8',
  bluePale: '#cfe1f7',
  ink: '#0f172a', // body text
  mute: '#78869c', // secondary text
  line: '#e2e8f0', // hairlines / table rules
  green: '#22c55e', // status: on-track
  amber: '#f59e0b', // status: watch
  red: '#ef4444', // status: behind
  white: '#ffffff',
}

// RGB tuples — for jsPDF (`doc.setFillColor(...rgb.navy)`). Kept in lockstep with hex.
export const rgb = {
  navy: [10, 44, 82],
  navyDeep: [7, 31, 59],
  blue: [20, 113, 230],
  ink: [15, 23, 42],
  mute: [120, 134, 156],
  line: [226, 232, 240],
  green: [34, 197, 94],
  amber: [245, 158, 11],
  red: [239, 68, 68],
  white: [255, 255, 255],
}

export const fonts = { sans: 'Manrope', mono: 'JetBrains Mono' }

export const brand = {
  wordmark: 'CWSI.',
  tagline: 'Marketing Intelligence',
  confidentiality:
    'Confidential — prepared for the CWSI board. Figures are trace-to-data verified from the warehouse.',
}

// Back-compat shape for exporters.js, whose inline const used BRAND.navy/blue/ink/
// mute/line as RGB tuples. Importing this makes that refactor a one-line swap.
export const BRAND = rgb
