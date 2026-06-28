// Allowed values + labels for the Wave B player-profile fields (handedness, jersey size).
// Shared by the profile UI and the roster API so the vocabulary can't drift.

export const BATS_OPTIONS = ['L', 'R', 'S'] as const;          // S = switch hitter
export const THROWS_OPTIONS = ['L', 'R'] as const;
export const JERSEY_SIZE_OPTIONS = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL'] as const;

export const BATS_LABELS: Record<string, string> = { L: 'Left', R: 'Right', S: 'Switch' };
export const THROWS_LABELS: Record<string, string> = { L: 'Left', R: 'Right' };
export const JERSEY_SIZE_LABELS: Record<string, string> = {
  YS: 'Youth S', YM: 'Youth M', YL: 'Youth L',
  AS: 'Adult S', AM: 'Adult M', AL: 'Adult L', AXL: 'Adult XL',
};

/** Coerce arbitrary input to an allowed option (uppercased) or null. */
export function normalizeOption(value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  return allowed.includes(v) ? v : null;
}
