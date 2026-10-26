# Bookkeeping AWS resources and handoff

Created 2026-10-23 in AWS account `859850635274`, Region **US East (Ohio), `us-east-2`**, alongside the FieldLogicHQ Amplify app `d3ld0l2bgmmlga`. The owner chose AWS storage to avoid a new fixed-fee Supabase project. This is private proprietor data, separate from the product Supabase databases.

| Environment | Aurora DSQL cluster | Private S3 receipt bucket | Amplify compute role |
|---|---|---|---|
| Development | `wbufvbnlahjfagmjgrheg4ee5q` | `fieldlogichq-bookkeeping-receipts-dev-859850635274` | `fieldlogichq-bookkeeping-dev-compute` |
| Production | `yfufvc3kksszegkyztie7hveoq` | `fieldlogichq-bookkeeping-receipts-859850635274` | `fieldlogichq-bookkeeping-prod-compute` |

Both clusters are single-Region, active, encrypted with AWS-owned keys and deletion protected. Each has the `bookkeeping.expense_revisions` table and a `bookkeeping_app` role with `SELECT` and `INSERT` only. The production table is empty. The buckets block all public access, use S3-managed encryption, have versioning enabled and require HTTPS. Receipt object keys are under `receipts/`. The role policies in `scripts/bookkeeping-aws/` limit each compute role to its own cluster and receipt prefix. The schema source is `scripts/bookkeeping-aws/schema.sql`; `scripts/bookkeeping-dsql-schema.mjs` is a one-time initializer and refuses to reapply to an existing table.

The Amplify **dev** branch has the development compute role and the nonsecret `BOOKKEEPING_DSQL_ENDPOINT`, `BOOKKEEPING_S3_BUCKET` and `BOOKKEEPING_AWS_REGION` variables. Its existing environment values were preserved. The **master** branch has no bookkeeping compute role or AWS bookkeeping environment variables; no production deploy was requested. The local `.env.local` uses the development cluster and the owner's temporary AWS CLI login. That login is an AWS root identity: AWS refuses to let root assume the restricted local IAM role. Therefore `BOOKKEEPING_DSQL_USERNAME=admin` is allowed by code only while `NODE_ENV=development`; the hosted Amplify app uses the restricted `bookkeeping_app` role by default. The unused local IAM role, DSQL mapping and profile attempted during setup were removed. A nonroot AWS console identity with a scoped role can replace this local-only arrangement later without long-lived access keys.

The bookkeeping page and the expense, export, package and receipt API routes use `lib/bookkeeping-store.ts` for DSQL/S3; platform-admin authentication and the `fieldlogichq@gmail.com` bookkeeping allowlist remain the access gate. The previous Supabase migration 354 was applied to the product **development** project before the AWS decision. Its table was empty at the last check and the new routes no longer use it. Do not apply migration 354 to product production. The release manifest marks it held. A later cleanup migration should remove the unused product-dev table and private bucket after confirming they remain empty; this must be coordinated with the shared database snapshot/dictionary workflow.

## Verification performed

- The official Node DSQL connector connected to the development cluster over verified TLS. A synthetic expense insert was rolled back and follow-up count was zero (`node --env-file=.env.local scripts/bookkeeping-dsql-smoke.mjs`).
- The S3 SDK resolved the local AWS login and reached the private development bucket. A synthetic receipt upload and download preserved bytes and MIME type; the exact test object version was removed (`node --env-file=.env.local scripts/bookkeeping-s3-smoke.mjs`). IAM simulation allowed the dev role to connect to its own cluster and read its own receipt prefix, and denied access to production resources. Production role DSQL access was allowed only for production.
- The dev server was restarted after the new shared module, dependencies and `.env.local` settings. Platform-admin login returned HTTP 200; signed-out bookkeeping expenses returned 403; no Supabase `EACCES` appeared in the dev log. Focused lint, TypeScript typecheck and expense unit cases passed.
- An owner-only accountant ZIP route now pairs the filtered revision CSV with every distinct original receipt and a document index containing SHA-256 hashes. The ZIP writer round-tripped through an independent unzip library. Browser download and owner access still require walkthrough.
- `scripts/bookkeeping-backup.mjs` writes an AES-256-GCM encrypted local archive of all DSQL revisions and referenced S3 receipts. `verify` checks the authentication tag, counts and receipt hashes before `restore-dev` can write. `scripts/bookkeeping-restore-drill.mjs` proved a synthetic revision, original timestamp and PDF bytes survive export, deletion and restoration in the empty development store, then removed its own test data. The empty-store restore path was also run. This is a manual backup path; no recurring backup schedule or production restore has been accepted.

