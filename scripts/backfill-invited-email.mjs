/**
 * backfill-invited-email.mjs
 *
 * One-time backfill for migration 128: fill organization_members.invited_email on
 * existing status='invited' rows from their auth-user email. New invites/re-invites
 * already write invited_email; this only catches rows created BEFORE mig 128.
 *
 * Without this, a pre-128 pending invitee who self-registers can't be reconciled by
 * email (their row's invited_email is null). After this, they can.
 *
 * Usage:
 *   node scripts/backfill-invited-email.mjs                          # dev (.env.local)
 *   node scripts/backfill-invited-email.mjs --env .env.production.local   # prod
 *   node scripts/backfill-invited-email.mjs --dry-run                # report only, no writes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the chosen env file.
 * Idempotent: only touches rows where invited_email IS NULL.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const dryRun = process.argv.includes('--dry-run');
const envPath = argValue('--env', '.env.local');
dotenv.config({ path: envPath });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !serviceKey) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envPath}`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log(`Backfilling invited_email (${envPath})${dryRun ? ' — DRY RUN' : ''}…`);

  const { data: rows, error } = await supabase
    .from('organization_members')
    .select('id, user_id')
    .eq('status', 'invited')
    .is('invited_email', null);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('Nothing to backfill — no invited rows with null invited_email.');
    return;
  }

  console.log(`Found ${rows.length} invited row(s) missing invited_email.`);
  let filled = 0;
  let skipped = 0;

  for (const row of rows) {
    const { data: authData } = await supabase.auth.admin.getUserById(row.user_id);
    const email = authData?.user?.email?.trim().toLowerCase();
    if (!email) {
      console.warn(`  - ${row.id}: no auth email for user_id ${row.user_id} — skipped`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  - ${row.id}: would set invited_email=${email}`);
      filled++;
      continue;
    }
    const { error: upErr } = await supabase
      .from('organization_members')
      .update({ invited_email: email })
      .eq('id', row.id)
      .eq('status', 'invited')    // don't write onto a row that was accepted mid-run
      .is('invited_email', null); // idempotent re-check
    if (upErr) {
      console.warn(`  - ${row.id}: update failed (${upErr.message}) — skipped`);
      skipped++;
    } else {
      filled++;
    }
  }

  console.log(`\nDone. ${filled} ${dryRun ? 'would be ' : ''}filled, ${skipped} skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
