import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  corePlugins: {
    // Disable Tailwind's base reset — the project has its own CSS reset in globals.css
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // FieldLogic Platform Palette
        'pitch-black':      '#0A0A0A',
        'blueprint-blue':   '#1E3A8A',
        'blueprint-light':  '#3B5FC4',
        'blueprint-dim':    'rgba(30,58,138,0.15)',
        'logic-lime':       '#D9F99D',
        'logic-lime-dim':   'rgba(217,249,157,0.15)',
        'structural-slate': '#0F172A',
        'data-gray':        '#94A3B8',
        'hud-surface':      '#111827',

        // Semantic FL aliases (components only — do not use on org pages)
        'fl-bg':      '#0A0A0A',
        'fl-surface': '#111827',
        'fl-border':  '#1E3A8A',
        'fl-accent':  '#D9F99D',
        'fl-muted':   '#94A3B8',
        'fl-text':    '#F1F5F9',
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono:    ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
        display: ['var(--font-display)', 'Barlow Condensed', 'sans-serif'],
      },
      fontSize: {
        'score-lg': ['7rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'score-md': ['4rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'stat':     ['2rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'hud-xs':   ['0.625rem', { lineHeight: '1', letterSpacing: '0.1em' }],
      },
      // NOTE: borderRadius DEFAULT change to 2px only affects Tailwind `rounded` class.
      // org-page CSS modules use var(--radius) directly — unaffected.
      borderRadius: {
        'none': '0px',
        'sm':   '2px',
        DEFAULT: '2px',
        'md':   '4px',
        'lg':   '6px',
        'xl':   '8px',
        'full': '9999px',
      },
      boxShadow: {
        'hud':       '0 0 0 1px #1E3A8A, 0 0 12px rgba(30,58,138,0.2)',
        'hud-lime':  '0 0 0 1px #D9F99D, 0 0 16px rgba(217,249,157,0.25)',
        'hud-inner': 'inset 0 0 20px rgba(30,58,138,0.1)',
      },
      backgroundImage: {
        'grid-faint': [
          'linear-gradient(to right, rgba(30,58,138,0.07) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(30,58,138,0.07) 1px, transparent 1px)',
        ].join(', '),
        'grid-dense': [
          'linear-gradient(to right, rgba(30,58,138,0.12) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(30,58,138,0.12) 1px, transparent 1px)',
        ].join(', '),
      },
      backgroundSize: {
        'grid':    '40px 40px',
        'grid-sm': '20px 20px',
      },
      animation: {
        'pulse-lime':   'pulse-lime 2s ease-in-out infinite',
        'scan-line':    'scan-line 3s linear infinite',
        'data-flow':    'data-flow 1.5s ease-in-out',
        'hud-boot':     'hud-boot 0.4s ease-out',
        'bracket-wire': 'bracket-wire 0.8s ease-in-out',
      },
      keyframes: {
        'pulse-lime': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(217,249,157,0.4)' },
          '50%':      { opacity: '0.6', boxShadow: '0 0 20px rgba(217,249,157,0.8)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'data-flow': {
          '0%':   { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'hud-boot': {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bracket-wire': {
          '0%':   { strokeDashoffset: '200', opacity: '0.3' },
          '100%': { strokeDashoffset: '0',   opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
