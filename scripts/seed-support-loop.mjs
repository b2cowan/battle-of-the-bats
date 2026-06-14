/**
 * Seed SUPPORT-LOOP data for the Platform-Admin Employee Audit (PA2 support seam).
 *
 * Stages realistic rows so the support walk runs against real data:
 *   • feedback_submissions  — customer feedback the support rep must receive/triage
 *   • error_groups/error_events — via the record_error_event RPC (proper fingerprinting),
 *     including one group that MATCHES a feedback item, so we can test whether a rep can
 *     correlate feedback → error (the close-the-loop seam).
 *   • platform_catalog_change_requests — so the change-requests queue isn't empty.
 *
 * Schemas verified against the live dev snapshot 2026-06-13. DEV ONLY (service-role).
 * Idempotent-ish: feedback/errors are append-y (re-running adds occurrences / dupes by title);
 * change-requests skip if a same-title row already exists.
 *
 * Run: node --env-file=.env.local scripts/seed-support-loop.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ Missing env. Run: node --env-file=.env.local scripts/seed-support-loop.mjs'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Attach to a real org if one exists, so org-scoped views populate.
const { data: org } = await db.from('organizations').select('id, slug, name').limit(1).maybeSingle();
const orgId = org?.id ?? null;
const orgSlug = org?.slug ?? null;
console.log(org ? `• attaching seed rows to org "${org.name}" (${org.slug})` : '• no org found — seeding org-less rows');

// ── 1. Feedback ────────────────────────────────────────────────────────────────
const FEEDBACK = [
  { type: 'bug',      category: 'Tournaments',  title: 'Scores will not save',     body: 'I tap Save on the score sheet and nothing happens — the game stays Pending. Happens every game today.', severity: 'error',   status: 'new' },
  { type: 'bug',      category: 'Registrations', title: 'Payment page 500s',       body: 'Parents trying to pay the registration fee hit a server error after entering their card.', severity: 'critical', status: 'new' },
  { type: 'feature',  category: 'Accounting',   title: 'Export budget to CSV',     body: 'Would love a CSV export on the team budget page so I can share with the board.', severity: 'info',    status: 'triaged' },
  { type: 'feedback', category: 'Other',        title: 'Love the new schedule view', body: 'Just wanted to say the new schedule timeline is great. Easier to read on my phone.', severity: 'info',  status: 'acknowledged' },
];
for (const f of FEEDBACK) {
  const { data: dup } = await db.from('feedback_submissions').select('id').eq('title', f.title).contains('context', { seed: 'support-loop-audit' }).maybeSingle();
  if (dup) { console.log(`• feedback exists  ${f.title}`); continue; }
  const { error } = await db.from('feedback_submissions').insert({
    org_id: orgId, user_email: 'coach@example.com', submitter_name: 'Sample Coach',
    type: f.type, category: f.category, title: f.title, body: f.body, status: f.status, severity: f.severity, context: { seed: 'support-loop-audit' },
  });
  if (error) { console.error(`❌ feedback "${f.title}":`, error.message); process.exit(1); }
  console.log(`✓ feedback  [${f.status}] ${f.title}`);
}

// ── 2. Observability error groups (proper RPC) ──────────────────────────────────
// First group MATCHES feedback "Scores will not save" → tests feedback↔error correlation.
const ERRORS = [
  { fp: 'audit-scores-save',  name: 'PostgrestError',    route: '/api/admin/games/score', method: 'POST', status: 500, message: 'duplicate key value violates unique constraint "games_pkey"', severity: 'error',    reps: 12 },
  { fp: 'audit-reg-payment',  name: 'StripeCardError',   route: '/api/registrations/pay', method: 'POST', status: 500, message: 'No such payment_intent', severity: 'critical', reps: 5  },
  { fp: 'audit-public-fetch', name: 'TypeError',         route: '/api/public/tournament-data', method: 'GET', status: 500, message: "Cannot read properties of undefined (reading 'teams')", severity: 'warning', reps: 30 },
];
for (const e of ERRORS) {
  for (let i = 0; i < e.reps; i++) {
    const { error } = await db.rpc('record_error_event', {
      p_fingerprint: e.fp, p_title: `${e.name} @ ${e.route}`, p_error_name: e.name, p_route: e.route,
      p_http_method: e.method, p_status_code: e.status, p_error_message: e.message,
      p_stack: `${e.name}: ${e.message}\n    at handler (${e.route}:1:1)`, p_severity: e.severity,
      p_env: 'dev', p_source: 'server', p_org_id: orgId, p_org_slug: orgSlug,
      p_user_id: null, p_user_email: 'coach@example.com', p_user_role: 'coach',
      p_request_id: `audit-${e.fp}-${i}`, p_ip: null, p_user_agent: 'audit-seed', p_context: { seed: 'support-loop-audit' },
    });
    if (error) { console.error(`❌ error_event "${e.fp}":`, error.message); process.exit(1); }
  }
  console.log(`✓ error group  ${e.name} @ ${e.route}  (${e.reps} occurrences, ${e.severity})`);
}

// ── 3. Change requests ──────────────────────────────────────────────────────────
const CRS = [
  { request_type: 'pricing', title: 'Audit: Q3 Tournament plan price review',  description: 'Proposed +$10/mo on the Tournament plan.', priority: 'high',   status: 'needs_review' },
  { request_type: 'addon',   title: 'Audit: extra-org seat add-on',            description: 'New add-on for multi-org operators.',       priority: 'medium', status: 'draft' },
];
for (const c of CRS) {
  const { data: dup } = await db.from('platform_catalog_change_requests').select('id').eq('title', c.title).maybeSingle();
  if (dup) { console.log(`• change-request exists  ${c.title}`); continue; }
  const { error } = await db.from('platform_catalog_change_requests').insert({
    request_type: c.request_type, title: c.title, description: c.description, priority: c.priority,
    status: c.status, created_by_email: 'product@dev.local', submitted_by_email: c.status === 'needs_review' ? 'product@dev.local' : null,
    submitted_at: c.status === 'needs_review' ? new Date().toISOString() : null, proposal: { seed: 'support-loop-audit' },
  });
  if (error) { console.error(`❌ change-request "${c.title}":`, error.message); process.exit(1); }
  console.log(`✓ change request  [${c.status}] ${c.title}`);
}

console.log('\nDone. Support-loop data seeded.');
