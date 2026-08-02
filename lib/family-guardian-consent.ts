/**
 * lib/family-guardian-consent.ts — the guardian consent wording, in ONE place both sides read.
 *
 * ⚠ NOT `server-only`, deliberately. The consent screen is a client component and the consent
 * RECORD is written on the server, and those two must say the same thing — a stored consent
 * whose text has drifted from what the parent actually saw is worse than no record at all,
 * because it looks like evidence and isn't. Putting this behind `server-only` is what forced
 * the screen to hand-type its own copy the first time; this module exists so it cannot.
 *
 * ⚠ EVERY STRING HERE IS PLACEHOLDER WORDING pending the PIPEDA/CASL counsel review (question 2
 * of `COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md`). When counsel returns their text, this file is
 * the only thing that changes — the screen and the stored record both follow automatically.
 */

/** The age bands the consent flow branches on (discovery §3 privacy rule 1).
 *
 *  ASKED rather than derived from the date of birth we already hold: whether we MAY derive it
 *  is itself an open counsel question, and asking is the conservative answer that is trivially
 *  changed to derived if they say we may. Stored so a Quebec Law 25 (under-14) or future COPPA
 *  branch never needs a data-model rebuild. */
export type GuardianAgeBand = 'under_13' | 'under_14_qc' | 'teen_self_consent' | 'adult';

/** ONE list — the server validates against these values and the screen renders these labels,
 *  so a fifth band cannot be added to one and forgotten in the other. */
export const GUARDIAN_AGE_BAND_OPTIONS: { value: GuardianAgeBand; label: string }[] = [
  { value: 'under_13', label: 'Under 13' },
  { value: 'under_14_qc', label: 'Under 14, and we’re in Quebec' },
  { value: 'teen_self_consent', label: '13 or older (14+ in Quebec)' },
  { value: 'adult', label: '18 or older' },
];

export const GUARDIAN_AGE_BANDS: GuardianAgeBand[] = GUARDIAN_AGE_BAND_OPTIONS.map(o => o.value);

/**
 * The two REQUIRED consents, as the parent reads them.
 *
 * `dataCollection` takes the organization's name because a family consents to a named club,
 * not to "this organization" in the abstract — so it is a function rather than a string, which
 * also stops a caller from interpolating a different phrasing around it.
 */
export const GUARDIAN_CONSENT_LABELS = {
  dataCollection: (orgName: string) =>
    `I agree to ${orgName} collecting and using this player’s information to manage the team and keep coaching records.`,
  guardian: 'I’m this player’s parent or legal guardian.',
} as const;

/** Shown above the checkboxes. Visible on screen, not just a code comment: anyone testing this
 *  before counsel returns must be able to SEE that the wording is a draft. */
export const GUARDIAN_CONSENT_DRAFT_NOTICE =
  'Draft wording — being confirmed with our privacy advisor before this opens.';

/**
 * The exact text stored with each consent record as evidence.
 *
 * Built FROM the same labels the screen renders, so the two cannot diverge — that is the whole
 * point of this module. The org name is baked in at write time so the record says which
 * organization the family actually agreed to.
 */
export function guardianConsentText(orgName: string): string {
  return [
    'PLACEHOLDER (pending counsel review)',
    GUARDIAN_CONSENT_LABELS.dataCollection(orgName),
    GUARDIAN_CONSENT_LABELS.guardian,
  ].join(' — ');
}
