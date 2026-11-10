/**
 * prospect-demo-world.mjs — the PURE half of the prospect demo seed: dates, names, households, registrations, money plan,
 * ratings and the previous season, built from a club config (scripts/prospect-demo.milton.config.mjs) and a demo day.
 * No I/O, no database: `scripts/seed-prospect-demo.mjs` writes what this returns, and `--dry-run` prints it.
 *
 * Deterministic: the same config and demo day give the same children, households, dates and payers every run, so two
 * builds in a row produce identical counts.
 */

// ── dates ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dowOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
/** The first Saturday STRICTLY after `day`. */
export function saturdayAfter(day) { let d = addDays(day, 1); while (dowOf(d) !== 6) d = addDays(d, 1); return d; }
/** The first `dow` (0 = Sunday) on or after `day`. */
export function onOrAfter(day, dow) { let d = day; while (dowOf(d) !== dow) d = addDays(d, 1); return d; }
/** The club's wall clock (America/Toronto) as a UTC instant. */
export function torontoInstant(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const g = Object.fromEntries(parts.map(p => [p.type, p.value]));
    guess += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute);
  }
  return new Date(guess).toISOString();
}
export const minutesLater = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── names: ten family backgrounds, each with its own surnames, children's names and parents' names ──────────────
const GROUPS = [
  { // Anglo-Canadian
    last: ['Henderson', 'Mackenzie', 'Whitfield', 'Prescott', 'Gallagher', 'Thornton', 'Armstrong', 'Sutherland', 'Fitzgerald', 'Hargrove', 'Pearce', 'Lawson'],
    kids: ['Liam', 'Noah', 'Owen', 'Hudson', 'Theo', 'Jack', 'Emma', 'Olivia', 'Charlotte', 'Hazel', 'Nora', 'Piper', 'Ella', 'Maddox'],
    parents: ['Sarah', 'Jennifer', 'Mike', 'Dave', 'Kristen', 'Brad', 'Lindsay', 'Greg'] },
  { // Punjabi, Gujarati, Tamil
    last: ['Dhillon', 'Sandhu', 'Gill', 'Sharma', 'Patel', 'Chauhan', 'Mehta', 'Nair', 'Iyer', 'Bajwa', 'Grewal', 'Kapoor'],
    kids: ['Arjun', 'Rohan', 'Aanya', 'Priya', 'Kabir', 'Veer', 'Simran', 'Anaya', 'Ishaan', 'Zara', 'Dev', 'Meher'],
    parents: ['Harpreet', 'Navjot', 'Amit', 'Sunita', 'Rajesh', 'Anita', 'Gurpreet', 'Deepa'] },
  { // Scots-Irish and English
    last: ['Thompson', 'Murphy', 'Reid', 'Bennett', 'Foster', 'Hughes', 'Walsh', 'Stewart', 'Morrison', 'Duncan', 'Sinclair', 'Doyle'],
    kids: ['Ethan', 'Lucas', 'Mason', 'Logan', 'Finn', 'Declan', 'Avery', 'Riley', 'Quinn', 'Sadie', 'Maeve', 'Ruby', 'Cooper', 'Beckett'],
    parents: ['Megan', 'Chris', 'Amanda', 'Steve', 'Rachel', 'Dan', 'Kelly', 'Paul'] },
  { // Chinese, Korean, Japanese, Vietnamese
    last: ['Chen', 'Wong', 'Lin', 'Zhang', 'Kim', 'Park', 'Nguyen', 'Tran', 'Tanaka', 'Ito', 'Huang', 'Liu'],
    kids: ['Ethan', 'Lucas', 'Mia', 'Chloe', 'Kai', 'Jun', 'Hana', 'Mei', 'Leo', 'Ryan', 'Ava', 'Aiden'],
    parents: ['Wei', 'Jennifer', 'David', 'Minjung', 'Linh', 'Kenji', 'Susan', 'Tony'] },
  { // Portuguese, Italian, Spanish, Latin American
    last: ['Silva', 'Costa', 'Fernandes', 'Rossi', 'Russo', 'Moretti', 'Santos', 'Almeida', 'Ferreira', 'Marino', 'Rodrigues', 'Castillo'],
    kids: ['Mateo', 'Santiago', 'Sofia', 'Isabella', 'Gabriel', 'Luca', 'Bella', 'Diego', 'Valentina', 'Marco', 'Camila', 'Nico'],
    parents: ['Carlos', 'Ana', 'Paulo', 'Maria', 'Tony', 'Gina', 'Joao', 'Elena'] },
  { // French-Canadian
    last: ['Tremblay', 'Gagnon', 'Roy', 'Bouchard', 'Gauthier', 'Lavoie', 'Pelletier', 'Fortin', 'Bergeron', 'Cote', 'Leblanc', 'Morin'],
    kids: ['Louis', 'Emile', 'Juliette', 'Felix', 'Thomas', 'Camille', 'Alexis', 'Zoe', 'Antoine', 'Lea', 'Raphael', 'Charlotte'],
    parents: ['Julie', 'Sylvain', 'Isabelle', 'Marc', 'Genevieve', 'Pascal', 'Nathalie', 'Eric'] },
  { // Black Canadian, Caribbean, African
    last: ['Okafor', 'Mensah', 'Campbell', 'Brown', 'Williams', 'Adeyemi', 'Osei', 'Baptiste', 'Richards', 'Francis', 'Nwosu', 'Clarke'],
    kids: ['Jayden', 'Amara', 'Zion', 'Nia', 'Malik', 'Kofi', 'Imani', 'Jordan', 'Aaliyah', 'Elijah', 'Tobias', 'Zuri'],
    parents: ['Kwame', 'Tanya', 'Marcus', 'Adaeze', 'Denise', 'Andre', 'Folake', 'Jerome'] },
  { // Eastern European
    last: ['Kowalski', 'Novak', 'Petrov', 'Horvat', 'Nowak', 'Ivanov', 'Kovacs', 'Popescu', 'Volkov', 'Jankowski', 'Nemeth', 'Bondar'],
    kids: ['Max', 'Anna', 'Nikolai', 'Sasha', 'Lena', 'Viktor', 'Mila', 'Tomas', 'Eva', 'Oskar', 'Zofia', 'Adam'],
    parents: ['Katarzyna', 'Piotr', 'Marta', 'Andrei', 'Olga', 'Dmitri', 'Ewa', 'Tomasz'] },
  { // Middle Eastern, South-West Asian
    last: ['Haddad', 'Khalil', 'Rahman', 'Siddiqui', 'Yilmaz', 'Farouk', 'Nasser', 'Hamdan', 'Qureshi', 'Aziz', 'Sabbagh', 'Karimi'],
    kids: ['Omar', 'Yusuf', 'Layla', 'Noor', 'Zayn', 'Amina', 'Ibrahim', 'Sara', 'Idris', 'Maryam', 'Leena', 'Adam'],
    parents: ['Samir', 'Fatima', 'Hassan', 'Rania', 'Imran', 'Nadia', 'Tariq', 'Hiba'] },
  { // Filipino
    last: ['Reyes', 'Bautista', 'Aquino', 'Villanueva', 'Mendoza', 'Ramos', 'Navarro', 'Cabrera', 'Pascual', 'Domingo', 'Soriano', 'Garcia'],
    kids: ['Jacob', 'Angelo', 'Bianca', 'Mika', 'Miguel', 'Nathan', 'Trisha', 'Paolo', 'Andrea', 'Lance', 'Kyla', 'Isaiah'],
    parents: ['Maricel', 'Jun', 'Rowena', 'Ramil', 'Grace', 'Rey', 'Joy', 'Ben'] },
];
const GROUP_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const POS = [null, null, null, null, 'Pitcher', 'Catcher', 'Infield', 'Outfield', 'Shortstop', 'First base', 'Anywhere'];
const NOTES = ['Asthma. Inhaler stays in the bag.', 'Wants to play with a friend from school.', 'First year playing.', 'Played T-ball last summer.',
  'Peanut allergy (EpiPen in the bag).', 'Left-handed.', 'Can only make Saturdays until school lets out.', 'Wears glasses. Please keep the sun out of the outfield.',
  'Played rep last year, wants a house league season.', 'Shy at first. Friendly coach, please.', 'Has a cast off in two weeks.'];
