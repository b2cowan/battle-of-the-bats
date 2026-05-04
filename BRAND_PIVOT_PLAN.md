# FieldLogic — Brand Pivot: Copy Layer Revision

**Date:** 2026-05-04
**Status:** Approved — Pending Implementation
**Effort:** Low — copy changes only. Zero CSS, zero token, zero component changes.
**Scope:** `app/page.tsx` (primary) + `components/PricingSection.tsx` (minor)

---

## Goal

Preserve the full FieldLogic visual system (Pitch Black / Blueprint Blue / Logic Lime,
mono typography, grid aesthetic, sharp corners, HUD admin experience) while replacing the
software-deployment copy metaphor on the marketing page with sports-authority language.

The user landing on the marketing page is a league organizer, volunteer admin, or coach —
not a DevOps engineer. The current copy was borrowed directly from the admin UX without
asking whether the pre-conversion visitor inhabits the same headspace as a logged-in
organizer. This plan fixes the language layer only.

**What does not change:**
- All CSS, tokens, Tailwind classes
- Visual design of every section (layout, colors, table format, step format, testimonial format)
- The admin HUD experience
- Org-page theming
- The FieldLogic name (see note below)

---

## On the Name: Keep "FieldLogic"

"FieldLogic" does not carry the same friction as the body copy. "Field" is sports-native.
"Logic" signals precision without implying a software deployment. The name is distinctive,
not overloaded by technical jargon, and already established in the codebase and any
existing customer touchpoints. Changing it would require domain changes, legal review, and
a full copy audit — for zero conversion benefit. Keep it.

---

## Section-by-Section Changes

### 1. Hero — `app/page.tsx`

**System status eyebrow:**
```
BEFORE: "System Operational"  ·  "Multi-tenant · v2.0"
AFTER:  "Live"                ·  "50+ Leagues Running"
```
*Keep the pulse dot. Change the text only.*

**Hero headline — keep as-is:**
```
"Engineered for Competition."
```
This line is strong, sports-native, and carries no technical jargon. No change.

**Hero subheading:**
```
BEFORE:
"A high-precision tournament management layer for sports organizations that demand
structural integrity in their operations. Real-time brackets. Immutable records.
Zero spreadsheets."

AFTER:
"Everything your league needs to run a tournament — registration, brackets, and live
scores — without the spreadsheets. Built for the organizers who take it seriously."
```

**Primary CTA:**
```
BEFORE: "Initialize Your Organization"
AFTER:  "Claim Your League"
```

**Secondary CTA:**
```
BEFORE: "View Live Systems →"
AFTER:  "See Live Tournaments →"
```

---

### 2. Stats Bar — `app/page.tsx`

No changes. "50+ Tournaments / 2,000+ Teams / 300+ Age divisions" is clear and human.

---

### 3. Features / Capabilities — `app/page.tsx`

**Keep the table format.** The structured grid is visually strong and deliberately unlike
every card-based competitor. Only the text inside it changes.

**Section eyebrow:**
```
BEFORE: "System Capabilities"
AFTER:  "Platform Features"
```

**Section headline:**
```
BEFORE: "Infrastructure for competition"
AFTER:  "Everything a tournament needs"
```

**Section subheading:**
```
BEFORE: "Every module built for tournament operations that cannot afford to fail."
AFTER:  "From first registration to final bracket — every tool in one place."
```

**Table column headers:**
```
BEFORE: ID  |  Capability    |  Specification         |  Status
AFTER:  #   |  Feature       |  What it does          |  Status
```
*The `#` column keeps the monospace row-number visual without the CAP-01 jargon.*

**Table rows (`CAPABILITIES` array in page.tsx):**

| # | Feature | What it does | Status |
|---|---------|-------------|--------|
| 01 | Bracket Builder | Generate single or double-elimination brackets in seconds | ACTIVE |
| 02 | Live Brackets | Scores update for coaches and parents the moment you enter them | ACTIVE |
| 03 | Team Registration | Custom registration forms with waitlist management built in | ACTIVE |
| 04 | Tournament Archive | Every result sealed and searchable after the final whistle | BETA |

