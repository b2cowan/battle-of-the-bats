import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const DEV_BUCKET = 'fieldlogichq-bookkeeping-receipts-dev-859850635274';
const PREFIX = 'B2 QA Seed 2026-10-23';
const CREATED_BY = '00000000-0000-4000-8000-000000000001';
const expenses = [
  {
    id: 'b2026102-3000-4000-8000-000000000001', supplier: `${PREFIX} Personal CAD`,
    expense_date: '2026-10-23', category: 'B2 QA', business_purpose: 'Synthetic personal CAD expense for B2 report checks',
    original_currency: 'CAD', original_cents: 2000, cad_cents: 2000, tax_cad_cents: 200,
    tax_status: 'pending', business_use_percent: 50, payment_source: 'personal', conversion_note: null,
    receipt_path: 'b2026102-3000-4000-8000-000000000001/qa-seed-v1', receipt_name: '2026-10-23-b2-qa-personal-cad.pdf',
    receiptLabel: 'B2 synthetic QA receipt - Personal CAD',
  },
  {
    id: 'b2026102-3000-4000-8000-000000000002', supplier: `${PREFIX} Missing Receipt CAD`,
    expense_date: '2026-10-23', category: 'B2 QA', business_purpose: 'Synthetic CAD expense intentionally missing its receipt',
    original_currency: 'CAD', original_cents: 1000, cad_cents: 1000, tax_cad_cents: 100,
    tax_status: 'reviewed', business_use_percent: 100, payment_source: 'business_card', conversion_note: null,
    receipt_path: null, receipt_name: null,
  },
  {
    id: 'b2026102-3000-4000-8000-000000000003', supplier: `${PREFIX} USD Invoice`,
    expense_date: '2026-10-23', category: 'B2 QA', business_purpose: 'Synthetic USD invoice with documented CAD value',
    original_currency: 'USD', original_cents: 1000, cad_cents: 1400, tax_cad_cents: 0,
    tax_status: 'none', business_use_percent: 50, payment_source: 'personal',
    conversion_note: 'Bank of Canada rate 2026-10-22',
    receipt_path: 'b2026102-3000-4000-8000-000000000003/qa-seed-v1', receipt_name: '2026-10-23-b2-qa-usd-invoice.pdf',
    receiptLabel: 'B2 synthetic QA receipt - USD invoice',
  },
];

const endpoint = process.env.BOOKKEEPING_DSQL_ENDPOINT;
const bucket = process.env.BOOKKEEPING_S3_BUCKET;
if (endpoint !== DEV_HOST || bucket !== DEV_BUCKET || (process.env.BOOKKEEPING_AWS_REGION || 'us-east-2') !== 'us-east-2') {
  throw new Error('Refusing to seed: endpoint, bucket and region must exactly match the bookkeeping development resources.');
}
if (process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
  throw new Error('Refusing to seed: use the documented local development admin connection.');
}

function pdf(label) {
  const stream = `BT\n/F1 18 Tf\n50 740 Td\n(${label}) Tj\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'ascii');
}

const sql = auroraDSQLPostgres({ host: endpoint, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
const s3 = new S3Client({ region: 'us-east-2' });
const uploadedVersions = [];
try {
  const existing = await sql`SELECT expense_id::text AS expense_id, revision, supplier FROM bookkeeping.expense_revisions
    WHERE supplier LIKE ${`${PREFIX}%`}`;
  if (existing.length) {
    const exact = existing.length === expenses.length && expenses.every(row =>
      existing.some(found => found.expense_id === row.id && found.revision === 1 && found.supplier === row.supplier));
    if (exact) {
      console.log(`B2 QA seed is already present in development (${PREFIX}); no changes made.`);
      process.exitCode = 0;
    } else {
      throw new Error(`Found partial or conflicting rows for ${PREFIX}; refusing to add duplicates.`);
    }
  } else {
    for (const row of expenses.filter(item => item.receipt_path)) {
      const key = `receipts/${row.receipt_path}`;
      try {
        const found = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = found.Body && await found.Body.transformToByteArray();
        if (!bytes || !Buffer.from(bytes).equals(pdf(row.receiptLabel))) {
          throw new Error(`A different object already uses the reserved QA key ${key}.`);
        }
      } catch (error) {
        if (error?.name !== 'NoSuchKey' && error?.$metadata?.httpStatusCode !== 404) throw error;
        const result = await s3.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: pdf(row.receiptLabel), ContentType: 'application/pdf', IfNoneMatch: '*',
        }));
        uploadedVersions.push({ key, versionId: result.VersionId });
      }
    }

    try {
      await sql.begin(async tx => {
        for (const row of expenses) {
          await tx`INSERT INTO bookkeeping.expense_revisions (
            expense_id, revision, expense_date, supplier, category, business_purpose,
            original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
            business_use_percent, payment_source, conversion_note, notes, change_reason,
            receipt_path, receipt_name, void_reason, created_by
          ) VALUES (
            ${row.id}::uuid, 1, ${row.expense_date}::date, ${row.supplier}, ${row.category}, ${row.business_purpose},
            ${row.original_currency}, ${row.original_cents}, ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_status},
            ${row.business_use_percent}, ${row.payment_source}, ${row.conversion_note}, ${`Synthetic B2 QA seed; ${PREFIX}`},
            NULL, ${row.receipt_path}, ${row.receipt_name}, NULL, ${CREATED_BY}::uuid
          )`;
        }
      });
    } catch (error) {
      await Promise.allSettled(uploadedVersions.filter(item => item.versionId).map(item => s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: item.key, VersionId: item.versionId }),
      )));
      throw error;
    }
    console.log(`Seeded 3 synthetic B2 QA expenses and 2 private synthetic PDFs into development: ${PREFIX}`);
  }

  const verify = await sql`SELECT count(DISTINCT expense_id)::int AS expenses,
      count(*) FILTER (WHERE receipt_path IS NOT NULL)::int AS receipt_revisions,
      sum(CASE WHEN payment_source = 'personal' THEN floor((cad_cents * business_use_percent + 50) / 100) ELSE 0 END)::int AS personal_cents,
      sum(floor((cad_cents * business_use_percent + 50) / 100))::int AS spend_cents
    FROM bookkeeping.expense_revisions WHERE supplier LIKE ${`${PREFIX}%`}`;
  const totals = verify[0];
  if (Number(totals.expenses) !== 3 || Number(totals.receipt_revisions) !== 2 ||
      Number(totals.personal_cents) !== 1700 || Number(totals.spend_cents) !== 2700) {
    throw new Error('Development QA seed verification totals did not match the expected 3 expenses, 2 receipts, $17.00 personal and $27.00 spend.');
  }
  for (const row of expenses.filter(item => item.receipt_path)) {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `receipts/${row.receipt_path}` }));
    const bytes = object.Body && await object.Body.transformToByteArray();
    if (!bytes || object.ContentType !== 'application/pdf' || !Buffer.from(bytes).equals(pdf(row.receiptLabel))) {
      throw new Error(`Synthetic receipt verification failed for ${row.receipt_name}.`);
    }
  }
  console.log('Verified development QA rows: 3 expenses, 2 receipts, $27.00 spend, $17.00 personally paid.');
  console.log(`Search the register for “${PREFIX}”.`);
} finally {
  await sql.end();
  s3.destroy();
}
