export const FONT_OPTIONS: Record<string, { label: string; sampleStyle: string }> = {
  system:     { label: 'System',    sampleStyle: 'system-ui, sans-serif' },
  inter:      { label: 'Inter',     sampleStyle: 'var(--font-inter, Inter, sans-serif)' },
  barlow:     { label: 'Barlow',    sampleStyle: 'var(--font-barlow, "Barlow Condensed", sans-serif)' },
  'dm-serif': { label: 'DM Serif',  sampleStyle: 'var(--font-dm-serif, "DM Serif Display", serif)' },
};

export const CARD_STYLE_OPTIONS: Record<string, { label: string }> = {
  default:  { label: 'Default'  },
  glass:    { label: 'Glass'    },
  outlined: { label: 'Outlined' },
  flat:     { label: 'Flat'     },
};

export interface ThemeVars {
  primary:      string;
  primaryLight: string;
  primaryRgb:   string;
  accent:       string;
}

interface Preset extends ThemeVars {
  name: string;
}

export const PRESETS: Record<string, Preset> = {
  platform: { name: 'Platform',      primary: '#8B2FC9', primaryLight: '#A855F7', primaryRgb: '139, 47, 201',  accent: '#A855F7' },
  ocean:    { name: 'Ocean Blue',    primary: '#0284C7', primaryLight: '#38BDF8', primaryRgb: '2, 132, 199',   accent: '#38BDF8' },
  forest:   { name: 'Forest Green',  primary: '#15803D', primaryLight: '#4ADE80', primaryRgb: '21, 128, 61',   accent: '#4ADE80' },
  sunset:   { name: 'Sunset Orange', primary: '#C2410C', primaryLight: '#FB923C', primaryRgb: '194, 65, 12',   accent: '#FB923C' },
  crimson:  { name: 'Crimson',       primary: '#BE123C', primaryLight: '#FB7185', primaryRgb: '190, 18, 60',   accent: '#FB7185' },
  gold:     { name: 'Gold',          primary: '#B45309', primaryLight: '#FCD34D', primaryRgb: '180, 83, 9',    accent: '#FCD34D' },
  teal:     { name: 'Teal',          primary: '#0F766E', primaryLight: '#2DD4BF', primaryRgb: '15, 118, 110',  accent: '#2DD4BF' },
  midnight: { name: 'Midnight Blue', primary: '#1D4ED8', primaryLight: '#60A5FA', primaryRgb: '29, 78, 216',   accent: '#60A5FA' },
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex: string): number {
  const L1 = 1; // white
  const L2 = relativeLuminance(hex);
  return (L1 + 0.05) / (L2 + 0.05);
}

export interface ResolvedTheme extends ThemeVars {
  isLowContrast: boolean;
}

export function resolveTheme(
  preset:        string | null | undefined,
  customPrimary: string | null | undefined,
  customAccent:  string | null | undefined,
): ResolvedTheme {
  const base = PRESETS[preset ?? 'platform'] ?? PRESETS.platform;

  let primary      = base.primary;
  let primaryLight = base.primaryLight;
  let primaryRgb   = base.primaryRgb;
  let accent       = base.accent;

  if (customPrimary && HEX_RE.test(customPrimary)) {
    primary    = customPrimary;
    primaryRgb = hexToRgb(customPrimary);
    // derive a lighter tint at 70% lightness if no custom accent given
    primaryLight = customPrimary;
  }

  if (customAccent && HEX_RE.test(customAccent)) {
    primaryLight = customAccent;
    accent       = customAccent;
  }

  const isLowContrast = contrastRatio(primary) < 3;

  return { primary, primaryLight, primaryRgb, accent, isLowContrast };
}
