import 'server-only';
import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from './db';
import { resolvePublicLeagueContext } from './public-league';
import { supabaseAdmin } from './supabase-admin';
import { openSignupLink } from './league-signup-link';
import { isFinishedLeagueSeason } from './house-league-access';
import { registrationReference } from './utils';
import { ensureSeasonForm } from './club-form-server';
import { familyFormState, liveRow, type FamilyFormState, type FamilyRow } from './club-form-family';
import type { LeagueSeason, Organization } from './types';

/**
 * The door every Your-sign-up form request comes through (Board Ready Stage 4 Part 2: a re-tick, a Change). The possession
 * proof is the family's link alone, read through the one door (`openSignupLink`), as friends and "Ask to withdraw" are;
 * a child is named by its own registration code among that sign-up's children, never by its id. The link's own rows and
 * reference are the sign-up (no second read of them).
 */
type FamilyFormDoor = {
  org: Organization; season: LeagueSeason; formId: string; rows: FamilyRow[]; signupKey: string;
  /** Divisions whose teams are made: answers close for their children then (ruling 20). */
  teamsMade: Set<string>;
  finished: boolean;
  /** The sign-up's children who can still act (not declined, not withdrawn). */
  live: FamilyRow[];
  /** A child of this sign-up by its code; undefined when it isn't one of them. */
  childOf: (code: unknown) => FamilyRow | undefined;
};

const GENERIC = 'Something went wrong. Reload the page and try again.';
const familyFail = (status: number, error = GENERIC, code?: string) => ({ fail: NextResponse.json({ error, ...(code ? { code } : {}) }, { status }) });

export async function openFamilyForm(orgSlug: string, seasonSlug: string, token: unknown): Promise<FamilyFormDoor | { fail: NextResponse }> {
  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return familyFail(404, 'Not found');
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return familyFail(404, 'Not found');
  if (typeof token !== 'string' || !token.trim()) return familyFail(400);
  const [link, formId] = await Promise.all([openSignupLink(token.trim(), { at: { orgId: org.id, seasonId: season.id } }), ensureSeasonForm(season.id)]);
  if (!link.ok) return familyFail(404, GENERIC, link.ended);
  const rows = link.rows as FamilyRow[];
  const live = rows.filter(liveRow);
  return {
    org, season, formId, rows, signupKey: link.signupKey, teamsMade: await teamsMadeFor(rows),
    finished: isFinishedLeagueSeason(season), live,
    childOf: code => {
      const c = typeof code === 'string' ? code.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8) : '';
      return c.length === 8 ? live.find(r => registrationReference(r.id) === c) : undefined;
    },
  };
}

/** The divisions of a sign-up's children whose teams are made. */
async function teamsMadeFor(rows: readonly Pick<FamilyRow, 'division_id'>[]): Promise<Set<string>> {
  const divisionIds = [...new Set(rows.map(r => r.division_id).filter((x): x is string => !!x))];
  if (divisionIds.length === 0) return new Set();
  const { data, error } = await supabaseAdmin.from('league_divisions').select('id, teams_published_at').in('id', divisionIds);
  if (error) throw error;
  return new Set(((data ?? []) as { id: string; teams_published_at: string | null }[]).filter(d => d.teams_published_at).map(d => d.id));
}

/**
 * What Your sign-up shows of the season's form, for a link already opened (both pages: the emailed link and the signed-in
 * app), from the link's own rows and reference. Null when the form asks nothing of this sign-up, and on any failure: the
 * page around it must never break for it.
 */
export async function familyFormForPage(season: Pick<LeagueSeason, 'id' | 'status'>, link: { rows: readonly FamilyRow[]; signupKey: string }): Promise<FamilyFormState | null> {
  try {
    const [formId, teamsMade] = await Promise.all([ensureSeasonForm(season.id), teamsMadeFor(link.rows)]);
    const state = await familyFormState({ formId, rows: link.rows, signupKey: link.signupKey, teamsMade, finished: isFinishedLeagueSeason(season) });
    return state.form.questions.length === 0 && state.asks.length === 0 ? null : state;
  } catch (e) {
    console.error('[club-form] Your sign-up could not read the form:', (e as { code?: string })?.code ?? 'no code');
    return null;
  }
}