## Manual encrypted backup

Set `BOOKKEEPING_BACKUP_PASSPHRASE` to a unique value of at least 16 characters in the current terminal session without placing the value in command history or a repository file. Store that value in an approved password manager; an archive cannot be restored without it. With the local AWS login active and `.env.local` pointed at the intended cluster, run:

```powershell
$secret = Read-Host 'Backup passphrase' -AsSecureString
$env:BOOKKEEPING_BACKUP_PASSPHRASE = (New-Object System.Net.NetworkCredential('', $secret)).Password
node --env-file=.env.local scripts/bookkeeping-backup.mjs create .bookkeeping-backups/expenses-YYYY-MM-DD.bkenc
node --env-file=.env.local scripts/bookkeeping-backup.mjs verify .bookkeeping-backups/expenses-YYYY-MM-DD.bkenc
Remove-Item Env:\BOOKKEEPING_BACKUP_PASSPHRASE
```

The `.bookkeeping-backups/` directory is ignored by Git. Copy the encrypted archive to a separate private location after verification; a file left only on this computer is not a durable backup. `restore-dev` accepts only a development archive and refuses to run unless both the development expense table and all S3 receipt versions and delete markers are empty. It inserts the original revisions and receipt bytes; a failed partial restore needs cleanup before retry. Production recovery requires a reviewed procedure and a separate restore test. AWS Backup is available for DSQL but would add a metered service [per AWS](https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-aurora.html); it has not been enabled.

## Before live use

1. Owner visually reviews the B0 screen designs and uses the local page to create/correct an expense and retrieve the original receipt. Verify another platform-admin role, a club admin and a signed-out user cannot read entries, files or exports. Browser and visual QA belong to the owner under `AGENCY_RULES.md`.
2. Decide a recurring backup cadence, separate copy location, passphrase custody and retention period before real bookkeeping use. The encrypted archive contains DSQL revisions and the current bytes of every referenced S3 receipt; historical S3 versions unrelated to a revision are outside this archive. Confirm production restore operations and evidence with the owner/accountant. S3 versioning alone is not a separate backup.
3. For the production release, add the production endpoint/bucket/region as **master branch** environment variables, attach `fieldlogichq-bookkeeping-prod-compute` to **master only**, and verify a production access/receipt smoke test. Do this with the release workflow, not by attaching the role to the whole Amplify app.

## Cost boundary

[Aurora DSQL pricing](https://aws.amazon.com/rds/aurora/dsql/pricing/) currently includes 100,000 DPUs and 1 GB of storage free each month, shared at the AWS payer/management-account level; idle clusters have no DPU charge. Both clusters consume from that same allowance. [S3](https://aws.amazon.com/s3/pricing/) stores receipts and versions on a metered basis, and AWS Backup would be an additional charge. The setup avoids a fixed database-project fee but is **not guaranteed to bill exactly zero**. No multi-Region replica or paid backup was enabled.

## Local sign-in (changed 2026-10-25)

The local app no longer uses the root `aws login`. IAM user `fieldlogichq-bookkeeping-dev-local` (inline policy = `scripts/bookkeeping-aws/dev-policy.json`, dev cluster and dev receipts only) is mapped to the restricted DSQL role `bookkeeping_app` and its key lives in the local AWS profile `bookkeeping-dev-local` (outside the repo). `.env.local` sets `AWS_PROFILE=bookkeeping-dev-local` and `BOOKKEEPING_DSQL_USERNAME=bookkeeping_app`, so the page never expires. Schema migrations, backup restores and other admin work still need root: run them as `AWS_PROFILE=fieldlogichq BOOKKEEPING_DSQL_USERNAME=admin node --env-file=.env.local <script>` after `aws login --profile fieldlogichq` (a shell value overrides `.env.local`). To rotate or revoke: create a new key for the IAM user and run `aws configure set` on the profile, then delete the old key.