```tsx
// Updated CAPABILITIES array
const CAPABILITIES = [
  { id: '01', name: 'Bracket Builder',     spec: 'Generate single or double-elimination brackets in seconds',              status: 'ACTIVE' },
  { id: '02', name: 'Live Brackets',        spec: 'Scores update for coaches and parents the moment you enter them',        status: 'ACTIVE' },
  { id: '03', name: 'Team Registration',    spec: 'Custom registration forms with waitlist management built in',            status: 'ACTIVE' },
  { id: '04', name: 'Tournament Archive',   spec: 'Every result sealed and searchable after the final whistle',             status: 'BETA'   },
];
```

---

### 4. How It Works / Steps — `app/page.tsx`

**Keep the 3-step numbered card format.** Only the labels and descriptions change.

**Section eyebrow:**
```
BEFORE: "Initialization Sequence"
AFTER:  "How It Works"
```

**Section headline:**
```
BEFORE: "Operational in a single session"
AFTER:  "Up and running in a day"
```

**Section subheading:**
```
BEFORE: "No training required. Define parameters, open the endpoint, execute."
AFTER:  "No manual needed. Set up your league, open registration, run your tournament."
```

**Step labels and descriptions (`STEPS` array):**

```tsx
// Updated STEPS array
const STEPS = [
  {
    num: '01',
    label: 'SET UP YOUR LEAGUE',
    desc: 'Create your organization. Define age groups, field layout, and schedule format.',
  },
  {
    num: '02',
    label: 'OPEN REGISTRATION',
    desc: 'Share your registration link. Teams sign up, and waitlist management runs automatically.',
  },
  {
    num: '03',
    label: 'RUN YOUR TOURNAMENT',
    desc: 'Enter scores from the sideline. Brackets advance live. Results are archived when it\'s over.',
  },
];
```

*Note: Step 01 description is nearly identical to the current one — the content was already
clear, only the label ("CONFIGURE NODE" → "SET UP YOUR LEAGUE") was the problem.*

---

### 5. Pricing Section — `app/page.tsx`

**Section eyebrow:**
```
BEFORE: "Access Tiers"
AFTER:  "Pricing"
```

**Section headline:**
```
BEFORE: "Select your operational level"
AFTER:  "Simple pricing. Start free."
```

**Section subheading:**
```
BEFORE: "Start at no cost. Upgrade as your organization scales. Every tier includes full platform access."
AFTER:  "Start for free — no credit card needed. Upgrade as your league grows."
```

**`components/PricingSection.tsx` — no changes needed.** Plan names (Starter, Pro, Elite),
feature labels, and pricing notes are already plain-language and clear. The CTAs
("Get Started Free", "Start Free Trial", "Contact Sales") are fine as-is.

---

### 6. Testimonials / Operator Logs — `app/page.tsx`

**Keep the bordered card format and left-border visual.** Remove the log-ID prefix from
attribution. The content is strong — only the framing changes.

**Section eyebrow:**
```
BEFORE: "Operator Reports"
AFTER:  "From the Field"
```

**Section headline:**
```
BEFORE: "Field-verified performance"
AFTER:  "Real results, real leagues"
```

**Attribution format (`OPERATOR_LOGS` array) — remove the `id` field from the rendered output:**

```tsx
// Updated OPERATOR_LOGS array — remove id from display
const OPERATOR_LOGS = [
  {
    id: 'OPS-001',   // keep as React key — do not render
    operator: 'Sarah M.',
    org: 'Regional Softball Association',
    entry: 'Bracket generation reduced from 3 hours to under 5 minutes. Coaches access live results directly — zero status requests to staff.',
  },
  {
    id: 'OPS-002',   // keep as React key — do not render
    operator: 'Kevin T.',
    org: 'City Youth Sports League',
    entry: 'Waitlist automation eliminated manual team-management overhead. Seat releases execute without staff intervention.',
  },
];
```