const ADMIN_NOTES = ['Mom phoned. Will pay at registration night.', 'Family new to Milton.', 'Asked about a payment plan. Told to pay half now.',
  'Cousin of a U11 player.', 'Registered by phone.'];

const pad2 = (n) => String(n).padStart(2, '0');
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Everything a house-league build writes, as plain rows with ids the builder invents (`key`). Returns:
 *   regs      one entry per registration of the live season
 *   previous  the finished season's registrations (some are the same children, by `returningKey`)
 */
export function buildWorld(cfg, demoDay) {
  const rng = mulberry32(cfg.seed);
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pickR = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const at = (day, h = rint(13, 23), m = rint(0, 59)) => `${day}T${pad2(h % 24)}:${pad2(m)}:00Z`;
  const phone = () => `${pickR(['905', '905', '289', '365'])}-555-01${pad2(rint(0, 99))}`;
  const byCode = Object.fromEntries(cfg.divisions.map(d => [d.code, d]));

  // ── one pool of child slots per division, with the status each carries ──
  const pool = {};
  for (const d of cfg.divisions) {
    const slots = [];
    // 'ended' children are accepted ones that the build withdraws later (the money writer sends their fee back).
    for (const [status, n] of Object.entries(d.mix)) for (let i = 0; i < n; i++) slots.push({ div: d.code, status: status === 'ended' ? 'active' : status });
    // U13's full roll keeps its order of arrival (accepted first); the others are mixed so To review is not a block.
    pool[d.code] = d.code === 'U13' ? slots : shuffle(slots);
  }
  const take = (div, pred = (s) => s.status === 'active') => {
    const i = pool[div].findIndex(pred);
    return i < 0 ? null : pool[div].splice(i, 1)[0];
  };

  // ── households ──
  const surnames = GROUPS.map(g => shuffle(g.last));
  let groupCursor = 0;
  const households = [];
  const dobIn = (year) => `${year}-${pad2(rint(1, 12))}-${pad2(rint(1, 28))}`;
  const usedKid = new Set();
  function newHousehold(parentSpec) {
    if (parentSpec) return { surname: parentSpec.last, group: GROUPS[0], guardian: { first: parentSpec.first, last: parentSpec.last, email: parentSpec.email, phone: phone() }, kids: [] };
    const gi = GROUP_ORDER[groupCursor++ % GROUP_ORDER.length];
    const g = GROUPS[gi];
    const last = surnames[gi].shift() ?? `${pickR(g.last)}-${pickR(g.last)}`;
    const first = pickR(g.parents);
    const email = `${ascii(first)}.${ascii(last)}`.toLowerCase().replace(/[^a-z.]/g, '') + '@miltonfamilies.local';
    return { surname: last, group: g, guardian: { first, last, email, phone: phone() }, kids: [] };
  }
  function addKid(h, slot, { dob, first } = {}) {
    const div = byCode[slot.div];
    let name = first;
    if (!name) { do { name = pickR(h.group.kids); } while (h.kids.some(k => k.first === name) || usedKid.has(`${name} ${h.surname}`)); }
    usedKid.add(`${name} ${h.surname}`);
    h.kids.push({ ...slot, first: name, last: h.surname, dob: dob ?? dobIn(rint(div.from, div.to)) });
  }

  for (const tpl of cfg.siblings) {
    const flags = typeof tpl[tpl.length - 1] === 'object' ? tpl[tpl.length - 1] : {};
    const divs = tpl.filter(t => typeof t === 'string');
    const slots = divs.map(code => take(code));
    if (slots.some(s => !s)) continue; // a division with no more accepted slots simply gets fewer sibling households
    const h = newHousehold(flags.parent ? cfg.people.parent : null);
    if (flags.parent) {
      addKid(h, slots[0], { first: 'Ella', dob: '2018-04-17' });
      addKid(h, slots[1], { first: 'Owen', dob: '2016-09-03' });
    } else if (flags.twins) {
      const d = byCode[slots[0].div];
      const dob = dobIn(rint(d.from, d.to));
      slots.forEach(s => addKid(h, s, { dob }));
    } else if (divs.length === 2 && divs[0] === divs[1]) {
      const d = byCode[divs[0]];
      addKid(h, slots[0], { dob: dobIn(d.from) });
      addKid(h, slots[1], { dob: dobIn(d.to) });
    } else slots.forEach(s => addKid(h, s));
    households.push(h);
  }
  // Everyone left is a household of one.
  for (const d of cfg.divisions) {
    while (pool[d.code].length) { const h = newHousehold(null); addKid(h, pool[d.code].shift()); households.push(h); }
  }

  // ── registrations ──
  const win = { U7: [-58, -3], U9: [-55, -1], U11: [-58, -47], U13: [-58, -8], U15: [-58, -47] };
  const regs = [];
  let n = 0;
  for (const h of households) for (const k of h.kids) {
    const d = byCode[k.div];
    const source = rng() < 0.86 ? 'public_form' : 'admin_manual';
    const [lo, hi] = k.status === 'pending' ? [-6, -1] : k.status === 'waitlisted' ? [-30, -3] : (win[k.div] ?? [-55, -2]);
    const regDay = addDays(demoDay, rint(lo, hi));
    const registeredAt = at(regDay);
    regs.push({
      key: `r${++n}`, div: k.div, status: k.status, first: k.first, last: k.last, dob: k.dob,
      pos: pickR(POS), notes: rng() < 0.15 ? pickR(NOTES) : null, adminNotes: rng() < 0.05 ? pickR(ADMIN_NOTES) : null,
      source, registeredAt, acceptedAt: null,
      fee: source === 'public_form' ? d.early : d.price,
      guardian: h.guardian, household: h.guardian.email, pay: null, rating: null, special: null, waitPos: null,
    });
  }
  regs.sort((a, b) => a.div.localeCompare(b.div) || a.registeredAt.localeCompare(b.registeredAt));
  // The waitlist keeps its order of arrival; the live-season U13 roll was accepted as it came.
  for (const d of cfg.divisions) regs.filter(r => r.div === d.code && r.status === 'waitlisted').forEach((r, i) => { r.waitPos = i + 1; });
  // A parent's household must read as the parent's even when the seeded status landed on a waitlist or a review: the
  // +parent children are plain accepted (the slot above took 'active').

  // accepted day: a day or two after sign-up (a pending / waitlisted child has none)
  for (const r of regs) {
    if (r.status === 'active') {
      const accepted = addDays(r.registeredAt.slice(0, 10), rint(0, 2));
      // never later than yesterday: an acceptance "tomorrow" ages as negative days in Still owing
      r.acceptedAt = at(accepted > addDays(demoDay, -1) ? addDays(demoDay, -1) : accepted, rint(13, 23));
    }
  }

  // ── money: who has paid, when, how, and the odd ones out (all through the real money writer) ──
  for (const d of cfg.divisions) {
    const actives = regs.filter(r => r.div === d.code && r.status === 'active');
    const order = shuffle(actives);
    const paid = order.slice(0, d.paid);
    const owing = order.slice(d.paid);
    for (const r of paid) {
      const payDay = addDays(r.acceptedAt.slice(0, 10), rint(0, 4));
      r.pay = { day: payDay > addDays(demoDay, 0) ? demoDay : payDay, method: pickR(['etransfer', 'etransfer', 'etransfer', 'cash', 'cheque']), actor: rng() < 0.7 ? 'admin' : 'owner' };
    }
    if (d.code === 'U13') {
      // Owing children of different ages (days since accepted), so Still owing shows amber and not.
      const ages = [2, 5, 8, 11, 14, 17, 23, 29, 36, 44];
      owing.forEach((r, i) => {
        const age = ages[i % ages.length];
        r.acceptedAt = at(addDays(demoDay, -age), rint(13, 22));
        r.registeredAt = at(addDays(demoDay, -age - 1), rint(13, 22));
      });
      // One corrected price (paid, then lowered with a reason: the difference goes back as a refund line), one voided line.
      const [fixed, voided] = paid;
      fixed.source = 'admin_manual'; fixed.fee = d.price;
      fixed.special = { correctTo: d.early, reason: 'Early-bird price honoured: signed up by phone before the cut-off.' };
      voided.special = { voided: true };
    }
  }
  const u13 = byCode.U13;
  if (u13?.mix.ended) {
    const candidates = regs.filter(r => r.div === 'U13' && r.status === 'active' && !r.pay && !r.special);
    // Take the ended child from the owing group's oldest: she paid and then withdrew.
    const ended = candidates[candidates.length - 1];
    ended.special = { ended: true, money: 'refunded', moneyReason: 'Moved out of town.' };
    ended.pay = { day: addDays(ended.acceptedAt.slice(0, 10), 1), method: 'etransfer', actor: 'admin' };
  }

  // ── ratings: U9 about three quarters done; U11 and U15 (drafted) all rated ──
  const weights = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5];
  for (const r of regs) {
    if (r.status !== 'active') continue;
    if (r.div === 'U11' || r.div === 'U15') r.rating = pickR(weights);
    else if (r.div === 'U9') r.rating = rng() < 0.76 ? pickR(weights) : null;
  }
  // Sibling pairs in U9 are rated differently (the point of the walk).
  for (const h of households) {
    const kids = regs.filter(r => r.household === h.guardian.email && r.div === 'U9' && r.status === 'active');
    if (kids.length >= 2) {
      kids[0].rating = kids[0].rating ?? 4;
      kids[1].rating = kids[0].rating >= 3 ? kids[0].rating - 2 : kids[0].rating + 2;
    }
  }

  // ── the finished previous season ──
  const prev = cfg.previous;
  const prevDivs = prev.divisions.map(d => ({ ...d }));
  const previous = [];
  const returning = {};
  for (const d of prevDivs) {
    const want = prev.returning[d.code] ?? 0;
    const cands = shuffle(regs.filter(r => r.status === 'active' && !returning[r.key]
      && Number(r.dob.slice(0, 4)) >= d.from && Number(r.dob.slice(0, 4)) <= d.to));
    const chosen = cands.slice(0, want);
    chosen.forEach(r => { returning[r.key] = d.code; });
    let teamIdx = 0;
    for (const r of chosen) {
      previous.push({ key: `p${previous.length + 1}`, div: d.code, first: r.first, last: r.last, dob: r.dob, guardian: r.guardian, returningKey: r.key, team: teamIdx++ % d.teams.length });
    }
    while (previous.filter(p => p.div === d.code).length < d.kids) {
      const h = newHousehold(null);
      const code = d.code;
      let name; do { name = pickR(h.group.kids); } while (usedKid.has(`${name} ${h.surname}`));
      usedKid.add(`${name} ${h.surname}`);
      previous.push({ key: `p${previous.length + 1}`, div: code, first: name, last: h.surname, dob: dobIn(rint(d.from, d.to)), guardian: h.guardian, returningKey: null, team: teamIdx++ % d.teams.length });
    }
  }
  for (const p of previous) {
    p.registeredAt = at(addDays(demoDay, rint(-400, -362)));
    p.fee = prevDivs.find(d => d.code === p.div).price;
    p.pay = { day: addDays(p.registeredAt.slice(0, 10), rint(1, 6)), method: pickR(['etransfer', 'etransfer', 'cash', 'cheque']), actor: 'admin' };
  }
  return { regs, households, previous, prevDivs };
}

/** Team index of each accepted child, by a snake draft on rating (unrated and tied children are spread evenly). */
export function snakeDraft(regs, teamCount) {
  const sorted = [...regs].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.registeredAt.localeCompare(b.registeredAt));
  const out = new Map();
  sorted.forEach((r, i) => {
    const row = Math.floor(i / teamCount);
    const col = i % teamCount;
    out.set(r.key, row % 2 === 0 ? col : teamCount - 1 - col);
  });
  return out;
}

/** A tally by division and status, for the dry run and the report. */
export function tally(world, cfg) {
  const rows = [];
  for (const d of cfg.divisions) {
    const mine = world.regs.filter(r => r.div === d.code);
    const c = (s) => mine.filter(r => r.status === s).length;
    rows.push({ division: d.code, total: mine.length, accepted: c('active'), toReview: c('pending'), waitlisted: c('waitlisted'),
      withMoney: mine.filter(r => r.pay).length, rated: mine.filter(r => r.rating).length });
  }
  return rows;
}
