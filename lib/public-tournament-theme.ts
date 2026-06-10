// Single source of truth for the public tournament light-mode CSS variable block.
//
// Both the live public tournament layout (app/[orgSlug]/[tournamentSlug]/layout.tsx)
// and the admin preview layout (via lib/tournament-preview.ts) inject this exact
// block into :root when colorMode === 'light'. Keeping it here prevents the two
// from drifting — previously the preview carried a stale copy whose muted-text
// tokens were ~0.12 too light, so light-mode previews looked washed out vs prod.

/**
 * Light-mode token overrides: flip the dark-first :root scale so the body
 * background and every descendant render on bright surfaces.
 */
export function buildPublicLightModeCssVars(): string {
  return [
    '--bg:              #F5F7FC',
    '--bg-2:            #EEF1F8',
    '--bg-3:            #E5E9F2',
    '--surface:         #FFFFFF',
    '--surface-2:       #F0F3FA',
    '--white:           #0F1123',
    '--white-90:        rgba(15,17,35,0.9)',
    '--white-80:        rgba(15,17,35,0.8)',
    '--white-70:        rgba(15,17,35,0.7)',
    '--white-60:        rgba(15,17,35,0.6)',
    // Muted-text tokens run darker in light mode than a literal alpha port of the
    // dark scale: on bright (white) surfaces 40–50% black washes out, so secondary
    // text (round labels, dates, metadata) is lifted ~0.12 for a readable contrast
    // floor without losing the "muted" read. Structural faints (-35/-30/-10) unchanged.
    '--white-50:        rgba(15,17,35,0.62)',
    '--white-45:        rgba(15,17,35,0.58)',
    '--white-40:        rgba(15,17,35,0.52)',
    '--white-35:        rgba(15,17,35,0.35)',
    '--white-30:        rgba(15,17,35,0.3)',
    '--white-10:        rgba(15,17,35,0.07)',
    '--border-2:        rgba(15,17,35,0.1)',
    '--shadow-sm:       0 2px 8px rgba(0,0,0,0.1)',
    '--shadow:          0 4px 24px rgba(0,0,0,0.12)',
    '--shadow-lg:       0 8px 48px rgba(0,0,0,0.16)',
    '--fl-text:         #0F1123',
    '--data-gray:       #4B5563',
    '--hud-surface:     #FFFFFF',
    '--nav-bg-scrolled: rgba(245,247,252,0.95)',
    '--nav-mobile-bg:   rgba(245,247,252,0.99)',
    // Accent text uses the (dark) org primary on light surfaces — the pale
    // dark-mode tint would be unreadable on white.
    '--primary-light:   var(--primary)',
  ].join('; ');
}
