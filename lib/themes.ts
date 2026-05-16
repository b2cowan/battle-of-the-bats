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
  platform: { name: 'FieldLogicHQ',   primary: '#1E3A8A', primaryLight: '#D9F99D', primaryRgb: '30, 58, 138',   accent: '#D9F99D' },
  bats:     { name: 'Battle Purple', primary: '#8B2FC9', primaryLight: '#C084FC', primaryRgb: '139, 47, 201',  accent: '#C084FC' },
  ocean:    { name: 'Ocean Blue',    primary: '#075985', primaryLight: '#38BDF8', primaryRgb: '7, 89, 133',    accent: '#38BDF8' },
  forest:   { name: 'Forest Green',  primary: '#166534', primaryLight: '#86EFAC', primaryRgb: '22, 101, 52',   accent: '#86EFAC' },
  sunset:   { name: 'Sunset Orange', primary: '#9A3412', primaryLight: '#FDBA74', primaryRgb: '154, 52, 18',   accent: '#FDBA74' },
  crimson:  { name: 'Crimson',       primary: '#9F1239', primaryLight: '#FB7185', primaryRgb: '159, 18, 57',   accent: '#FB7185' },
  gold:     { name: 'Championship Gold', primary: '#92400E', primaryLight: '#FACC15', primaryRgb: '146, 64, 14', accent: '#FACC15' },
  teal:     { name: 'Teal',          primary: '#115E59', primaryLight: '#5EEAD4', primaryRgb: '17, 94, 89',    accent: '#5EEAD4' },
  midnight: { name: 'Midnight Blue', primary: '#1E40AF', primaryLight: '#93C5FD', primaryRgb: '30, 64, 175',   accent: '#93C5FD' },
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