**Card attribution line (JSX change):**
```tsx
// BEFORE:
<div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
  {id} · {operator} · {org}
</div>

// AFTER (remove {id} and the separator after it):
<div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
  {operator} · {org}
</div>
```

---

### 7. Showcase — `app/page.tsx`

No changes. "Built for tournaments like Battle of the Bats" is already specific, human,
and grounded in a real organization. This section already speaks the right language.

---

### 8. Bottom CTA — `app/page.tsx`

**Headline — keep as-is:**
```
"Your tournament deserves a real platform."
```
This line is strong and already speaks directly to the organizer's pride. No change.

**Subheading:**
```
BEFORE: "Join organizations that have moved from spreadsheets to structured infrastructure."
AFTER:  "Join leagues that have moved on from spreadsheets."
```
*"Structured infrastructure" is engineering vocabulary. The meaning is identical without it.*

**Primary CTA:**
```
BEFORE: "Initialize Your Organization"
AFTER:  "Claim Your League"
```

**Secondary CTA — keep as-is:**
```
"Browse Tournaments" — already clear.
```

---

## Task Checklist

- [ ] Update hero eyebrow: `"System Operational"` → `"Live"` / `"Multi-tenant · v2.0"` → `"50+ Leagues Running"`
- [ ] Update hero subheading
- [ ] Update hero primary CTA: `"Initialize Your Organization"` → `"Claim Your League"`
- [ ] Update hero secondary CTA: `"View Live Systems →"` → `"See Live Tournaments →"`
- [ ] Update features eyebrow: `"System Capabilities"` → `"Platform Features"`
- [ ] Update features headline: `"Infrastructure for competition"` → `"Everything a tournament needs"`
- [ ] Update features subheading
- [ ] Update features table column headers: `ID/Capability/Specification` → `#/Feature/What it does`
- [ ] Replace `CAPABILITIES` array with updated content
- [ ] Update how-it-works eyebrow: `"Initialization Sequence"` → `"How It Works"`
- [ ] Update how-it-works headline: `"Operational in a single session"` → `"Up and running in a day"`
- [ ] Update how-it-works subheading
- [ ] Replace `STEPS` array with updated labels and descriptions
- [ ] Update pricing eyebrow: `"Access Tiers"` → `"Pricing"`
- [ ] Update pricing headline: `"Select your operational level"` → `"Simple pricing. Start free."`
- [ ] Update pricing subheading
- [ ] Update testimonials eyebrow: `"Operator Reports"` → `"From the Field"`
- [ ] Update testimonials headline: `"Field-verified performance"` → `"Real results, real leagues"`
- [ ] Remove `{id}` from testimonial attribution line JSX
- [ ] Update bottom CTA subheading
- [ ] Update bottom CTA primary button: `"Initialize Your Organization"` → `"Claim Your League"`

---

## Out of Scope (Deferred)

- `/discover` page — functional, data-driven, minimal marketing copy. No changes needed.
- Auth pages (`/auth/signup`, `/auth/login`) — page titles and form copy not audited yet.
  If signup page uses "Initialize your organization" as a heading, that should be updated
  in a follow-up pass.
- Error states (404, 500) — Phase 9 of the implementation plan covers these separately.
  The terminal/diagnostic tone there is appropriate and unchanged by this pivot.
- Admin HUD — explicitly out of scope. The operator metaphor is correct for that context.

---

## Decisions (Locked)

1. **Palette**: Keep Logic Lime (#D9F99D). No token changes.
2. **Capabilities table format**: Keep the structured table. Text changes only.
3. **Auth pages**: Out of scope for this plan. Landing page ships first — if approved,
   auth pages (`/auth/signup`, `/auth/login`) are the immediate next pass. See TODO.md.
