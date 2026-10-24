import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const environment = process.argv[2];
const settings = {
  dev: {
    host: 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws',
    role: 'arn:aws:iam::859850635274:role/fieldlogichq-bookkeeping-dev-compute',
  },
  prod: {
    host: 'yfufvc3kksszegkyztie7hveoq.dsql.us-east-2.on.aws',
    role: 'arn:aws:iam::859850635274:role/fieldlogichq-bookkeeping-prod-compute',
  },
};
if (!settings[environment]) throw new Error('Choose dev or prod');
const { host, role } = settings[environment];
const sql = auroraDSQLPostgres({ host, username: 'admin', max: 1 });
const path = fileURLToPath(new URL('./bookkeeping-aws/schema.sql', import.meta.url));
const statements = readFileSync(path, 'utf8').replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
try {
  const existing = await sql.unsafe("SELECT 1 FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions'");
  if (existing.length) throw new Error(`${environment} schema already exists; refusing to reapply`);
  for (const statement of statements) await sql.unsafe(statement);
  await sql.unsafe(`AWS IAM GRANT bookkeeping_app TO '${role}'`);
  console.log(`Created bookkeeping schema and app role in ${environment}`);
} finally {
  await sql.end();
}
