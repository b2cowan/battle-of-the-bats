/**
 * THE SEVEN DRAWINGS — the only pictures in the pitch library we author ourselves.
 *
 * Plan: docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md (P2b) · approved in the owner mockup
 * round 2026-08-21: https://claude.ai/code/artifact/a4029d16-43ac-41cc-97cb-1d70e36afdcd
 *
 * ── WHY THESE EXIST AT ALL ────────────────────────────────────────────────────
 * Every other slide in the library photographs the product, so it inherits the product's look
 * for free. These decide what we look like when we are NOT showing software. Treat them as ONE
 * house style with seven instances, never as seven drawings — the moment one is redrawn "a bit
 * nicer" than the others the deck reads as assembled from parts.
 *
 * ── THE PICTURE RULE (owner ruling 2026-08-21 — REPLACES the 2026-08-20 one) ──
 * The old rule banned drawing anything that resembles our interface. That aimed at SUBJECT, and
 * it would have banned drawing a ledger at all — even though a ledger drawing is the clearest
 * way to say what a ledger does. The obligation that actually exists is:
 *
 *   ⚠ DOES THE PICTURE PROMISE FUNCTIONALITY WE HAVE? Pixel fidelity never was the promise. We
 *     do not owe a prospect a screen that looks identical to the drawing; we owe them one that
 *     WORKS the way the drawing says.
 *
 * The one piece kept from the old rule, restated: not "never draw a screen" but ⚠ **NEVER LET
 * THE READER BE UNCERTAIN WHICH THEY ARE LOOKING AT.** A drawing that is obviously a drawing may
 * depict anything we do. What breaks is a photorealistic fake screen — because then a reader
 * cannot tell what is real anywhere, and the claim worth protecting is "this is genuinely our
 * software, and the demo is running right now, go walk it".
 *
 * So: draw whatever serves the pitch, as long as it is unmistakably a drawing, and keep a real
 * capture where "this is really ours" is the point being made.
 *
 * ── THE HOUSE STYLE, WHICH IS SIX RULES ──────────────────────────────────────
 *  1. LEFT IS THE MESS, RIGHT IS THE ANSWER. No slide inverts it for variety. (The two cycle
 *     slides are the deliberate exception — a wheel has no left and right — and they pay for it
 *     with the same ink grammar instead.)
 *  2. The mess is faint and tilted; the answer is ink and straight. BRIGHTNESS carries the
 *     argument, so the drawings survive print, greyscale and a bad projector.
 *  3. ⚠ TWO WORDS EACH SIDE. Everything else is texture. See the label note in the stylesheet:
 *     at phone width a drawing gets to say "THREE PLACES → ONE SETTLED LINE" and nothing more.
 *  4. Amber appears in the OLD-WAY half only, once, on the exact thing that hurts.
 *  5. ⚠ THE ANSWER IS DRAWN IN THE SAME HAND AS THE MESS — same stroke, same slight tilt, same
 *     sketch. This is the strongest anti-fake safeguard in the set, and it is subtler than a list
 *     of banned shapes: the moment the right half looks CRISPER than the left, it starts claiming
 *     to be a screenshot. No window chrome, no navigation, no tabs, no labelled buttons, no table
 *     header rows.
 *  6. Three objects on the left at most, one on the right. More is two slides.
 *
 * ── WHY INLINE SVG RATHER THAN AN ASSET ──────────────────────────────────────
 * Confirmed against the real stylesheet rather than assumed. An external `.svg` in an `<img>`
 * gets no access to the page's custom properties, so every ink would have to be a hard-coded hex
 * — a drawing that stops matching the page under the warm scope, and a colour-token guardrail
 * failure. Inline SVG takes the tokens, is reviewable in a diff, and is resolution-free, which is
 * why a drawing carries no `maxWidth` at all (see SlideStage): the "never enlarge a phone
 * capture" rule has no analogue for something with no native size.
 *
 * ⚠ A drawing is authored at whichever of the two canvases below fits its subject TIGHTLY — see
 * the long note on WIDE / WHEEL for why an empty margin is paid for in phone legibility. Read the
 * containment note in SlideStage.module.css before introducing a third.
 */
import styles from './SlideDrawings.module.css';

/**
 * The two canvases, and the difference between them is the phone arithmetic again.
 *
 * ⚠⚠ A DRAWING'S CANVAS IS NOT FREE SPACE — EVERY EMPTY UNIT IS PAID FOR IN PHONE LEGIBILITY.
 * A picture is drawn at the column's full width whatever its own numbers say, so a wide canvas
 * with the subject in the middle of it renders that subject SMALLER, at exactly the ratio of the
 * waste. The cycle wheels were first authored on the 800-wide explainer canvas, where the ring
 * occupies units 210–590 and roughly 40% of the frame is empty: on a phone the ring came out
 * 156px across. Cropping the canvas to 660 — no change to a single coordinate inside it — took it
 * to 224px, a 44% gain, **and cost nothing on a laptop**, because the stage's height budget is
 * what binds there and both canvases resolve to the same 0.8 scale.
 *
 * This is the third costume of the same lesson: P1 found that cropping ROWS doesn't narrow a
 * picture, P2a that a phone capture must be SHORT enough to be drawn at full width, and this is
 * that rule applied to something we author rather than photograph — where, unlike a capture, the
 * waste is entirely ours to remove. Before adding a drawing, ask what fraction of its canvas the
 * subject actually fills.
 */
const WIDE = { width: 800, height: 500 };  // left→right explainers: genuinely wide compositions
const WHEEL = { width: 660, height: 500 }; // the cycle slides: a ring plus its label block

