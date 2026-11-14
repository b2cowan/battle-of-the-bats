/**
 * The prelim walks' own server: a local PRODUCTION build of the working tree on :3100, with the DEV env loaded
 * (the `/prewalk` agent, owner 2026-11-14). The owner's dev server on :3000 is never used for a prelim walk.
 *
 *   node scripts/prewalk-server.mjs status   is :3100 up, and was it built from the code as it stands?
 *   node scripts/prewalk-server.mjs build    next build --webpack (minutes; heavy — nothing else heavy beside it)
 *   node scripts/prewalk-server.mjs start    next start -p 3100 (stays in the foreground: run it in the background)
 *   node scripts/prewalk-server.mjs stop     stop the server this script started
 *
 * Three traps this exists to hold, each found the hard way:
 *  - A local production build reads `.env.production.local` (the PRODUCTION project) unless the dev env is loaded
 *    first; Next never overrides a variable already set. So: loadEnvConfig(ROOT, dev=true), then assert the dev project.
 *  - Built from a lower-case drive path (`c:\…`, Git Bash's `/c/…`) the build exits 0 and every page then fails on
 *    hydration. So: the root is upper-cased here, and a build log that says "differ in casing" fails the build.
 *  - `next dev` writes to `.next/dev`, so a build can run beside the dev server — but never delete `.next`.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_REF = 'npgnrxaitgbtbtvvykto';
const PORT = Number(process.env.PREWALK_PORT ?? 3100);
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = /^[a-z]:/.test(here) ? here[0].toUpperCase() + here.slice(1) : here;
const STATE = path.join(ROOT, '.probe', 'prewalk');
const STAMP = path.join(STATE, 'build-stamp.json');
const PID = path.join(STATE, 'server.pid');
const LOG = path.join(STATE, 'build.log');
// What a build is made of. A change here after the build means the server is behind the code.
const CODE_PATHS = ['app', 'components', 'lib', 'public', 'styles', 'proxy.ts', 'next.config.ts', 'next.config.mjs', 'package.json'];

const git = (args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

function loadDevEnv() {
  const require = createRequire(import.meta.url);
  require(path.join(ROOT, 'node_modules/@next/env')).loadEnvConfig(ROOT, true);
  let host = '';
  try { host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { /* not a URL */ }
  if (host !== `${DEV_REF}.supabase.co`) {
    console.error('✗ Not the dev project — refusing. A prelim walk never builds against production.');
    process.exit(1);
  }
}

/** Why the running build is behind the code, or null when it is current. */
function staleReason() {
  const stamp = readJson(STAMP);
  if (!stamp) return 'no build was made by this script (the server on this port, if any, is of unknown age)';
  const head = git(['rev-parse', 'HEAD']);
  if (head && stamp.head !== head) return `built from ${stamp.head.slice(0, 9)}, the code is now at ${head.slice(0, 9)}`;
  const builtAt = Date.parse(stamp.builtAt);
  const changed = git(['status', '--porcelain', '--', ...CODE_PATHS]).split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ''));
  const newer = changed.filter((f) => { try { return fs.statSync(path.join(ROOT, f)).mtimeMs > builtAt; } catch { return true; } });
  if (newer.length) return `${newer.length} file(s) changed since the build, e.g. ${newer.slice(0, 3).join(', ')}`;
  return null;
}

async function isUp() {
  try { return (await fetch(`http://localhost:${PORT}/auth/login`, { redirect: 'manual' })).status; } catch { return 0; }
}

function next(args) {
  return spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=6144' },
  });
}

const mode = process.argv[2];
fs.mkdirSync(STATE, { recursive: true });

if (mode === 'status') {
  const status = await isUp();
  const stale = staleReason();
  console.log(status ? `Server: up on :${PORT} (sign-in page answered ${status}).` : `Server: not running on :${PORT}.`);
  console.log(stale ? `Build: BEHIND the code — ${stale}.` : `Build: current (${readJson(STAMP).builtAt}).`);
  if (status >= 500) console.log('The server is answering with errors: stop it, rebuild, start again.');
  process.exit(status && status < 500 && !stale ? 0 : 2);
} else if (mode === 'build') {
  loadDevEnv();
  if (await isUp()) console.log(`Note: a server is running on :${PORT}. It keeps serving the OLD build until it is stopped and started again.`);
  const out = fs.createWriteStream(LOG);
  const startedAt = new Date().toISOString();
  const child = next(['build', '--webpack']);
  for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { out.write(d); process.stdout.write(d); });
  child.on('exit', (code) => {
    out.end(() => {
      const log = fs.readFileSync(LOG, 'utf8');
      if (code !== 0) { console.error(`\n✗ Build failed (exit ${code}). Log: ${LOG}`); process.exit(code ?? 1); }
      if (/differ in casing/i.test(log)) {
        console.error('\n✗ The build mixed upper- and lower-case paths ("differ in casing"). Every page would fail on hydration.');
        console.error("  Run it again from PowerShell: Set-Location 'C:\\Users\\...\\tournament-website' (upper-case drive), then this command.");
        process.exit(1);
      }
      fs.writeFileSync(STAMP, JSON.stringify({ head: git(['rev-parse', 'HEAD']), builtAt: startedAt, port: PORT }, null, 2));
      console.log(`\n✓ Built. Stamp: ${STAMP}`);
    });
  });
} else if (mode === 'start') {
  loadDevEnv();
  if (await isUp()) { console.error(`✗ Something is already answering on :${PORT}. Stop it first (this script's stop, or by its PID).`); process.exit(1); }
  const child = next(['start', '-p', String(PORT)]);
  fs.writeFileSync(PID, String(child.pid));
  for (const s of [child.stdout, child.stderr]) s.on('data', (d) => process.stdout.write(d));
  child.on('exit', (code) => { fs.rmSync(PID, { force: true }); process.exit(code ?? 0); });
} else if (mode === 'stop') {
  const pid = Number(fs.existsSync(PID) ? fs.readFileSync(PID, 'utf8') : 0);
  if (!pid) { console.log(`No server started by this script. If :${PORT} is in use, another session's server holds it — stop that one by its PID.`); process.exit(0); }
  try { process.kill(pid); console.log(`Stopped the server (PID ${pid}).`); } catch { console.log(`PID ${pid} was not running.`); }
  fs.rmSync(PID, { force: true });
} else {
  console.error('usage: node scripts/prewalk-server.mjs status | build | start | stop');
  process.exit(1);
}
