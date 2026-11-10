/**
 * Milton Bats demo — fresh "scan and you're signed in" QR codes for a PHONE (league admin + coach), so nobody
 * types credentials during the demo. Writes a local page and opens it; scan from the screen.
 *
 * Each run makes NEW sessions. One code = one phone: two phones scanning the same code share a session and can sign
 * each other out at its first refresh, so run this again for a second phone (or after a rehearsal scan).
 * The page is written outside the repo (it holds live sign-ins) and is overwritten on every run.
 *
 * ⚠ DEV ONLY (staging reads dev) — the refusal lives in makeSignInLinks.
 *
 * Usage: node --no-warnings --env-file=.env.local scripts/milton-phone-codes.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import { makeSignInLinks } from './milton-demo-signin.mjs';

const BASE = process.argv[2] || 'https://dev.fieldlogichq.ca';
const PEOPLE = [
  { key: 'admin', email: 'b2cowan+hladmin@gmail.com', next: '/milton-bats/admin/house-league',
    title: 'League admin', who: 'Kelly Barrett', job: 'Rain at 7 a.m. Saturday: open the 2027 season, go to Schedule, call off Saturday’s games.' },
  { key: 'coach', email: 'b2cowan+coach@gmail.com', next: '/discover',
    title: 'Coach', who: 'Ryan Delaney · U11', job: 'After the game: open the team and enter the score. It lands in the admin’s Scores to check.' },
];

let links;
try {
  links = await makeSignInLinks(BASE, PEOPLE.map(p => `${p.key}=${p.email}=${p.next}`));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

const now = new Date();
const made = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'a.m.' : 'p.m.'}`; // house clock style
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = [];
for (const p of PEOPLE) {
  const link = links[p.key];
  const qr = link
    ? await QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'L', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    : `<p class="miss">Could not make this code. Use the sign-in page and type the login instead.</p>`;
  cards.push(`<section class="card"><p class="who">${esc(p.title)} · ${esc(p.who)}</p><div class="qr">${qr}</div><p class="job">${esc(p.job)}</p></section>`);
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Milton phone sign-in</title><style>
:root{--brand:#47156c;--ink:#1f1a26;--muted:#625b6c;--bg:#f6f4f8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 "Segoe UI",system-ui,sans-serif;padding:24px 16px;min-height:100vh}
h1{margin:0 0 4px;font-size:1.6rem}.sub{margin:0 0 20px;color:var(--muted)}
.wrap{display:flex;flex-wrap:wrap;gap:24px;justify-content:center}
.card{background:#fff;border:1px solid #e2dde8;border-radius:16px;padding:20px;width:min(100%,560px);display:grid;gap:12px}
.who{margin:0;font-weight:600;color:var(--brand);text-transform:uppercase;letter-spacing:.08em;font-size:.85rem}
.qr svg{width:100%;height:auto;display:block;max-height:calc(100vh - 230px)}
.job{margin:0}.miss{color:#8a1c1c}
</style></head><body>
<h1>Scan and you're signed in</h1>
<p class="sub">Made at ${esc(made)}. One code per phone; for a second phone, double-click the shortcut again.</p>
<div class="wrap">${cards.join('')}</div>
</body></html>`;

const dir = join(process.env.LOCALAPPDATA || process.env.TMPDIR || '.', 'FieldLogicDemo');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'milton-phone-signin.html');
writeFileSync(file, html);
console.log(`Phone codes written: ${file}`);
for (const p of PEOPLE) console.log(`  ${p.key}: ${links[p.key] ? `ready (${links[p.key].length} characters)` : 'FAILED'}`);
if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', file], { detached: true, stdio: 'ignore' }).unref();