/* ────────────────────────────────────────────────────────────────────────────
   Shared pieces of the two cycle slides.

   ⚠ THE POINT OF BOTH WHEELS IS THE ARC THAT CLOSES THEM. Every enterprise software company
   draws this diagram, and in almost all of them the returning arrow is decoration — it is there
   because a circle has to be a circle, and nothing happens when you get back to the top. OURS
   CLOSES WITH A BUTTON: a coach presses "Start next season", a tournament organizer copies last
   year forward. So the four working arcs are faint and the RETURN arc is the only ink on the
   ring. Do not "balance" them.

   Geometry: centre (400,240), stations on r=138, the arrow ring on r=190, five stations at
   90° / 18° / 306° / 234° / 162° going clockwise. Labels always face the CENTRE — below the
   glyph for the top and side stations, above it for the two at the bottom.
   ──────────────────────────────────────────────────────────────────────────── */

/** The four ordinary arcs plus their heads. Rotations are the clockwise tangent at each end. */
function RingArcs() {
  return (
    <>
      <g className={styles.sFaint} strokeWidth="2.5" fill="none">
        <path d="M423 51A190 190 0 01572 160" />
        <path d="M587 204A190 190 0 01530 379" />
        <path d="M492 406A190 190 0 01308 406" />
        <path d="M270 379A190 190 0 01213 204" />
      </g>
      <g className={styles.fFaint} stroke="none">
        <path d="M0 0L-12-5.5L-12 5.5Z" transform="translate(572 160) rotate(65)" />
        <path d="M0 0L-12-5.5L-12 5.5Z" transform="translate(530 379) rotate(137)" />
        <path d="M0 0L-12-5.5L-12 5.5Z" transform="translate(308 406) rotate(209)" />
        <path d="M0 0L-12-5.5L-12 5.5Z" transform="translate(213 204) rotate(-79)" />
      </g>
    </>
  );
}

/**
 * The fifth arc — the one that is a feature rather than a metaphor.
 *
 * Its label sits OUTSIDE the ring at the upper left with a short leader, rather than in the
 * empty centre. The centre was tried and abandoned: at 21px the label's box collides with the
 * two side stations' own labels, and shrinking it to fit breaks house rule 3. An empty centre
 * also matches the restraint of the form itself.
 */
function ReturnArc({ lines }: { lines: [string, string] }) {
  return (
    <>
      <path className={styles.sInk} strokeWidth="3.5" fill="none" d="M228 160A190 190 0 01377 51" />
      <path className={styles.fInk} stroke="none" d="M0 0L-14-6.5L-14 6.5Z" transform="translate(377 51) rotate(-7)" />
      {/* ⚠ TWO LINES, NOT ONE, AND THAT IS THE PHONE ARITHMETIC RATHER THAN A TYPOGRAPHIC WHIM.
          "START NEXT SEASON" on one line only fits the space left of the ring at 21 units, which
          is 8.7px on a phone — unreadable, on the single most important words in the drawing.
          Broken over two lines it sets at 26 (10.7px) and clears the ring at both heights. */}
      <g className={`${styles.label} ${styles.fInk}`} fontSize="26" textAnchor="end" letterSpacing="2" stroke="none">
        <text x="228" y="52">{lines[0]}</text>
        <text x="228" y="86">{lines[1]}</text>
      </g>
    </>
  );
}

/**
 * The scoreboard — two boxes with a dash each. Shared because it is the SAME station on both
 * wheels (the coach's `GAMES` and the tournament's `WEEKEND` sit at the identical r=138 point),
 * so a coordinate nudge here has to move both or the two rings stop matching.
 */
function ScoreboardGlyph() {
  return (
    <g className={styles.sDim} strokeWidth="2.5">
      <rect x="457" y="338" width="22" height="28" rx="3" />
      <rect x="483" y="338" width="22" height="28" rx="3" />
      <path d="M463 352h10M489 352h10" />
    </g>
  );
}

/**
 * A word on a drawing, and there are exactly two sizes on purpose — house rule 3. `Say` names the
 * mess or the answer in two words and is the only text a phone reader is expected to resolve;
 * `Sub` is the quiet second line, texture by design.
 *
 * ⚠ Both sizes are FLOORS set by the phone, not preferences: at 330px an 800-unit drawing is drawn
 * at 0.41, so 26 units ≈ 10.7px and anything smaller stops being readable. Shorten the word rather
 * than the type.
 */
function Say({
  x, y, tone, size = 26, spacing = 2.4, children,
}: {
  x: number; y: number; tone: 'ink' | 'dim'; size?: number; spacing?: number; children: string;
}) {
  return (
    <text
      className={`${styles.label} ${tone === 'ink' ? styles.fInk : styles.fDim}`}
      x={x} y={y} fontSize={size} textAnchor="middle" letterSpacing={spacing} stroke="none"
    >
      {children}
    </text>
  );
}

function Sub({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text className={`${styles.label} ${styles.fDim}`} x={x} y={y} fontSize="20" textAnchor="middle" stroke="none">
      {children}
    </text>
  );
}

/**
 * A station's caption. `above` is for the two bottom stations, whose labels face the centre.
 *
 * ⚠ 26 UNITS IS A FLOOR, NOT A PREFERENCE. On a wheel the station names ARE the content — unlike
 * the secondary lines on the left/right explainers, which house rule 3 deliberately treats as
 * texture — and at 21 they rendered 8.7px on a phone. Do not shrink one to fit a longer name in;
 * shorten the name. Every label here is ≤12 characters for exactly that reason, and the collision
 * clearances between neighbouring stations are as tight as 13 units at this size.
 */
