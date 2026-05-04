import type { OrgPlan } from './types';

export interface StockLogo {
  id: string;
  label: string;
  category: string;
  file: string;
  minPlan: OrgPlan;
}

export const STOCK_LOGOS: StockLogo[] = [
  // Starter (free tier — available to all orgs)
  { id: 'baseball-bat',    label: 'Baseball Bat',  category: 'Baseball',    file: '/stock-logos/baseball-bat.svg',    minPlan: 'starter' },
  { id: 'softball-diamond',label: 'Field Diamond', category: 'Softball',    file: '/stock-logos/softball-diamond.svg',minPlan: 'starter' },
  { id: 'trophy-cup',      label: 'Trophy',        category: 'Awards',      file: '/stock-logos/trophy-cup.svg',      minPlan: 'starter' },
  { id: 'shield-star',     label: 'Shield Star',   category: 'Crests',      file: '/stock-logos/shield-star.svg',     minPlan: 'starter' },
  { id: 'crossed-bats',    label: 'Crossed Bats',  category: 'Baseball',    file: '/stock-logos/crossed-bats.svg',    minPlan: 'starter' },
  { id: 'home-plate',      label: 'Home Plate',    category: 'Baseball',    file: '/stock-logos/home-plate.svg',      minPlan: 'starter' },
  // Pro
  { id: 'baseball-cap',    label: 'Ball Cap',      category: 'Baseball',    file: '/stock-logos/baseball-cap.svg',    minPlan: 'pro' },
  { id: 'crest-banner',    label: 'Crest Banner',  category: 'Crests',      file: '/stock-logos/crest-banner.svg',    minPlan: 'pro' },
  { id: 'laurel-wreath',   label: 'Laurel Wreath', category: 'Awards',      file: '/stock-logos/laurel-wreath.svg',   minPlan: 'pro' },
  { id: 'lightning-bolt',  label: 'Lightning Bolt',category: 'Multi-sport', file: '/stock-logos/lightning-bolt.svg',  minPlan: 'pro' },
  { id: 'baseball-glove',  label: 'Glove',         category: 'Baseball',    file: '/stock-logos/baseball-glove.svg',  minPlan: 'pro' },
  { id: 'star-circle',     label: 'Star Circle',   category: 'Awards',      file: '/stock-logos/star-circle.svg',     minPlan: 'pro' },
  // Elite
  { id: 'crown',           label: 'Crown',         category: 'Crests',      file: '/stock-logos/crown.svg',           minPlan: 'elite' },
  { id: 'medal-ribbon',    label: 'Medal',         category: 'Awards',      file: '/stock-logos/medal-ribbon.svg',    minPlan: 'elite' },
  { id: 'flame',           label: 'Flame',         category: 'Multi-sport', file: '/stock-logos/flame.svg',           minPlan: 'elite' },
  { id: 'compass-rose',    label: 'Compass',       category: 'Multi-sport', file: '/stock-logos/compass-rose.svg',    minPlan: 'elite' },
  { id: 'pennant-flag',    label: 'Pennant',       category: 'Multi-sport', file: '/stock-logos/pennant-flag.svg',    minPlan: 'elite' },
  { id: 'diamond-field',   label: 'Diamond Field', category: 'Baseball',    file: '/stock-logos/diamond-field.svg',   minPlan: 'elite' },
];

export const PLAN_ORDER: Record<OrgPlan, number> = {
  starter: 0,
  pro: 1,
  elite: 2,
};

export function isStockLogoUnlocked(logo: StockLogo, orgPlan: OrgPlan): boolean {
  return PLAN_ORDER[orgPlan] >= PLAN_ORDER[logo.minPlan];
}

export const STOCK_LOGO_CATEGORIES = [
  'Baseball',
  'Softball',
  'Awards',
  'Crests',
  'Multi-sport',
] as const;
