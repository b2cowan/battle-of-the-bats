// Canadian provinces & territories — the canonical list used by the public
// tournament discovery directory's location filter and the organizer's opt-in
// province picker (Event Settings → Tournament Overview). Stored on
// tournaments.directory_province as the two-letter code (migration 158); the
// allowed-value set is enforced here in app code, not via a DB CHECK constraint.

export interface Province {
  /** Canada Post two-letter code, e.g. 'ON'. Stored value. */
  code: string;
  /** Display name, e.g. 'Ontario'. */
  name: string;
}

export const CANADIAN_PROVINCES: readonly Province[] = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

const PROVINCE_BY_CODE: Record<string, string> = Object.fromEntries(
  CANADIAN_PROVINCES.map((p) => [p.code, p.name]),
);

/** True when `value` is a recognized province/territory code. */
export function isProvinceCode(value: unknown): value is string {
  return typeof value === 'string' && value in PROVINCE_BY_CODE;
}

/** Display name for a code, or null if unset/unknown. */
export function provinceName(code: string | null | undefined): string | null {
  if (!code) return null;
  return PROVINCE_BY_CODE[code] ?? null;
}