function Station({ x, y, children, above }: { x: number; y: number; children: string; above?: boolean }) {
  return (
    <text
      className={`${styles.label} ${styles.fDim}`}
      x={x} y={above ? y - 42 : y + 50} fontSize="26" textAnchor="middle" letterSpacing="1.8" stroke="none"
    >
      {children}
    </text>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #02 — three places → one settled line
   ──────────────────────────────────────────────────────────────────────────── */
function MoneySources() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* the spreadsheet */}
      <g transform="rotate(-9 162 154)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="60" y="95" width="205" height="118" rx="5" />
        <path className={styles.sFaint} strokeWidth="1.2" d="M112 95V213M164 95V213M216 95V213M60 134H265M60 173H265" />
        <path className={styles.sDim} strokeWidth="3.5" d="M72 116h28M124 155h28M176 194h28M72 194h28" />
      </g>

      {/* the bank app */}
      <g transform="rotate(6 190 231)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="95" y="175" width="190" height="112" rx="5" />
        <path className={styles.sDim} strokeWidth="3.5" d="M112 205h74M112 259h84" />
        <path className={styles.sAmber} strokeWidth="3.5" d="M112 232h62" />
        <path className={styles.sFaint} strokeWidth="3.5" d="M232 205h36M232 232h36M232 259h36" />
      </g>

      {/* the e-transfer, and the blank where a name should be — the whole slide */}
      <g transform="rotate(-3 158 312)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="50" y="250" width="215" height="125" rx="5" />
        <rect className={styles.sDim} strokeWidth="2" x="68" y="266" width="36" height="25" rx="2.5" />
        <path className={styles.sDim} strokeWidth="2" d="M68 266l18 14 18-14" />
        <path className={styles.sDim} strokeWidth="3.5" d="M118 272h114" />
        <path className={styles.sAmber} strokeWidth="3.5" strokeDasharray="9 8" d="M68 316h104" />
        <text className={`${styles.label} ${styles.fAmber}`} x="186" y="326" fontSize="32" stroke="none">?</text>
        <path className={styles.sDim} strokeWidth="3.5" d="M68 350h78" />
      </g>

      {/* everything lands in one place */}
      <path
        className={styles.sFaint} strokeWidth="2"
        d="M276 148C352 176 406 214 450 245M296 234C362 240 408 246 450 250M272 330C350 314 406 284 450 255"
      />
      <circle className={styles.fDim} cx="460" cy="250" r="5" stroke="none" />

      {/* one line, with a name on it. No container, no header — a row on a hairline. */}
      <g transform="rotate(-0.8 630 255)">
        <path className={styles.sFaint} strokeWidth="1.5" d="M500 300h268" />
        <circle className={styles.sInk} strokeWidth="3" cx="521" cy="252" r="17" />
        <rect className={styles.fInk} stroke="none" x="554" y="238" width="118" height="11" rx="5.5" />
        <rect className={styles.fDim} stroke="none" x="554" y="261" width="76" height="7" rx="3.5" />
        <rect className={styles.fInk} stroke="none" x="688" y="239" width="80" height="12" rx="6" />
        {/* ⚠ INK, NOT LIME (owner call 2026-08-21). Brightness already carries the resolution,
            and the walkthrough panel spends lime six times already. */}
        <path className={styles.sInk} strokeWidth="4" d="M690 274l13 13 25-27" />
      </g>

      <Say x={163} y={440} tone="dim">THREE PLACES</Say>
      <Say x={634} y={422} tone="ink">ONE SETTLED LINE</Say>
      <Sub x={634} y={452}>with a name on it</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #05 — a group text → one roster, and the family's own schedule

   ⚠ THE RISKIEST OF THE SEVEN, and it was named as such in the mockup round. A list of rows with
   badges is the closest any drawing gets to a real screen. It stays safe by having no header, no
   container, no controls — and a "#" in the badge rather than a number, i.e. "a number goes
   here" rather than a datum. Do not put a real number in that badge.
   ──────────────────────────────────────────────────────────────────────────── */
function RosterFromGroupText() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-5 142 124)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="55" y="95" width="175" height="58" rx="29" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M62 149l-12 16 26-6" />
        <path className={styles.sDim} strokeWidth="3" d="M80 118h84M80 133h52" />
      </g>
      <g transform="rotate(4 202 199)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="100" y="170" width="238" height="58" rx="29" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M118 224l-13 17 27-6" />
        <text className={`${styles.label} ${styles.fDim}`} x="120" y="207" fontSize="24" stroke="none">can’t make sat</text>
      </g>
      <g transform="rotate(-2 148 274)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="48" y="245" width="200" height="58" rx="29" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M56 299l-13 17 27-6" />
        <text className={`${styles.label} ${styles.fDim}`} x="70" y="282" fontSize="24" stroke="none">new number →</text>
      </g>
      {/* the question nobody answered */}
      <g transform="rotate(6 200 347)">
        <rect className={styles.sAmber} strokeWidth="2.5" x="120" y="320" width="160" height="54" rx="27" />
        <path className={styles.sAmber} strokeWidth="2.5" d="M128 370l-13 16 26-6" />
        <text className={`${styles.label} ${styles.fAmber}`} x="188" y="357" fontSize="28" textAnchor="middle" stroke="none">?</text>
      </g>

      <path className={styles.sFaint} strokeWidth="2" d="M348 213C388 210 414 205 448 200" />
      <circle className={styles.fDim} cx="458" cy="199" r="5" stroke="none" />

      <g transform="rotate(-0.6 630 205)">
        {[0, 68, 136].map((dy, i) => (
          <g key={dy} transform={`translate(0 ${dy})`}>
            <rect className={styles.sInk} strokeWidth="2.5" x="500" y="120" width="42" height="42" rx="7" />
            <text className={`${styles.label} ${styles.fInk}`} x="521" y="149" fontSize="24" textAnchor="middle" stroke="none">#</text>
            <rect className={styles.fInk} stroke="none" x="560" y="127" width={[112, 92, 124][i]} height="10" rx="5" />
            <rect className={styles.fDim} stroke="none" x="560" y="147" width={[66, 78, 58][i]} height="7" rx="3.5" />
            <circle className={styles.sDim} strokeWidth="2" cx="706" cy="141" r="7" />
            <path className={styles.sFaint} strokeWidth="1.4" d="M500 176h222" />
          </g>
        ))}
      </g>

      {/* the family's own schedule, on their own phone */}
      <path className={styles.sFaint} strokeWidth="2" strokeDasharray="3 9" d="M498 338C462 356 432 366 404 370" />
      <g transform="rotate(-4 372 400)">
        <rect className={styles.sInk} strokeWidth="2.5" x="344" y="356" width="56" height="92" rx="9" />
        <path className={styles.sDim} strokeWidth="1.6" d="M344 372h56" />
        <rect className={styles.fDim} stroke="none" x="354" y="382" width="12" height="10" rx="2" />
        <rect className={styles.fInk} stroke="none" x="372" y="382" width="12" height="10" rx="2" />
        <rect className={styles.fDim} stroke="none" x="354" y="398" width="12" height="10" rx="2" />
        <rect className={styles.fDim} stroke="none" x="372" y="398" width="12" height="10" rx="2" />
        <rect className={styles.fDim} stroke="none" x="354" y="414" width="30" height="8" rx="4" />
      </g>

      <Say x={163} y={448} tone="dim">A GROUP TEXT</Say>
      <Say x={372} y={478} tone="dim" size={21} spacing={1.6}>FAMILIES</Say>
      <Say x={600} y={378} tone="ink">ONE ROSTER</Say>
      <Sub x={600} y={408}>numbers, positions, contacts</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #07 — all afternoon → one message

   ⚠ THE ONLY SLIDE IN THE LIBRARY THAT IS A DRAWING BECAUSE IT CANNOT BE PHOTOGRAPHED, not
   because drawing is the better answer. The demo world's live game console exists about seven
   hours a week, the seeded Saturday game deliberately has no lineup, and game rows take a fresh
   id every reseed. Do not "solve" this by trying to capture it.

   THE COUNT IS THE ARGUMENT: four bubbles in, one envelope out.
   ──────────────────────────────────────────────────────────────────────────── */
