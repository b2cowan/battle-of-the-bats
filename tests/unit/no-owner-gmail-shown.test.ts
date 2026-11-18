import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Owner ruling 2026-11-18: nothing a customer sees, opens or replies to shows the owner's own Gmail. Every address a person
 * reads is support@fieldlogichq.ca (`lib/fieldlogichq-contact.ts`). The Gmail stays only where mail is sent TO the owner.
 *
 * The allowed files are the decision point: adding one fails here until the list is edited, with a reason.
 */
const OWNER_GMAIL = 'fieldlogichq@gmail.com';

const ALLOWED: Record<string, string> = {
  'lib/email.ts': 'ADMIN_EMAIL — alerts sent TO the owner; never used as a shown or reply-to address',
  'app/api/admin/org/request-deletion/route.ts': 'the deletion request is sent TO the owner',
  'lib/bookkeeping-access.ts': "the owner's own sign-in for platform Bookkeeping",
};

const ROOT = process.cwd();
const SCANNED = ['app', 'components', 'lib', 'public'];
const EXT = /\.(tsx?|mjs|js|json|md|html|txt)$/;

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
}

describe("the owner's Gmail is never shown to a customer", () => {
  const files: string[] = [];
  for (const top of SCANNED) walk(join(ROOT, top), files);

  it('appears only in the allowed files', () => {
    const found = files
      .filter(f => readFileSync(f, 'utf8').includes(OWNER_GMAIL))
      .map(f => relative(ROOT, f).split(sep).join('/'));
    const unexpected = found.filter(f => !(f in ALLOWED));
    assert.deepEqual(unexpected, [], `Use FIELDLOGICHQ_CONTACT_EMAIL instead of ${OWNER_GMAIL} in: ${unexpected.join(', ')}`);
  });

  it('ADMIN_EMAIL is never a shown contact or a reply-to', () => {
    const bad = files.filter(f => {
      // A server log line (console.*) is read by the owner only, never a customer.
      const code = readFileSync(f, 'utf8').split('\n').filter(l => !/console\.(log|info|warn|error)\(/.test(l)).join('\n');
      return /\?\?\s*ADMIN_EMAIL\b/.test(code)
        || /(replyTo|repliesGoTo|contactEmail|contact):\s*ADMIN_EMAIL\b/.test(code)
        || /\$\{ADMIN_EMAIL\}/.test(code)
        || /\{ADMIN_EMAIL\}/.test(code);
    }).map(f => relative(ROOT, f).split(sep).join('/'));
    assert.deepEqual(bad, [], `A "?? ADMIN_EMAIL" fallback or an ADMIN_EMAIL reply-to shows the owner's Gmail: ${bad.join(', ')}`);
  });
});
