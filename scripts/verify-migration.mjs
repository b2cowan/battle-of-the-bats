/**
 * Post-migration verification queries for the contact model refactor.
 * Runs after migrations 088 + 089 are applied.
 */

import pg from 'pg';

const { Client } = pg;

const PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const DB_PASSWORD = 'kAtYeg2Tk8xqvHv3';

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('✅ Connected.\n');

const run = async (label, sql) => {
  const res = await client.query(sql);
  console.log(`--- ${label} ---`);
  console.table(res.rows);
  return res;
};

// 1. Confirm new columns exist on organization_members
await run(
  '1. organization_members — new columns',
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'organization_members'
     AND column_name IN ('title', 'display_name')
   ORDER BY column_name`
);

// 2. Confirm new columns on tournaments
await run(
  '2. tournaments — new columns',
  `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'tournaments'
     AND column_name IN ('default_contact_member_id', 'notify_mode', 'contact_email')
   ORDER BY column_name`
);

// 3. Confirm new column on age_groups
await run(
  '3. age_groups — new column',
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'age_groups'
     AND column_name IN ('contact_member_id', 'contact_id')
   ORDER BY column_name`
);

// 4. Backfill coverage — tournaments without a default_contact_member_id
await run(
  '4. Tournaments missing default_contact_member_id (target: 0)',
  `SELECT COUNT(*) AS missing_count
   FROM public.tournaments
   WHERE default_contact_member_id IS NULL`
);

// 5. Backfill coverage — age_groups where old contact_id set but contact_member_id not resolved
await run(
  '5. Age groups with contact_id but no contact_member_id (orphan count)',
  `SELECT COUNT(*) AS orphan_count
   FROM public.age_groups
   WHERE contact_id IS NOT NULL
     AND contact_member_id IS NULL`
);

// 6. notify_mode check — all should be 'all' (default)
await run(
  '6. notify_mode distribution',
  `SELECT notify_mode, COUNT(*) AS count
   FROM public.tournaments
   GROUP BY notify_mode
   ORDER BY notify_mode`
);

// 7. Constraint check
await run(
  '7. New constraints on tournaments + organization_members',
  `SELECT tc.table_name, tc.constraint_name, tc.constraint_type
   FROM information_schema.table_constraints tc
   WHERE tc.table_schema = 'public'
     AND tc.constraint_name IN (
       'tournaments_notify_mode_check',
       'org_members_title_length',
       'tournaments_default_contact_member_id_fkey',
       'age_groups_contact_member_id_fkey'
     )
   ORDER BY tc.table_name, tc.constraint_name`
);

await client.end();
console.log('\n🔒 Connection closed.');