function OneMessageNotOnePerRun() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-4 145 133)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="60" y="105" width="170" height="56" rx="28" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M68 157l-13 17 27-6" />
        <text className={`${styles.label} ${styles.fDim}`} x="145" y="142" fontSize="26" textAnchor="middle" stroke="none">score?</text>
      </g>
      <g transform="rotate(3 175 206)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="100" y="180" width="150" height="52" rx="26" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M108 228l-13 16 26-5" />
        <path className={styles.sFaint} strokeWidth="3" d="M124 200h72M124 216h44" />
      </g>
      <g transform="rotate(-2 142 280)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="55" y="252" width="175" height="56" rx="28" />
        <path className={styles.sFaint} strokeWidth="2.5" d="M63 304l-13 17 27-6" />
        <text className={`${styles.label} ${styles.fDim}`} x="142" y="289" fontSize="26" textAnchor="middle" stroke="none">score?</text>
      </g>
      <g transform="rotate(5 175 351)">
        <rect className={styles.sAmber} strokeWidth="2.5" x="105" y="326" width="140" height="50" rx="25" />
        <path className={styles.sAmber} strokeWidth="2.5" d="M113 372l-13 16 26-5" />
        <text className={`${styles.label} ${styles.fAmber}`} x="175" y="360" fontSize="27" textAnchor="middle" stroke="none">?</text>
      </g>

      <path className={styles.sFaint} strokeWidth="2" d="M290 240C348 240 400 240 448 240" />
      <circle className={styles.fDim} cx="458" cy="240" r="5" stroke="none" />

      {/* they watch it themselves — the running score, which notifies nobody */}
      <g transform="rotate(-0.6 630 190)">
        <rect className={styles.sInk} strokeWidth="3" x="516" y="120" width="88" height="74" rx="9" />
        <rect className={styles.sInk} strokeWidth="3" x="626" y="120" width="88" height="74" rx="9" />
        <rect className={styles.fInk} stroke="none" x="540" y="152" width="40" height="11" rx="5.5" />
        <rect className={styles.fInk} stroke="none" x="650" y="152" width="40" height="11" rx="5.5" />
        <path className={styles.sDim} strokeWidth="2.5" d="M736 145a20 20 0 010 40M736 157a9 9 0 010 16" />
        <Sub x={615} y={228}>they watch it themselves</Sub>
      </g>

      <path className={styles.sFaint} strokeWidth="1.4" d="M500 258h268" />

      {/* and ONE message when the game ends */}
      <g transform="rotate(-1 630 336)">
        <rect className={styles.sInk} strokeWidth="3" x="556" y="292" width="150" height="100" rx="7" />
        <path className={styles.sInk} strokeWidth="3" d="M556 299l75 56 75-56" />
        <path className={styles.sDim} strokeWidth="2.5" d="M714 342h46m-14-11l14 11-14 11" />
      </g>

      <Say x={150} y={442} tone="dim">ALL AFTERNOON</Say>
      <Say x={631} y={432} tone="ink">ONE MESSAGE</Say>
      <Sub x={631} y={462}>when the game ends</Sub>
    </g>
  );
}

/**
 * The paperclip on a forwarded entry — the same shape three times over, differing only in where
 * it starts. Named rather than repeated so the next slip does not get a fourth, slightly-wrong
 * copy of a magic path string.
 */
