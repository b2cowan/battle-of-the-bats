/**
 * Runs scripts/verify-migration-093.sql against a Supabase Postgres database.
 *
 * Preferred usage:
 *   DATABASE_URL="postgresql://..." node scripts/verify-migration-093.mjs
 *
 * Or with Supavisor pooler pieces:
 *   SUPABASE_PROJECT_REF="..." SUPABASE_DB_PASSWORD="..." node scripts/verify-migration-093.mjs
 *
 * Local repo convenience for the existing dev helper configuration:
 *   node scripts/verify-migration-093.mjs --use-dev-helper
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sqlPath = path.join(__dirname, 'verify-migration-093.sql');

function readDevHelperConfig() {
  const helperPath = path.join(__dirname, 'run-migration.mjs');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const projectRef = helper.match(/PROJECT_REF = '([^']+)'/)?.[1];
  const password = helper.match(/DB_PASSWORD = '([^']+)'/)?.[1];

  if (!projectRef || !password) {
    throw new Error('Could not read PROJECT_REF/DB_PASSWORD from scripts/run-migration.mjs');
  }

  return {
    host: process.env.SUPABASE_DB_HOST || 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
  };
}

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  const useDevHelper = process.argv.includes('--use-dev-helper');
  if (useDevHelper) return readDevHelperConfig();

  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!projectRef || !password) {
    throw new Error(
      'Set DATABASE_URL, or set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD, ' +
      'or pass --use-dev-helper for the existing dev helper config.'
    );
  }

  return {
    host: process.env.SUPABASE_DB_HOST || 'aws-0-ca-central-1.pooler.supabase.com',
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    user: process.env.SUPABASE_DB_USER || `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
  };
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const connectionConfig = buildConnectionConfig();
const target = connectionConfig.connectionString
  ? 'DATABASE_URL'
  : `${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database} as ${connectionConfig.user}`;

console.log(`Running Migration 093 verification against ${target}`);

const client = new Client(connectionConfig);

try {
  await client.connect();
  const result = await client.query(sql);
  console.table(result.rows);

  const failures = result.rows.filter((row) => String(row.status).startsWith('FAIL'));
  if (failures.length > 0) {
    console.error(`Migration 093 verification failed: ${failures.length} failing check(s).`);
    process.exitCode = 1;
  } else {
    console.log('Migration 093 verification passed.');
  }
} finally {
  await client.end().catch(() => {});
}
