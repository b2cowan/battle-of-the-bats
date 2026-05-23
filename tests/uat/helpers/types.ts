/**
 * Shared types for the FieldLogicHQ UAT agent.
 */

/** A single UAT finding captured from a Playwright test failure or assertion. */
export interface UATFinding {
  id: string;           // e.g. "F-001"
  suite: string;        // scenario suite name (auth | plan-gating | tournament-admin | ...)
  title: string;        // short title of the failing test
  severity: 'critical' | 'high' | 'medium' | 'low';
  route: string;        // the URL path where the issue was found
  role: UATRole;        // which role encountered the issue
  description: string;  // what went wrong
  steps: string[];      // steps to reproduce
  expected: string;     // what should have happened
  actual: string;       // what actually happened
  screenshot?: string;  // relative path to screenshot artifact
  timestamp: string;    // ISO timestamp
}

/** A proposed code fix for a finding. */
export interface UATProposal {
  findingId: string;       // links back to UATFinding.id
  title: string;           // short description of the fix
  filePath: string;        // relative path from repo root
  oldCode: string;         // exact code to replace
  newCode: string;         // replacement code
  rationale: string;       // why this fixes the issue
  confidence: 'high' | 'medium' | 'low';
}

/** The full UAT session report written to UAT_FINDINGS.md */
export interface UATReport {
  runAt: string;
  baseUrl: string;
  orgSlug: string;
  totalTests: number;
  passed: number;
  failed: number;
  findings: UATFinding[];
  proposals: UATProposal[];
}

/** Roles used in UAT test fixtures */
export type UATRole =
  | 'platform_admin'
  | 'org_owner'
  | 'org_admin'
  | 'coach'
  | 'scorekeeper'
  | 'unauthenticated';

/** Environment config loaded from process.env */
export interface UATEnv {
  baseUrl: string;
  orgSlug: string;
  platformAdmin: { email: string; password: string };
  orgOwner:      { email: string; password: string };
  orgAdmin:      { email: string; password: string };
  coach:         { email: string; password: string };
  scorekeeper?:     { email: string; password: string };
  plusScorekeeper?: { email: string; password: string };
}

/** Load and validate UAT env vars — throws a descriptive error if any are missing */
export function loadUATEnv(): UATEnv {
  const required = [
    'UAT_ORG_SLUG',
    'UAT_PLATFORM_ADMIN_EMAIL', 'UAT_PLATFORM_ADMIN_PASSWORD',
    'UAT_ORG_OWNER_EMAIL',      'UAT_ORG_OWNER_PASSWORD',
    'UAT_ORG_ADMIN_EMAIL',      'UAT_ORG_ADMIN_PASSWORD',
    'UAT_COACH_EMAIL',          'UAT_COACH_PASSWORD',
  ] as const;

  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `UAT_SETUP: Missing required env vars:\n  ${missing.join('\n  ')}\n\n` +
      `Copy UAT_SETUP.md instructions to populate .env.local.`
    );
  }

  return {
    baseUrl:       process.env.UAT_BASE_URL ?? 'http://localhost:3000',
    orgSlug:       process.env.UAT_ORG_SLUG!,
    platformAdmin: { email: process.env.UAT_PLATFORM_ADMIN_EMAIL!, password: process.env.UAT_PLATFORM_ADMIN_PASSWORD! },
    orgOwner:      { email: process.env.UAT_ORG_OWNER_EMAIL!,      password: process.env.UAT_ORG_OWNER_PASSWORD! },
    orgAdmin:      { email: process.env.UAT_ORG_ADMIN_EMAIL!,      password: process.env.UAT_ORG_ADMIN_PASSWORD! },
    coach:         { email: process.env.UAT_COACH_EMAIL!,          password: process.env.UAT_COACH_PASSWORD! },
    scorekeeper: process.env.UAT_SCOREKEEPER_EMAIL && process.env.UAT_SCOREKEEPER_PASSWORD
      ? { email: process.env.UAT_SCOREKEEPER_EMAIL, password: process.env.UAT_SCOREKEEPER_PASSWORD }
      : undefined,
    plusScorekeeper: process.env.UAT_PLUS_SCOREKEEPER_EMAIL && process.env.UAT_PLUS_SCOREKEEPER_PASSWORD
      ? { email: process.env.UAT_PLUS_SCOREKEEPER_EMAIL, password: process.env.UAT_PLUS_SCOREKEEPER_PASSWORD }
      : undefined,
  };
}