function Paperclip({ x, y }: { x: number; y: number }) {
  return (
    <path
      className={styles.sDim} strokeWidth="2.5"
      d={`M${x} ${y}c0-8 12-8 12 0v22c0 12-20 12-20 0v-26`}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #16 — an inbox → one list you decide from

   The three decision marks are drawn as pen strokes, never as buttons, and the dimming of the
   last two rows carries "waitlisted" and "declined" without a word of chrome.
   ──────────────────────────────────────────────────────────────────────────── */
function RegistrationsFromEmail() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* the one that arrived twice, sitting behind */}
      <g transform="rotate(-12 172 126)" opacity="0.55">
        <rect className={styles.sFaint} strokeWidth="2.5" x="80" y="92" width="190" height="70" rx="5" />
      </g>
      <g transform="rotate(-6 160 139)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="60" y="100" width="200" height="78" rx="5" />
        <Paperclip x={84} y={118} />
        <path className={styles.sDim} strokeWidth="3.5" d="M116 122h116M116 148h74" />
      </g>
      <g transform="rotate(4 187 223)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="90" y="185" width="195" height="76" rx="5" />
        <Paperclip x={114} y={203} />
        <path className={styles.sDim} strokeWidth="3.5" d="M146 206h108M146 232h62" />
      </g>
      <g transform="rotate(-2 152 304)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="50" y="265" width="205" height="78" rx="5" />
        <Paperclip x={74} y={283} />
        <path className={styles.sAmber} strokeWidth="3.5" d="M106 286h118M106 312h68" />
      </g>

      <path className={styles.sFaint} strokeWidth="2" d="M292 222C352 224 402 226 448 228" />
      <circle className={styles.fDim} cx="458" cy="228" r="5" stroke="none" />

      <g transform="rotate(-0.5 630 235)">
        {/* approve · approve · waitlist · decline — read from the marks AND from the dimming */}
        <g>
          <rect className={styles.fInk} stroke="none" x="500" y="122" width="104" height="10" rx="5" />
          <rect className={styles.fDim} stroke="none" x="622" y="123" width="42" height="8" rx="4" />
          <rect className={styles.fDim} stroke="none" x="678" y="123" width="30" height="8" rx="4" />
          <path className={styles.sInk} strokeWidth="3.5" d="M732 127l9 9 17-19" />
          <path className={styles.sFaint} strokeWidth="1.4" d="M500 150h268" />
        </g>
        <g transform="translate(0 62)">
          <rect className={styles.fInk} stroke="none" x="500" y="122" width="86" height="10" rx="5" />
          <rect className={styles.fDim} stroke="none" x="622" y="123" width="42" height="8" rx="4" />
          <rect className={styles.fDim} stroke="none" x="678" y="123" width="30" height="8" rx="4" />
          <path className={styles.sInk} strokeWidth="3.5" d="M732 127l9 9 17-19" />
          <path className={styles.sFaint} strokeWidth="1.4" d="M500 150h268" />
        </g>
        <g transform="translate(0 124)" opacity="0.75">
          <rect className={styles.fDim} stroke="none" x="500" y="122" width="118" height="10" rx="5" />
          <rect className={styles.fFaint} stroke="none" x="622" y="123" width="42" height="8" rx="4" />
          <rect className={styles.fFaint} stroke="none" x="678" y="123" width="30" height="8" rx="4" />
          <path className={styles.sDim} strokeWidth="3.5" d="M737 120v16M749 120v16" />
          <path className={styles.sFaint} strokeWidth="1.4" d="M500 150h268" />
        </g>
        <g transform="translate(0 186)" opacity="0.55">
          <rect className={styles.fDim} stroke="none" x="500" y="122" width="94" height="10" rx="5" />
          <rect className={styles.fFaint} stroke="none" x="622" y="123" width="42" height="8" rx="4" />
          <rect className={styles.fFaint} stroke="none" x="678" y="123" width="30" height="8" rx="4" />
          <path className={styles.sDim} strokeWidth="3.5" d="M734 119l18 18m0-18l-18 18" />
          <path className={styles.sFaint} strokeWidth="1.4" d="M500 150h268" />
        </g>
      </g>

      <Say x={155} y={440} tone="dim">AN INBOX</Say>
      <Say x={612} y={440} tone="ink">ONE LIST</Say>
      <Sub x={612} y={470}>approve · waitlist · decline</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #17 — last year → this year, already filled in

   The four rows ARE the four nouns in the claim, verified against what a tournament copy-forward
   actually carries: divisions (with their pools and slots), venues, the registration fields and
   fee schedule, and the branding / public pages / welcome / rules.
   ──────────────────────────────────────────────────────────────────────────── */
function CopiedForward() {
  const glyphs = (tone: string, weight: string, fill: string) => (
    <>
      <g>
        <rect className={fill} stroke="none" x="110" y="98" width="62" height="10" rx="5" />
        <rect className={fill} stroke="none" x="110" y="116" width="46" height="10" rx="5" />
        <rect className={fill} stroke="none" x="110" y="134" width="32" height="10" rx="5" />
      </g>
      <g className={tone} strokeWidth={weight} transform="translate(0 85)">
        <path d="M124 118a17 17 0 0134 0c0 14-17 30-17 30s-17-16-17-30z" />
        <circle cx="141" cy="118" r="6" />
        <rect x="166" y="122" width="34" height="22" rx="3" />
      </g>
      <g className={tone} strokeWidth={weight} transform="translate(0 170)">
        <rect x="114" y="97" width="56" height="58" rx="4" />
        <rect x="124" y="108" width="12" height="12" rx="2" />
        <path d="M144 114h16M124 134h36M124 146h24" />
      </g>
      <g className={tone} strokeWidth={weight} transform="translate(0 255)">
        <circle cx="141" cy="126" r="27" />
        <ellipse cx="141" cy="126" rx="12" ry="27" />
        <path d="M114 126h54" />
      </g>
    </>
  );

  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g opacity="0.9">{glyphs(styles.sFaint, '2.5', styles.fFaint)}</g>

      <g className={styles.sFaint} strokeWidth="2" strokeDasharray="3 9">
        <path d="M228 120h318M228 205h318M228 290h318M228 375h318" />
      </g>
      <g className={styles.fFaint} stroke="none">
        <path d="M546 113l14 7-14 7zM546 198l14 7-14 7zM546 283l14 7-14 7zM546 368l14 7-14 7z" />
      </g>
      <g className={`${styles.label} ${styles.fDim}`} fontSize="23" textAnchor="middle" letterSpacing="1.4" stroke="none">
        <text x="330" y="112">DIVISIONS</text>
        <text x="330" y="197">VENUES</text>
        <text x="341" y="282">REGISTRATION</text>
        <text x="330" y="367">YOUR SITE</text>
      </g>

      <g transform="translate(500 0)">{glyphs(styles.sInk, '3', styles.fInk)}</g>

      <Say x={141} y={452} tone="dim">LAST YEAR</Say>
      <Say x={641} y={452} tone="ink">THIS YEAR</Say>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #24 — in your head → one book

   ⚠ THE LEFT SIDE IS EMPTY FRAMES, NOT SCRAPS OF PAPER, and that is the whole reading of the pain.
   "It is in your head" does not mean the notes are scattered — it means there are NO notes, so the
   old way is three blank dashed outlines rather than three written slips. Drawing scraps here would
   quietly change the problem the slide is about.

   The book fades downward because "it grows every time you meet them" is a stack that keeps going —
   the half of the claim the photograph this replaces could not show at all.
   ──────────────────────────────────────────────────────────────────────────── */
function OpponentBook() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g className={styles.sFaint} strokeWidth="2" strokeDasharray="10 9" opacity="0.5">
        <rect x="96" y="118" width="150" height="96" rx="6" transform="rotate(-9 171 166)" />
      </g>
      <g className={styles.sFaint} strokeWidth="2.2" strokeDasharray="10 9" opacity="0.75">
        <rect x="66" y="196" width="162" height="100" rx="6" transform="rotate(5 147 246)" />
      </g>
      <g className={styles.sAmber} strokeWidth="2.5" strokeDasharray="11 9">
        <rect x="92" y="278" width="160" height="102" rx="6" transform="rotate(-3 172 329)" />
      </g>
      <text className={`${styles.label} ${styles.fAmber}`} x="172" y="342" fontSize="34" textAnchor="middle" stroke="none">?</text>

      <path className={styles.sFaint} strokeWidth="2" d="M282 250C348 250 402 250 448 250" />
      <circle className={styles.fDim} cx="458" cy="250" r="5" stroke="none" />

      <g transform="rotate(-0.6 630 250)">
        {/* the book line — the standing summary the whole page hangs off */}
        <path className={styles.sInk} strokeWidth="3" d="M498 108v66" />
        <rect className={styles.fInk} stroke="none" x="514" y="118" width="196" height="10" rx="5" />
        <rect className={styles.fDim} stroke="none" x="514" y="140" width="150" height="8" rx="4" opacity="0.85" />
        <path className={styles.sFaint} strokeWidth="1.4" d="M498 192h272" />

        {/* every meeting, newest first, receding into the seasons behind it */}
        {[
          { dy: 0, op: 1, chip: styles.sInk, bar: styles.fInk, note: 152, tag: styles.sDim },
          { dy: 62, op: 0.7, chip: styles.sDim, bar: styles.fDim, note: 130, tag: styles.sFaint },
          { dy: 124, op: 0.42, chip: styles.sDim, bar: styles.fDim, note: 146, tag: styles.sFaint },
        ].map(m => (
          <g key={m.dy} opacity={m.op} transform={`translate(0 ${m.dy})`}>
            <rect className={m.chip} strokeWidth="2.5" x="498" y="212" width="26" height="26" rx="5" />
            <rect className={m.bar} stroke="none" x="504" y="223" width="14" height="4" rx="2" />
            <rect className={m.bar} stroke="none" x="538" y="218" width="76" height="9" rx="4.5" />
            <rect className={styles.fDim} stroke="none" x="538" y="242" width={m.note} height="7" rx="3.5" />
            <rect className={m.tag} strokeWidth="1.8" x="702" y="240" width="52" height="12" rx="6" />
          </g>
        ))}
      </g>

      <Say x={165} y={444} tone="dim">IN YOUR HEAD</Say>
      <Say x={634} y={440} tone="ink">ONE BOOK</Say>
      <Sub x={620} y={470}>it grows every meeting</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #09 — nothing kept → one page

   ⚠ THE FOUR SHELVES ARE NAMED AT FULL SIZE, breaking house rule 3's "two words each side, the
   rest is texture" on purpose: on this slide the four ARE the claim ("the record, the roster, the
   practices, the money" is the sentence beside the picture). Same deliberate exception the
   copy-forward drawing already makes with its four nouns.

   ⚠ One page and exactly four shelves is the BINDING owner ruling the product is built on
   (CLAUDE.md), not a simplification made to fit a drawing. Do not add a fifth here without adding
   it to the product.
   ──────────────────────────────────────────────────────────────────────────── */
function SeasonPage() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* the four things the season made, drifting apart — the last two already only outlines */}
      <g transform="rotate(-14 118 140)" opacity="0.75">
        <rect className={styles.sFaint} strokeWidth="2.2" x="66" y="106" width="104" height="68" rx="5" />
        <path className={styles.sDim} strokeWidth="3" d="M82 130h34M82 146h56" />
      </g>
      <g transform="rotate(9 232 176)" opacity="0.6">
        <rect className={styles.sFaint} strokeWidth="2.2" x="182" y="142" width="100" height="68" rx="5" />
        <path className={styles.sDim} strokeWidth="3" d="M198 166h30M198 182h48" />
      </g>
      <g transform="rotate(-6 116 296)" opacity="0.45">
        <rect className={styles.sFaint} strokeWidth="2.2" strokeDasharray="9 8" x="64" y="262" width="104" height="68" rx="5" />
      </g>
      <g transform="rotate(12 236 322)">
        <rect className={styles.sAmber} strokeWidth="2.4" strokeDasharray="9 8" x="186" y="288" width="100" height="68" rx="5" />
        <text className={`${styles.label} ${styles.fAmber}`} x="236" y="333" fontSize="30" textAnchor="middle" stroke="none">?</text>
      </g>

      <path className={styles.sFaint} strokeWidth="2" d="M312 232C360 236 406 242 448 248" />
      <circle className={styles.fDim} cx="458" cy="249" r="5" stroke="none" />

      <g transform="rotate(-0.5 632 240)">
        <rect className={styles.sInk} strokeWidth="3" x="496" y="80" width="272" height="312" rx="7" />
        {/* the record, across the top — a scoreline, not a number we would have to keep true */}
        <g className={styles.fInk} stroke="none">
          <rect x="520" y="108" width="52" height="15" rx="7.5" />
          <rect x="580" y="108" width="34" height="15" rx="7.5" />
          <rect x="622" y="108" width="26" height="15" rx="7.5" />
        </g>
        <path className={styles.sFaint} strokeWidth="1.4" d="M520 142h224" />
        <g className={`${styles.label} ${styles.fDim}`} fontSize="26" letterSpacing="1.6" stroke="none">
          <text x="520" y="184">RESULTS</text>
          <text x="520" y="240">ROSTER</text>
          <text x="520" y="296">PRACTICES</text>
          <text x="520" y="352">MONEY</text>
        </g>
        <path className={styles.sFaint} strokeWidth="1.4" d="M520 200h224M520 256h224M520 312h224M520 368h224" />
      </g>

      <Say x={176} y={446} tone="dim">NOTHING KEPT</Say>
      <Say x={632} y={440} tone="ink">ONE PAGE</Say>
      <Sub x={620} y={470}>the same in three years</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #25 — a 9 PM text → the rotation

   ⚠ THIS DRAWING IS BETTER THAN THE PHOTOGRAPH IT REPLACED, and the reason generalises: the
   screenshot spelled the rotation out in words (three rows of station names), so "everyone does
   everything" was something a reader had to READ. Three shapes stepping diagonally make it
   something they SEE. When a screen's point is a PATTERN, a drawing can outperform a capture of it.

   ⚠ SHAPES, NOT EQUIPMENT — a square, a circle and a triangle rather than a tee and a cone. The
   platform is sport-neutral (lib/sports.ts Sport Pack) and a baseball glyph on a shared marketing
   surface is exactly the debt that rule exists to keep out.
   ──────────────────────────────────────────────────────────────────────────── */
function PracticeRotation() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-6 148 224)">
        <rect className={styles.sFaint} strokeWidth="2.5" x="93" y="118" width="110" height="212" rx="12" />
        <path className={styles.sFaint} strokeWidth="1.6" d="M93 136h110" />
        <path
          className={styles.sDim} strokeWidth="3"
          d="M108 158h78M108 174h64M108 190h80M108 206h50M108 222h76M108 238h68M108 254h40M108 270h74M108 286h58M108 302h30"
        />
      </g>
      <g transform="rotate(5 152 372)">
        <rect className={styles.sAmber} strokeWidth="2.5" x="72" y="346" width="160" height="52" rx="26" />
        <path className={styles.sAmber} strokeWidth="2.5" d="M80 394l-13 16 26-5" />
        <text className={`${styles.label} ${styles.fAmber}`} x="152" y="381" fontSize="27" textAnchor="middle" stroke="none">?</text>
      </g>

      <path className={styles.sFaint} strokeWidth="2" d="M258 226C300 226 330 226 358 226" />
      <circle className={styles.fDim} cx="368" cy="226" r="5" stroke="none" />

      <g transform="rotate(-0.5 610 230)">
        <g className={`${styles.label} ${styles.fDim}`} fontSize="22" letterSpacing="1.4" textAnchor="middle" stroke="none">
          <text x="530" y="128">A</text><text x="602" y="128">B</text><text x="674" y="128">C</text>
        </g>
        <g className={`${styles.label} ${styles.fFaint}`} fontSize="22" textAnchor="middle" stroke="none">
          <text x="470" y="180">1</text><text x="470" y="242">2</text><text x="470" y="304">3</text>
        </g>
        <g className={styles.sFaint} strokeWidth="1.4">
          <path d="M494 142h216M494 204h216M494 266h216M494 328h216" />
          <path d="M494 142v186M566 142v186M638 142v186M710 142v186" />
        </g>
        {/* the diagonal step IS the argument — each group meets each station exactly once */}
        <g className={styles.sInk} strokeWidth="3">
          <rect className={styles.fInk} stroke="none" x="518" y="160" width="24" height="24" rx="3" />
          <circle cx="602" cy="172" r="13" />
          <path d="M674 159l14 25h-28z" />

          <path d="M530 221l14 25h-28z" />
          <rect className={styles.fInk} stroke="none" x="590" y="222" width="24" height="24" rx="3" />
          <circle cx="674" cy="234" r="13" />

          <circle cx="530" cy="296" r="13" />
          <path d="M602 283l14 25h-28z" />
          <rect className={styles.fInk} stroke="none" x="662" y="284" width="24" height="24" rx="3" />
        </g>
      </g>

      <Say x={160} y={452} tone="dim">A 9 PM TEXT</Say>
      <Say x={602} y={384} tone="ink">THE ROTATION</Say>
      <Sub x={602} y={414}>everyone does everything</Sub>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #26 — the coach's year, and the arc that closes it

   ⚠ The five stations are not marketing invention: they are the five phases the coach portal and
   the demo world are BOTH built around, which is why every other coach slide already sits on one
   of them. Changing one here without changing the product's own phases makes the wheel a lie.
   ──────────────────────────────────────────────────────────────────────────── */
