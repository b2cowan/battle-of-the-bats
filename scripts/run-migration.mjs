/**
 * Migration runner — executes a SQL migration file against the Supabase dev DB.
 * Uses a direct PostgreSQL connection (pg package).
 *
 * Usage: node scripts/run-migration.mjs <path-to-migration.sql>
 *
 * Connection target: Supabase dev project (npgnrxaitgbtbtvvykto)
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const DB_PASSWORD = 'kAtYeg2Tk8xqvHv3';

// Use Supavisor session-mode pooler (port 5432) — supports DDL + multi-statement.
// Direct db.*.supabase.co may be firewalled; pooler resolves in all environments.
const connectionConfig = {
  host: 'aws-0-ca-central-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: `postgres.${PROJECT_REF}`,   // Supavisor requires tenant-scoped user
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const [, , migrationFile] = process.argv;
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-migration.sql>');
  process.exit(1);
}

const sqlPath = path.resolve(migrationFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

console.log(`\n📄 Migration file: ${path.basename(sqlPath)}`);
console.log(`🔗 Connecting to: ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}\n`);

const client = new Client(connectionConfig);

try {
  await client.connect();
  console.log('✅ Connected.\n');

  console.log('▶ Executing SQL...\n');
  const result = await client.query(sql);
  console.log('✅ Migration applied successfully.\n');

  // Print row counts if any UPDATE statements
  if (Array.isArray(result)) {
    result.forEach((r, i) => {
      if (r.rowCount !== null) {
        console.log(`  Statement ${i + 1}: rowCount = ${r.rowCount}`);
      }
    });
  } else if (result.rowCount !== null) {
    console.log(`  rowCount = ${result.rowCount}`);
  }

} catch (err) {
  console.error('❌ Migration failed:', err.message);
  if (err.detail) console.error('   Detail:', err.detail);
  if (err.hint) console.error('   Hint:', err.hint);
  process.exit(1);
} finally {
  await client.end();
  console.log('\n🔒 Connection closed.');
}
