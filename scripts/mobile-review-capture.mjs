/**
 * Mobile review capture harness — public tournament pages.
 * Built for the Tournament Mobile Polish review (docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md);
 * re-run it to verify fixes with the same numbers the findings cite.
 *
 * For each target: screenshots (top / scrolled / full) + a computed-style metrics JSON
 * (fonts, rects, sticky chrome + computed backdrop-filter, median row pitch, sub-44px
 * tap targets, horizontal-overflow offenders). Never diagnose from screenshots alone.
 *
 * Usage:
 *   node --env-file=.env.local scripts/mobile-review-capture.mjs [outDir]
 *   node --env-file=.env.local scripts/mobile-review-capture.mjs --go-live   # refresh live state only
 *
 * Prereqs: dev server on :3000 (network access), live-demo seeded (scripts/seed-live-tournament.mjs).
 * --go-live puts the two semifinals in their live window RIGHT NOW (submitted, 5-3 / 2-2,
 * started 30 min ago) and pushes the final 3 h out — run it before capturing so LIVE states
 * render; the seed script alone leaves playoff games unstarted.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const ORG = 'dev-test-org';
const goLiveOnly = process.argv.includes('--go-live');
const OUT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'mobile-review-shots');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function lookupSeed() {
  const { data: org } = await db.from('organizations').select('id').eq('slug', ORG).single();
  if (!org) throw new Error(`org ${ORG} not found — is this the dev DB?`);
  const { data: t } = await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'live-demo').single();
  if (!t) throw new Error('live-demo tournament not found — run scripts/seed-live-tournament.mjs first');
  const { data: team } = await db.from('teams').select('id,name,division_id')
    .eq('tournament_id', t.id).ilike('name', 'Halton%').limit(1).single();
  const { data: sf1 } = await db.from('games').select('id').eq('tournament_id', t.id).eq('bracket_code', 'SF1').single();
  return { tournamentId: t.id, team, sf1GameId: sf1?.id ?? null };
}

async function goLive(tournamentId) {
  const now = new Date();
  const hh = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  const liveStart = hh(new Date(now.getTime() - 30 * 60000));
  const finStart = hh(new Date(now.getTime() + 3 * 3600000));
  const nowISO = now.toISOString();
  for (const [code, time, hs, as_] of [['SF1', liveStart, 5, 3], ['SF2', liveStart, 2, 2]]) {
    const { error } = await db.from('games')
      .update({ game_time: time, status: 'submitted', home_score: hs, away_score: as_, score_submission_source: 'admin_results', score_submitted_at: nowISO })
      .eq('tournament_id', tournamentId).eq('bracket_code', code);
    console.log(`${code} → live @ ${time} ${hs}-${as_}`, error ? `ERR ${error.message}` : 'ok');
  }
  const { error } = await db.from('games').update({ game_time: finStart, status: 'scheduled', home_score: null, away_score: null })
    .eq('tournament_id', tournamentId).eq('bracket_code', 'FIN');
  console.log(`FIN → upcoming @ ${finStart}`, error ? `ERR ${error.message}` : 'ok');
}

function buildTargets({ team, sf1GameId }) {
  const LD = `/${ORG}/live-demo`;
  return [
    // A. live-demo, 390x844, dark, anonymous
    { name: 'ld-home-390', url: `${LD}` },
    { name: 'ld-news-390', url: `${LD}/news` },
    { name: 'ld-schedule-390', url: `${LD}/schedule` },
    { name: 'ld-standings-390', url: `${LD}/standings` },
    { name: 'ld-bracket-390', url: `${LD}/playoffs` },
    { name: 'ld-teams-390', url: `${LD}/teams` },
    { name: 'ld-teamdetail-390', url: `${LD}/teams/${team.id}` },
    ...(sf1GameId ? [{ name: 'ld-gamedetail-390', url: `${LD}/schedule/${sf1GameId}` }] : []),
    // B. followed-team state (My Team dock/card, ticker precedence, ★ rows)
    { name: 'ld-home-390-follow', url: `${LD}`, follow: true },
    { name: 'ld-schedule-390-follow', url: `${LD}/schedule`, follow: true },
    { name: 'ld-standings-390-follow', url: `${LD}/standings`, follow: true },
    { name: 'ld-teamdetail-390-follow', url: `${LD}/teams/${team.id}`, follow: true },
    // C. narrow spot-check
    { name: 'ld-schedule-360', url: `${LD}/schedule`, viewport: { width: 360, height: 800 } },
    { name: 'ld-standings-360', url: `${LD}/standings`, viewport: { width: 360, height: 800 } },
    { name: 'ld-bracket-360', url: `${LD}/playoffs`, viewport: { width: 360, height: 800 } },
    // D. alt org theme (Battle-Purple preset, dark) + E. light mode (crimson preset)
    { name: 'bd-home-390', url: `/${ORG}/branded-dark` },
    { name: 'bd-schedule-390', url: `/${ORG}/branded-dark/schedule` },
    { name: 'bl-home-390', url: `/${ORG}/branded-light` },
    { name: 'bl-schedule-390', url: `/${ORG}/branded-light/schedule` },
    { name: 'bl-standings-390', url: `/${ORG}/branded-light/standings` },
    // F. completed event
    { name: 'cd-home-390', url: `/${ORG}/completed-demo` },
  ];
}

function probeScript() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const doc = document.scrollingElement;
  const out = {
    path: location.pathname, vw, vh,
    scrollW: doc.scrollWidth, scrollH: doc.scrollHeight,
    overflowX: doc.scrollWidth > vw + 1,
  };
  const clsOf = (el) => (typeof el.className === 'string' ? el.className : '').trim();

  out.wideElements = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.right > vw + 2 || r.left < -2)) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue;
      out.wideElements.push({
        tag: el.tagName, cls: clsOf(el).slice(0, 90),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        overX: cs.overflowX, text: (el.textContent || '').trim().slice(0, 40),
      });
      if (out.wideElements.length >= 25) break;
    }
  }

  out.chrome = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width < vw * 0.5) continue;
    out.chrome.push({
      tag: el.tagName, cls: clsOf(el).slice(0, 110),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor,
      backdrop: cs.backdropFilter || 'none',
    });
  }

  out.navLinks = [];
  for (const a of document.querySelectorAll('nav a, [class*="tabs"] a, [class*="Tab"] a')) {
    const r = a.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(a);
    out.navLinks.push({
      text: (a.textContent || '').trim().slice(0, 24),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      font: cs.fontFamily.split(',')[0], size: cs.fontSize, weight: cs.fontWeight,
      tt: cs.textTransform, ls: cs.letterSpacing, color: cs.color,
    });
    if (out.navLinks.length >= 30) break;
  }

  const groups = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    const el = node;
    const cls = clsOf(el);
    if (!cls) continue;
    const hasText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
    const cs0 = getComputedStyle(el);
    const isRowish = cs0.display === 'flex' || cs0.display === 'grid';
    if (!hasText && !isRowish) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const sig = el.tagName + '|' + cls.split(' ').slice(0, 2).join(' ');
    if (!groups.has(sig)) {
      groups.set(sig, {
        sig: sig.slice(0, 110), count: 0, rects: [],
        text: (el.textContent || '').trim().slice(0, 48),
        font: cs0.fontFamily.split(',')[0], size: cs0.fontSize, weight: cs0.fontWeight,
        ls: cs0.letterSpacing, tt: cs0.textTransform, fvn: cs0.fontVariantNumeric,
        color: cs0.color, bg: cs0.backgroundColor, ta: cs0.textAlign, lh: cs0.lineHeight,
        pad: cs0.padding, br: cs0.borderRadius, bb: cs0.borderBottom,
      });
    }
    const g = groups.get(sig);
    g.count++;
    if (g.rects.length < 60) g.rects.push([Math.round(r.y + window.scrollY), Math.round(r.height)]);
  }
  out.classDigest = [];
  for (const g of groups.values()) {
    const heights = g.rects.map((x) => x[1]);
    const ys = g.rects.map((x) => x[0]).sort((a, b) => a - b);
    let gap = null;
    if (ys.length >= 3) {
      const deltas = [];
      for (let i = 1; i < ys.length; i++) deltas.push(ys[i] - ys[i - 1]);
      deltas.sort((a, b) => a - b);
      gap = deltas[Math.floor(deltas.length / 2)];
    }
    out.classDigest.push({
      sig: g.sig, count: g.count, text: g.text,
      font: g.font, size: g.size, weight: g.weight, ls: g.ls, tt: g.tt, fvn: g.fvn,
      color: g.color, bg: g.bg, ta: g.ta, lh: g.lh, pad: g.pad, br: g.br, bb: g.bb,
      hMin: Math.min(...heights), hMax: Math.max(...heights),
      hAvg: Math.round(heights.reduce((a, b) => a + b, 0) / heights.length),
      pitch: gap, firstY: ys[0],
    });
    delete g.rects;
  }

  out.smallTargets = [];
  for (const el of document.querySelectorAll('a,button,[role="button"],input,select')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)) {
      out.smallTargets.push({
        tag: el.tagName, cls: clsOf(el).slice(0, 60),
        text: ((el.textContent || '').trim() || el.getAttribute('aria-label') || '').slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height),
      });
      if (out.smallTargets.length >= 50) break;
    }
  }
  return out;
}

function stickyProbe() {
  const vw = window.innerWidth;
  const bars = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width < vw * 0.5) continue;
    bars.push({
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      pos: cs.position, backdrop: cs.backdropFilter || 'none', bg: cs.backgroundColor,
    });
  }
  const vh = window.innerHeight;
  let topEdge = 0, botEdge = vh;
  for (const b of bars) {
    if (b.top <= 1 && b.bottom > topEdge && b.bottom < vh * 0.6) topEdge = b.bottom;
    if (b.bottom >= vh - 1 && b.top < botEdge && b.top > vh * 0.4) botEdge = b.top;
  }
  return { scrollY: window.scrollY, bars, contentWindow: botEdge - topEdge, viewportH: vh };
}

const seed = await lookupSeed();
await goLive(seed.tournamentId);
if (goLiveOnly) process.exit(0);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
for (const t of buildTargets(seed)) {
  const vp = t.viewport || { width: 390, height: 844 };
  const context = await browser.newContext({
    viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  if (t.follow) {
    await context.addInitScript(
      ([key, val]) => localStorage.setItem(key, val),
      [`fl_follow_team_${ORG}_live-demo`, JSON.stringify({ id: seed.team.id, name: seed.team.name, divisionId: seed.team.division_id })],
    );
  }
  const page = await context.newPage();
  try {
    await page.goto(BASE + t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.body.innerText.length > 400, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(OUT, `${t.name}_top.png`) });
    const metrics = await page.evaluate(probeScript);
    await page.evaluate(() => window.scrollTo(0, 520));
    await page.waitForTimeout(700);
    metrics.scrolled = await page.evaluate(stickyProbe);
    await page.screenshot({ path: path.join(OUT, `${t.name}_scrolled.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${t.name}_full.png`), fullPage: true });
    fs.writeFileSync(path.join(OUT, `${t.name}.json`), JSON.stringify(metrics, null, 1));
    results[t.name] = { ok: true, overflowX: metrics.overflowX, scrollH: metrics.scrollH, smallTargets: metrics.smallTargets.length };
    console.log(`OK   ${t.name}  (scrollH=${metrics.scrollH}, sub-44 targets=${metrics.smallTargets.length}${metrics.overflowX ? '  ⚠ OVERFLOW-X' : ''})`);
  } catch (e) {
    results[t.name] = { ok: false, err: String(e).slice(0, 200) };
    console.log(`FAIL ${t.name}: ${String(e).slice(0, 160)}`);
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(results, null, 1));
console.log(`\nDone → ${OUT}`);