function CoachYear() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <RingArcs />
      <ReturnArc lines={['START NEXT', 'SEASON']} />

      <g className={styles.sDim} strokeWidth="2.5">
        <rect x="383" y="80" width="34" height="44" rx="4" />
        <path d="M391 92h18M391 100h12" />
      </g>
      <g className={styles.fDim} stroke="none">
        <circle cx="392" cy="112" r="2.6" /><circle cx="400" cy="112" r="2.6" /><circle cx="408" cy="112" r="2.6" />
      </g>
      <Station x={400} y={102}>TRYOUTS</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <rect x="509" y="181" width="13" height="13" rx="2.5" />
        <path d="M527 187h26" />
        <rect x="509" y="200" width="13" height="13" rx="2.5" />
        <path d="M527 206h18" />
      </g>
      <Station x={531} y={197}>ROSTER</Station>

      <ScoreboardGlyph />
      <Station x={481} y={352} above>GAMES</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <path d="M299 338h30M299 348h36M299 358h24" />
        <path strokeWidth="3.5" d="M299 368h40" />
      </g>
      <Station x={319} y={352} above>BOOKS</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <path d="M256 179h26l-2 16a11 11 0 01-22 0z" />
        <path d="M256 183c-8 0-8 10 0 12M282 183c8 0 8 10 0 12" />
        <path d="M269 206v8M260 214h18" />
      </g>
      <Station x={269} y={197}>WRAPPED</Station>
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   #27 — the tournament year, and the arc that closes it

   ⚠ IT DELIBERATELY DOES NOT STEAL #17's JOB. The tournament deck already ENDS on "next year
   starts from last year", so if this slide's punchline were the loop it would be #17 wearing a
   wheel. Its pain is FRAGMENTATION; the loop is a closing clause #17 then proves in full.
   Overview opens the deck, proof closes it.
   ──────────────────────────────────────────────────────────────────────────── */
