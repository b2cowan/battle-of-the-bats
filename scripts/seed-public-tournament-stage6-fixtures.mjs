/** Manual, additive Stage 6 Rules samples on the existing marked Stage 1 DEV fixture only.
 * Run: node --env-file=.env.local scripts/seed-public-tournament-stage6-fixtures.mjs
 * Leaves every existing row intact; reruns add only missing, explicitly labelled QA samples.
 */
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Run with --env-file=.env.local.');
if (url.includes('qcttcboqysynwcdyghil')) throw new Error('Refusing the production project.');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = async (query) => { const { data, error } = await query; if (error) throw error; return data; };
const org = await checked(db.from('organizations').select('id,internal_notes').eq('slug', 'stage1-lakeshore-lightning').single());
if (!org.internal_notes?.includes('seed-public-frame-fixtures.mjs (Public tournament pages Stage 1)')) {
  throw new Error('Refusing an organization without the Stage 1 fixture marker.');
}
const tournament = await checked(db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'fall-classic').single());
const existing = await checked(db.from('rules').select('id,title,display_order').eq('tournament_id', tournament.id));
const samples = [
  ['Format', 'Sample rules for the Stage 6 owner check. All divisions play pool games followed by playoffs.'],
  ['Game length', 'Pool games are 60 minutes. Playoff games are 75 minutes. No new period starts in the last 5 minutes.'],
  ['Ties and tie-breakers', 'A pool game tied at the end stays a tie. See Standings for the tournament tie-breakers.'],
  ['Weather and delays', 'The organizer posts weather changes on News. Check the Schedule for updated game times.'],
  ['Rosters and eligibility', 'A team must submit its roster before its first game. Players compete in their registered division.'],
  ['Code of conduct', 'Participants and spectators treat officials, opponents and volunteers with respect.'],
  ['Protests', 'Speak to the tournament office before submitting a protest.'],
  ['On the day: who to ask', 'Ask the tournament office for help with a field change or a missing item.'],
];
const prefix = '[Stage 6 QA] ';
let order = Math.max(-1, ...existing.map(r => r.display_order)) + 1;
for (const [name, content] of samples) {
  const title = prefix + name;
  let row = existing.find(r => r.title === title);
  if (!row) row = await checked(db.from('rules').insert({ tournament_id: tournament.id, title, display_order: order++ }).select('id').single());
  const items = await checked(db.from('rule_items').select('id').eq('rule_id', row.id));
  // Also repairs an interrupted first run, without replacing anyone's text.
  if (!items.length) await checked(db.from('rule_items').insert({ rule_id: row.id, content, display_order: 0 }));
}
const resources = await checked(db.from('resources').select('id,label,display_order').eq('tournament_id', tournament.id));
for (const [index, label] of ['Sample tournament resource', 'Sample venue resource'].entries()) {
  if (resources.some(r => r.label === prefix + label)) continue;
  await checked(db.from('resources').insert({ tournament_id: tournament.id, label: prefix + label,
    url: 'https://example.com/', display_order: Math.max(-1, ...resources.map(r => r.display_order)) + 1 + index }));
}
console.log('Stage 6 QA Rules ready: /stage1-lakeshore-lightning/fall-classic/rules (8 sample sections, 2 sample resources).');
