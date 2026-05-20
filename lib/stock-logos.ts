import type { OrgPlan } from './types';
import { PLAN_RANK } from './plan-features';

export interface StockLogo {
  id: string;
  label: string;
  category: string;
  file: string;
  minPlan: OrgPlan;
}

export const STOCK_LOGOS: StockLogo[] = [
  // Tournament (free tier — available to all orgs)
  { id: 'baseball-bat',    label: 'Baseball Bat',  category: 'Baseball',    file: '/stock-logos/baseball-bat.svg',    minPlan: 'tournament' },
  { id: 'softball-diamond',label: 'Field Diamond', category: 'Softball',    file: '/stock-logos/softball-diamond.svg',minPlan: 'tournament' },
  { id: 'trophy-cup',      label: 'Trophy',        category: 'Awards',      file: '/stock-logos/trophy-cup.svg',      minPlan: 'tournament' },
  { id: 'shield-star',     label: 'Shield Star',   category: 'Crests',      file: '/stock-logos/shield-star.svg',     minPlan: 'tournament' },
  { id: 'crossed-bats',    label: 'Crossed Bats',  category: 'Baseball',    file: '/stock-logos/crossed-bats.svg',    minPlan: 'tournament' },
  { id: 'home-plate',      label: 'Home Plate',    category: 'Baseball',    file: '/stock-logos/home-plate.svg',      minPlan: 'tournament' },
  // Tournament Plus
  { id: 'baseball-cap',    label: 'Ball Cap',      category: 'Baseball',    file: '/stock-logos/baseball-cap.svg',    minPlan: 'tournament_plus' },
  { id: 'crest-banner',    label: 'Crest Banner',  category: 'Crests',      file: '/stock-logos/crest-banner.svg',    minPlan: 'tournament_plus' },
  { id: 'laurel-wreath',   label: 'Laurel Wreath', category: 'Awards',      file: '/stock-logos/laurel-wreath.svg',   minPlan: 'tournament_plus' },
  { id: 'lightning-bolt',  label: 'Lightning Bolt',category: 'Multi-sport', file: '/stock-logos/lightning-bolt.svg',  minPlan: 'tournament_plus' },
  { id: 'baseball-glove',  label: 'Glove',         category: 'Baseball',    file: '/stock-logos/baseball-glove.svg',  minPlan: 'tournament_plus' },
  { id: 'star-circle',     label: 'Star Circle',   category: 'Awards',      file: '/stock-logos/star-circle.svg',     minPlan: 'tournament_plus' },
  // Club
  { id: 'crown',           label: 'Crown',         category: 'Crests',      file: '/stock-logos/crown.svg',           minPlan: 'club' },
  { id: 'medal-ribbon',    label: 'Medal',         category: 'Awards',      file: '/stock-logos/medal-ribbon.svg',    minPlan: 'club' },
  { id: 'flame',           label: 'Flame',         category: 'Multi-sport', file: '/stock-logos/flame.svg',           minPlan: 'club' },
  { id: 'compass-rose',    label: 'Compass',       category: 'Multi-sport', file: '/stock-logos/compass-rose.svg',    minPlan: 'club' },
  { id: 'pennant-flag',    label: 'Pennant',       category: 'Multi-sport', file: '/stock-logos/pennant-flag.svg',    minPlan: 'club' },
  { id: 'diamond-field',   label: 'Diamond Field', category: 'Baseball',    file: '/stock-logos/diamond-field.svg',   minPlan: 'club' },
];

export const PLAN_ORDER = PLAN_RANK;

export function isStockLogoUnlocked(logo: StockLogo, orgPlan: OrgPlan): boolean {
  return PLAN_RANK[orgPlan] >= PLAN_RANK[logo.minPlan];
}

export const STOCK_LOGO_CATEGORIES = [
  'Baseball',
  'Softball',
  'Awards',
  'Crests',
  'Multi-sport',
] as const;