function TournamentYear() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <RingArcs />
      <ReturnArc lines={['COPIED', 'FORWARD']} />

      <g className={styles.sDim} strokeWidth="2.5">
        <rect x="380" y="84" width="40" height="38" rx="3" />
        <path d="M380 96h40M389 78v10M411 78v10" />
      </g>
      <g className={styles.fDim} stroke="none">
        <rect x="387" y="103" width="6" height="6" rx="1" />
        <rect x="397" y="103" width="6" height="6" rx="1" />
        <rect x="407" y="103" width="6" height="6" rx="1" />
        <rect x="387" y="113" width="6" height="6" rx="1" />
        <rect x="397" y="113" width="6" height="6" rx="1" />
      </g>
      <Station x={400} y={102}>SET UP</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <path d="M511 185h24M511 197h24M511 209h16" />
        <path d="M539 203l5 5 10-11" />
      </g>
      <Station x={531} y={197}>ENTRIES</Station>

      <ScoreboardGlyph />
      <Station x={481} y={352} above>WEEKEND</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <path d="M297 336h12M297 348h12M309 336v12M309 342h10" />
        <path d="M297 356h12M297 368h12M309 356v12M309 362h10" />
        <path d="M319 342v20M319 352h12" />
      </g>
      <Station x={319} y={352} above>PLAYOFFS</Station>

      <g className={styles.sDim} strokeWidth="2.5">
        <rect x="253" y="177" width="32" height="40" rx="3" />
        <path d="M261 187h16" />
        <path strokeWidth="3" d="M261 209v-8M269 209v-16M277 209v-12" />
      </g>
      <Station x={269} y={197}>WRAP-UP</Station>
    </g>
  );
}

