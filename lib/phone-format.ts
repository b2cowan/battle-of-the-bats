/**
 * A phone number as the product shows it while someone types: "(416) 904-0390".
 *
 * ⚠ ONE FORMATTER, for every phone box (`PhoneInput`). Only a North American number is reshaped: a
 * leading 1 (no area code starts with 1) is the country code and is dropped, so "14169040390" and
 * "+1 416 904 0390" both become "(416) 904-0390". Anything else — letters ("416 904 0390 x22"), a
 * "+44" number, more than ten digits — is left exactly as typed, because guessing at it would
 * destroy what the person meant.
 *
 * Stored as shown. Every reader already strips to digits (`telHref`, the families duplicate match,
 * the Families Book search), so the punctuation costs them nothing.
 */
export function formatPhone(raw: string): string {
  if (/[^\d\s().+-]/.test(raw)) return raw;
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && !digits.startsWith('1')) return raw; // a "+44" number: not ours to reshape
  if (digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length > 10) return raw;

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`; // no ")" yet, so Backspace never fights the formatter
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Where the caret belongs in `formatted` once `digitsBefore` digits sit to its left. */
export function caretAfterDigits(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) seen++;
    if (seen === digitsBefore) return i + 1;
  }
  return formatted.length;
}
