import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { heldChangesOf } from './league-game-changes-server';
import { sendChangesAndTell } from './league-schedule-mail';
import type { RainSendDivision } from './league-rainout';

type MailOrg = Parameters<typeof sendChangesAndTell>[0]['org'];
type MailSeason = Parameters<typeof sendChangesAndTell>[0]['season'];

/**
 * SEND A RAINOUT (9e·12): one send per division, as the urgent single-game send (f5) — that division's held rows on the
 * rainout's games (every held row on them, as the send requires), one email per family, the teams' coaches copied, and
 * the club's line read from the rows at send time. A division refused or failed keeps its changes held in Changes to
 * send; the others are not undone (emails can't be taken back). Never throws.
 */
export async function sendRainout(p: {
  org: MailOrg; season: MailSeason; actorId: string; gameIds: readonly string[]; divisionIds: readonly string[];
}): Promise<RainSendDivision[]> {
  const games = new Set(p.gameIds);
  const { data: divs } = await supabaseAdmin.from('league_divisions').select('id, name').in('id', [...p.divisionIds]);
  const nameOf = new Map((divs ?? []).map(d => [d.id as string, d.name as string]));
  const out: RainSendDivision[] = [];
  for (const divisionId of p.divisionIds) {
    const base = { divisionId, name: nameOf.get(divisionId) ?? '', emails: 0, missed: 0, games: 0 };
    try {
      const held = (await heldChangesOf(p.season.id, divisionId)).filter(c => games.has(c.gameId));
      base.games = new Set(held.map(c => c.gameId)).size;
      if (!held.length) { out.push({ ...base, outcome: 'already' }); continue; }
      const r = await sendChangesAndTell({ org: p.org, season: p.season, divisionId, actorId: p.actorId, changeIds: held.map(c => c.id) });
      if (r.refusal === null) out.push({ ...base, outcome: 'told', emails: r.families, missed: r.failed });
      else if (r.refusal === 'already' || r.refusal === 'nothing') out.push({ ...base, outcome: 'already' });
      else out.push({ ...base, outcome: 'failed' });
    } catch (err) {
      console.error('[league-rainout] a division\'s send failed (its changes stay in Changes to send):', err instanceof Error ? err.message : String(err));
      out.push({ ...base, outcome: 'failed' });
    }
  }
  return out;
}