/**
 * THE REGISTRY — a slide names a drawing by id, exactly as it names a capture by shot id.
 *
 * ⚠ `satisfies` rather than an annotation keeps the key set LITERAL, so `DrawingId` below is the
 * real list of drawings and a slide naming one that does not exist is a COMPILE error rather than
 * a blank stage. Same discipline as the slide bank's own key set.
 */
export const SLIDE_DRAWINGS = {
  'money-sources':      { Draw: MoneySources,           ...WIDE },
  'roster-group-text':  { Draw: RosterFromGroupText,    ...WIDE },
  'one-message':        { Draw: OneMessageNotOnePerRun, ...WIDE },
  'registration-inbox': { Draw: RegistrationsFromEmail, ...WIDE },
  'copied-forward':     { Draw: CopiedForward,          ...WIDE },
  // The §69 batch — three coach slides whose PHOTOGRAPHS were unreadable on a phone (34%, 34%,
  // 52% of true size). Drawn rather than re-photographed because a re-capture at phone width only
  // trades the problem: it makes the picture small on a laptop instead. A drawing has no native
  // size, so it reads at whatever size we author for.
  'opponent-book':      { Draw: OpponentBook,           ...WIDE },
  'season-page':        { Draw: SeasonPage,             ...WIDE },
  'practice-rotation':  { Draw: PracticeRotation,       ...WIDE },
  'coach-year':         { Draw: CoachYear,              ...WHEEL },
  'tournament-year':    { Draw: TournamentYear,         ...WHEEL },
} satisfies Record<string, { Draw: () => React.ReactElement; width: number; height: number }>;

export type DrawingId = keyof typeof SLIDE_DRAWINGS;

/** A drawing's intrinsic box, for the stage's width solver. See WIDE / WHEEL above. */
export function drawingSize(id: DrawingId): { width: number; height: number } {
  const { width, height } = SLIDE_DRAWINGS[id];
  return { width, height };
}

/**
 * One drawing. `alt` comes from the SLIDE (a drawing has no manifest entry to keep it in) and is
 * carried on the <svg> itself with role="img", the accessible equivalent of an <img alt> for
 * inline SVG.
 */
export default function SlideDrawing({ id, alt }: { id: DrawingId; alt: string }) {
  const { Draw, width, height } = SLIDE_DRAWINGS[id];
  return (
    <svg
      className={styles.drawing}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={alt}
      preserveAspectRatio="xMidYMid meet"
    >
      <Draw />
    </svg>
  );
}
