# Backups and restore: what production keeps, and the one rehearsal so far

Source: the owner's trust close-out paste-back, 2026-11-18 (`docs/projects/active/BOARD_READY_TRUST_CLOSE_CHECKLIST.html`, Parts B and C),
read off the host's dashboard for the PRODUCTION project. Anything the board pack, the Security page or the public roadmap says about
backups must rest on this page. Re-read the host's page before quoting a number from here after a plan change.

## What production keeps (read 2026-11-18)

- **Daily backups, kept 7 days.** The host's own page says "the last 7 days of daily backups". The list showed 8 rows (11 Nov 2026
  10:13:38 +0000 to 18 Nov 2026 10:13:50 +0000, physical backups), which is 7 full days plus today's. Quote **"daily backups, kept 7 days"**.
- **Kind:** physical. A row offers **Restore only, no Download**: there is no file the owner can take away.
- **A "Restore to a New Project" tab exists.** That is the only rehearsal route; the Restore button beside a row replaces the live
  database and is never used in a rehearsal.
- **Point in Time Recovery: off, as ruled** (owner 2026-11-16: daily is enough before a first customer).
- **A database backup holds NO uploaded files** (logos, rules files, player documents): the host's page says Storage objects are not
  included. Production had 7 file records on 2026-11-18; the restored copy had no files, as expected.

## Uploaded files: no backup, no undelete (host's pages read 2026-11-21)

- supabase.com/docs/guides/platform/backups: "Database backups do not include objects you store via the Storage API, as
  the database only includes metadata about these objects." and "Restoring an old backup does not restore objects you
  deleted after that backup."
- supabase.com/docs/guides/storage/s3/compatibility: "S3 versioning is not supported." and "Deleted objects are
  permanently removed and cannot be restored."
- supabase.com/security: "your Postgres database, Auth service, and Storage objects are hosted in that region" (ours:
  US East, Ohio).
- **Not stated anywhere on the host's pages:** durability, redundancy or replication of stored files. Never write
  "redundant", "several copies" or a durability figure about uploaded files unless the host's page says it.
- So: a deleted or replaced file is gone for good; a database restore brings back the file's RECORD, which then points at
  nothing if the file was deleted since. We keep no copy of our own. Approved wording: the board brief's "Uploaded files
  are not in those backups" bullet and Data Terms §8 (`docs/agents/legal/drafts/`).

## First restore rehearsal: PASSED 2026-11-18

| | Production | The copy |
|---|---|---|
| Clubs | 5 | 5 |
| Accounts | 18 | 18 |
| Newest account | 2026-10-15 10:39 | 2026-10-15 10:39 |
| File records | 7 | 7 (the files themselves: none) |

- Backup used: 18 Nov 2026 10:13:50 +0000 (physical). Started 10:22 a.m., finished 10:27 a.m.: **about 5 minutes** for this data size.
- Cost shown before starting: Additional Monthly Compute $9.68 a month (billed by the hour until the copy is deleted).
- The owner ticked all 16 steps, including switching the copy's scheduled jobs off, deleting its two Vault keys and deleting the copy.
  The summary he pasted back does not itemize those three; the 16/16 count is the record.
- "A restore has been rehearsed" is now true and may appear in the brief and Security page. The restore time is for THIS data size.

## The trap every rehearsal must handle

"Restore to a New Project" copies the scheduled jobs and the Vault keys and **starts the jobs at once**, so the copy calls the LIVE
site with a valid key (two jobs run every 5 and 15 minutes). The checklist's Part C unschedules the jobs and deletes the two keys by
hand. **Owner ruling 2026-11-18 (call 21): plan a small build, before the first live club, so the live site refuses a second caller
for the same job and minute.** Until it ships, the by-hand step stays and a rehearsal runs on a weekday after 9:00 a.m. Eastern.

**What the guard covers (built 2026-11-18; the owner chose the stronger option B over a once-a-minute cap).** Since migration 502 every
scheduled call carries a one-use receipt that the sending database writes for itself, and the live site runs a scheduled call only
after using up a receipt that the LIVE database holds. A restored copy writes its receipts into the copy, so:

- **Stopped:** every call a restored copy makes to the live site, in any minute and for as long as it runs. A leaked scheduler key on
  its own. The same call arriving twice.
- **Not stopped:** someone with the key AND write access to the live database (they already hold everything). Work the copy does
  inside itself (its own SQL-only jobs: metrics fold, retention sweeps, purges). Those touch only the copy, so they are harmless
  until the copy is deleted.
- **How a forgotten copy shows up:** refused calls open an error in the platform error log titled "A scheduled call was
  refused: was a restored copy of the database left running?", which emails once. Seeing it after a restore means Part C was
  skipped.
- **The by-hand Part C step STAYS.** The guard is the safety net, not the procedure. A copy with live jobs and keys is still a live
  key sitting in a second project, and it bills by the hour until deleted. "Weekday after 9:00 a.m." is no longer needed for
  the live site's sake once the guard is on production. Keep it anyway for the first rehearsal after it ships, and watch for the
  warning.
- Production order: migration 502 FIRST, then the code (code first would refuse every scheduled job until 502 lands).
