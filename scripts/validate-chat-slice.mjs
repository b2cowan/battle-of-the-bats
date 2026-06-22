/**
 * Proving-slice validation for the chat foundation (migration 141).
 *
 * Proves, on the live dev database, the two things that make-or-break the chat engine:
 *   1. LIVE DELIVERY  — an active room member receives another member's message in real time.
 *   2. TENANT PRIVACY — a NON-member receives nothing live AND cannot query the messages,
 *                       and cannot post into the room.
 *
 * Why this matters: this platform has been bitten before by "live updates that silently deliver
 * nothing, with no error" (the games realtime bug). This script subscribes as REAL authenticated
 * users (anon key + signed-in JWT, so the database privacy rules actually apply) and asserts the
 * outcome, rather than trusting that the policy "looks right".
 *
 * Run from the repo root:
 *   node --env-file=.env.local scripts/validate-chat-slice.mjs
 *
 * Also proves the access boundary holds against active attackers: a member cannot self-promote to
 * moderator or change their own status, cannot post as another user, and a `removed` member is
 * walled off like a stranger.
 *
 * Creates 4 throwaway auth users + 1 room and deletes them all on exit.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error('Missing env. Need NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Run: node --env-file=.env.local scripts/validate-chat-slice.mjs');
  process.exit(1);
}

// Service-role client — setup/teardown only (bypasses RLS). NEVER used for the subscriptions.
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'devpass123';
const EMAILS = {
  memberA: 'chat-slice-a@dev.local',
  memberB: 'chat-slice-b@dev.local',
  outsider: 'chat-slice-out@dev.local',
  removed: 'chat-slice-removed@dev.local',
};

const results = [];
function check(label, passed, detail = '') {
  results.push({ label, passed });
  console.log(`  ${passed ? 'PASS' : 'FAIL'} — ${label}${detail ? `  (${detail})` : ''}`);
}

async function findUser(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email) {
  const existing = await findUser(email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true });
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user;
}

function anonClient() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function signIn(email) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  // Be explicit: hand the user's JWT to the realtime socket so RLS auth.uid() resolves to them.
  client.realtime.setAuth(data.session.access_token);
  return client;
}

// Subscribe and resolve once the channel is actually live (or reject on error/timeout).
function subscribeReady(client, channelName, roomId, onInsert) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`subscribe timeout: ${channelName}`)), 12000);
    const channel = client
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, onInsert)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(channel); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer); reject(new Error(`subscribe ${status}: ${channelName}`));
        }
      });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let roomId = null;
const userIds = [];
const clients = [];

try {
  console.log('Chat proving-slice validation\n-----------------------------');

  // 1. Test users
  const users = {};
  for (const [key, email] of Object.entries(EMAILS)) {
    users[key] = await ensureUser(email);
    userIds.push(users[key].id);
  }
  console.log(`Test users ready: A=${users.memberA.id.slice(0, 8)} B=${users.memberB.id.slice(0, 8)} outsider=${users.outsider.id.slice(0, 8)}`);

  // 2. An org to own the room (org_id is NOT NULL). Any existing org works — the privacy rule is
  //    membership-based, not org-based.
  const { data: org, error: orgErr } = await admin.from('organizations').select('id, slug').limit(1).single();
  if (orgErr || !org) throw new Error(`could not find an organization to anchor the test room: ${orgErr?.message}`);

  // 3. Room + memberships (A and B active; outsider gets NOTHING)
  roomId = randomUUID();
  const { error: roomErr } = await admin.from('chat_rooms').insert({
    id: roomId,
    org_id: org.id,
    surface: 'tournament',
    ref_id: randomUUID(),
    name: 'chat-slice-validation',
    created_by_user_id: users.memberA.id,
    is_archived: false,
  });
  if (roomErr) throw new Error(`insert chat_rooms: ${roomErr.message}`);

  for (const key of ['memberA', 'memberB']) {
    const { error } = await admin.from('chat_room_members').insert({
      room_id: roomId, user_id: users[key].id, member_role: 'member', status: 'active',
    });
    if (error) throw new Error(`insert membership ${key}: ${error.message}`);
  }
  // A removed member: HAS a membership row but status='removed' — must be blocked like a non-member
  // (proves status gating, not mere row existence).
  {
    const { error } = await admin.from('chat_room_members').insert({
      room_id: roomId, user_id: users.removed.id, member_role: 'member', status: 'removed',
    });
    if (error) throw new Error(`insert membership removed: ${error.message}`);
  }
  console.log(`Room ${roomId.slice(0, 8)} created in org "${org.slug}", members A + B active; outsider + removed excluded.\n`);

  // 4. Subscribe member B and the outsider BEFORE the message is sent.
  let bReceived = null;
  let outsiderReceived = null;
  const clientB = await signIn(EMAILS.memberB);
  const clientOut = await signIn(EMAILS.outsider);
  clients.push(clientB, clientOut);
  const chanB = await subscribeReady(clientB, 'slice-b', roomId, (p) => { bReceived = p.new; });
  const chanOut = await subscribeReady(clientOut, 'slice-out', roomId, (p) => { outsiderReceived = p.new; });

  // Warm-up: the channel reports SUBSCRIBED a beat BEFORE postgres_changes actually starts
  // streaming. A message sent into that gap is silently missed. Real UI must load history via a
  // fetch and treat realtime as post-connection updates; here we just wait for the stream to arm.
  await sleep(3000);

  // 5. Member A posts a message through their OWN authenticated client (exercises the insert rule).
  const clientA = await signIn(EMAILS.memberA);
  clients.push(clientA);
  const body = `slice-validation-${Date.now()}`;
  const { error: msgErr } = await clientA.from('chat_messages').insert({ room_id: roomId, sender_user_id: users.memberA.id, body });
  check('an active member can post a message', !msgErr, msgErr ? msgErr.message : `body="${body}"`);

  // 6. Wait for live propagation, then assert.
  await sleep(3500);
  check('member B receives the message LIVE', bReceived?.body === body, bReceived ? `got "${bReceived.body}"` : 'no realtime payload within 3.5s');
  check('non-member receives NOTHING live', outsiderReceived === null, outsiderReceived ? `LEAKED "${outsiderReceived.body}"` : 'silent, as expected');

  await clientB.removeChannel(chanB);
  await clientOut.removeChannel(chanOut);

  // 7. Query-path privacy: member B can read it; outsider cannot.
  const { data: bRows } = await clientB.from('chat_messages').select('id, body').eq('room_id', roomId);
  check('member B can query the message', (bRows?.length ?? 0) === 1, `${bRows?.length ?? 0} row(s)`);

  const { data: outRows } = await clientOut.from('chat_messages').select('id').eq('room_id', roomId);
  check('non-member query returns ZERO rows', (outRows?.length ?? 0) === 0, `${outRows?.length ?? 0} row(s)`);

  // 8. Outsider cannot post into the room.
  const { error: outInsertErr } = await clientOut.from('chat_messages').insert({ room_id: roomId, sender_user_id: users.outsider.id, body: 'intrusion attempt' });
  check('non-member CANNOT post into the room', !!outInsertErr, outInsertErr ? 'blocked by RLS' : 'INSERT unexpectedly succeeded');

  // 9–10. Privilege escalation: a member must NOT be able to flip their own role/status. (RLS alone
  // can't stop this — the column-scoped grant does, by rejecting an UPDATE that names those columns.)
  const { error: promoteErr } = await clientB.from('chat_room_members').update({ member_role: 'moderator' }).eq('user_id', users.memberB.id);
  check('member CANNOT self-promote to moderator', !!promoteErr, promoteErr ? 'blocked at privilege layer' : 'UPDATE unexpectedly SUCCEEDED — escalation hole');

  const { error: statusErr } = await clientB.from('chat_room_members').update({ status: 'active' }).eq('user_id', users.memberB.id);
  check('member CANNOT change own status', !!statusErr, statusErr ? 'blocked at privilege layer' : 'UPDATE unexpectedly SUCCEEDED — ban-evasion hole');

  // 11. ...but the one allowed self-write (the read watermark) still works.
  const { error: readErr } = await clientB.from('chat_room_members').update({ last_read_at: new Date().toISOString() }).eq('user_id', users.memberB.id);
  check('member CAN update own last_read_at', !readErr, readErr ? readErr.message : 'allowed');

  // 12. A member cannot post AS someone else (spoofed sender).
  const { error: spoofErr } = await clientA.from('chat_messages').insert({ room_id: roomId, sender_user_id: users.memberB.id, body: 'spoofed sender' });
  check('member CANNOT post as another user', !!spoofErr, spoofErr ? 'blocked by RLS' : 'INSERT unexpectedly SUCCEEDED — spoofing hole');

  // 13. A REMOVED member (row present, status='removed') is walled off like a non-member.
  const clientRemoved = await signIn(EMAILS.removed);
  clients.push(clientRemoved);
  const { data: remRows } = await clientRemoved.from('chat_messages').select('id').eq('room_id', roomId);
  check('removed member query returns ZERO rows', (remRows?.length ?? 0) === 0, `${remRows?.length ?? 0} row(s)`);
  const { error: remInsErr } = await clientRemoved.from('chat_messages').insert({ room_id: roomId, sender_user_id: users.removed.id, body: 'removed attempt' });
  check('removed member CANNOT post', !!remInsErr, remInsErr ? 'blocked by RLS' : 'INSERT unexpectedly SUCCEEDED');

} catch (err) {
  console.error('\nERROR:', err.message);
  process.exitCode = 1;
} finally {
  // Teardown — child rows first, then room, then users.
  try {
    for (const c of clients) { try { await c.removeAllChannels(); } catch { /* noop */ } }
    if (roomId) {
      await admin.from('chat_messages').delete().eq('room_id', roomId);
      await admin.from('chat_room_members').delete().eq('room_id', roomId);
      await admin.from('chat_rooms').delete().eq('id', roomId);
    }
    for (const uid of userIds) { try { await admin.auth.admin.deleteUser(uid); } catch { /* noop */ } }
  } catch (cleanupErr) {
    console.error('cleanup warning:', cleanupErr.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n-----------------------------\n${passed}/${total} checks passed.`);
  if (passed !== total || total === 0) process.exitCode = 1;
  // Realtime keeps the socket open; force exit so the script returns to the shell.
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
