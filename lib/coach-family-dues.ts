// Family dues rollup — "What does each family still owe?" — PURE, no I/O, no React.
//
// Ask the Front Office, Phase A (ASK_FRONT_OFFICE_PLAN.md). Dues are stored PER PLAYER; a coach
// chasing money thinks per FAMILY. Two siblings on one roster are one conversation and one
// e-transfer, so an answer that lists them separately is arithmetically right and practically
// wrong — it tells the coach to ask the same parent twice.
//
// ── The grouping key ─────────────────────────────────────────────────────────
// The guardian's email, normalized by `lib/guardian-email.ts` — the platform's de-facto family
// identity across tables that hold no account (Chunk D substrate). A player with NO guardian
// contact recorded is their OWN family: nothing links them to anyone, and guessing from a shared
// surname would merge two unrelated Nguyens on the same team.
//
// ── The label, and the capability seam (owner ruling 2026-08-02) ─────────────
// Grouping happens here, on the server, from the guardian email. The LABEL is what changes for a
// coach who has money access but not guardian PII: they get the players' own names — which they
// already see on every roster screen — instead of the family surname. Siblings still roll up
// correctly for them; only the words change. Counts-only was considered and rejected as useless,
// and refusing outright as needlessly strict. The caller decides by passing `guardianLastName`
// (already redacted upstream) — this module never sees a name it isn't allowed to print.
//
// Relative imports WITH the .ts extension so the unit tests run under plain `node --test`.

/** One player's dues, already redacted for the caller by the route. */
export interface FamilyDuesPlayer {
  playerId: string;
  /** Display name for the player, e.g. "Maya R." — roster basics, never PII. */
  playerName: string;
  /** Normalized guardian email = the family key. null when no contact is recorded. */
  guardianKey: string | null;
  /** Guardian surname, or null when absent OR when the caller may not see it. */
  guardianLastName: string | null;
  /** Schedule total minus paid installments, as the dues route computes it. */
  outstanding: number;
  installments: { dueDate: string; amount: number; paidAt: string | null; remainingAmount?: number }[];
}

/** One unpaid installment, positioned within its player's own schedule. */
export interface FamilyDuesInstallment {
  playerId: string;
  playerName: string;
  dueDate: string;
  amount: number;
  /** 1-based position in that player's schedule, ordered by due date. */
  index: number;
  /** How many installments that player's schedule has in total. */
  total: number;
  overdue: boolean;
}

export interface FamilyDuesGroup {
  /** Stable identity for the group — the guardian key, or the player id when there is none. */
  key: string;
  /** How a SENTENCE names this family: "the Marches" / "Maya and Sam's family". */
  label: string;
  /** How a RECEIPT LINE names it: "March family" / "Maya and Sam". A list column wants a noun,
   *  not the article and verb agreement a sentence needs. */
  receiptLabel: string;
  playerNames: string[];
  outstanding: number;
  /** Unpaid installments across the whole family, earliest due date first. */
  unpaid: FamilyDuesInstallment[];
  /** True when this group's label came from player names rather than a guardian surname. */
  labelledByPlayer: boolean;
}

export interface FamilyDuesRollup {
  /** Families that still owe, most owed first. */
  owing: FamilyDuesGroup[];
  /** Families with a dues schedule and nothing left to pay. */
  paidUpCount: number;
  /** Families with any dues arrangement at all — the honest denominator. */
  familyCount: number;
  totalOutstanding: number;
}

/**
 * Standard English pluralization of a family surname: "March" → "the Marches", "Okari" → "the
 * Okaris", "Ramos" → "the Ramoses". Surnames never take the y→ies rule ("the Kellys"), which is
 * why this is deliberately not a general-purpose pluralizer.
 */
export function familyPlural(surname: string): string {
  const s = surname.trim();
  if (!s) return '';
  return /(?:s|x|z|ch|sh)$/i.test(s) ? `${s}es` : `${s}s`;
}

/** "Maya" / "Maya and Dev" / "Maya, Dev and Sam" — the fallback family label. */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** First name only — the family label reads as speech, not as a roster row. */
function firstNameOf(displayName: string): string {
  // Display names may carry a jersey prefix ("#7 Maya R."); the number is not part of a name.
  const withoutJersey = displayName.replace(/^#\S+\s*/, '').trim();
  return withoutJersey.split(/\s+/)[0] || withoutJersey;
}

export interface FamilyDuesInput {
  players: FamilyDuesPlayer[];
  /** Today, `YYYY-MM-DD`, in the org's zone — midnight-truncated, so an installment due today is
   *  not overdue yet. Same semantics as the Overview dues tile and `isInstallmentOverdue`. */
  todayISO: string;
}

/**
 * Roll per-player dues up to families, ordered by who owes most.
 *
 * Players with no dues arrangement at all (no schedule, nothing outstanding) are excluded
 * entirely — they are not a family that has "paid up", they are a family that was never billed,
 * and counting them would inflate the reassuring half of the sentence.
 */
export function computeFamilyDues(input: FamilyDuesInput): FamilyDuesRollup {
  const { players, todayISO } = input;

  const billed = players.filter(p => (p.installments?.length ?? 0) > 0 || (p.outstanding ?? 0) > 0);

  const groups = new Map<string, FamilyDuesGroup & { surnames: Set<string> }>();

  for (const p of billed) {
    const key = p.guardianKey ?? `player:${p.playerId}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, label: '', receiptLabel: '', playerNames: [], outstanding: 0, unpaid: [], labelledByPlayer: false, surnames: new Set() };
      groups.set(key, g);
    }
    g.playerNames.push(p.playerName);
    g.outstanding += p.outstanding ?? 0;
    if (p.guardianLastName) g.surnames.add(p.guardianLastName.trim());

    // Position each installment inside that player's OWN schedule — "2 of 3" is a fact about the
    // player's plan, not about the family's combined list.
    const ordered = [...(p.installments ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    ordered.forEach((inst, i) => {
      if (inst.paidAt) return;
      // What a family still owes on an open installment is its REMAINDER (mig 232) — quoting the
      // face value to a family part-way through paying is the defect the remainder ruling closed
      // everywhere else. Fully covered remainders have nothing to list.
      const owed = inst.remainingAmount ?? inst.amount;
      if (owed <= 0.005) return;
      g!.unpaid.push({
        playerId: p.playerId,
        playerName: p.playerName,
        dueDate: inst.dueDate,
        amount: owed,
        index: i + 1,
        total: ordered.length,
        overdue: !!inst.dueDate && inst.dueDate < todayISO,
      });
    });
  }

  for (const g of groups.values()) {
    g.outstanding = Math.round(g.outstanding * 100) / 100;
    g.unpaid.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.playerName.localeCompare(b.playerName));

    // ONE recorded surname for the whole group ⇒ name the family. Two different surnames under one
    // guardian email is a real household (blended families, different last names), and picking one
    // would be naming a family something nobody in it is called — so those fall back to players too.
    const surname = g.surnames.size === 1 ? [...g.surnames][0] : null;
    if (surname) {
      g.label = `the ${familyPlural(surname)}`;
      g.receiptLabel = `${surname} family`;
      g.labelledByPlayer = false;
    } else {
      const names = joinNames(g.playerNames.map(firstNameOf));
      g.label = `${names}'s family`;
      g.receiptLabel = names;
      g.labelledByPlayer = true;
    }
  }

  // Rebuilt field by field rather than spread-minus-`surnames`: the working set is internal
  // bookkeeping, and an explicit projection means adding a private field later can't leak it.
  const all: FamilyDuesGroup[] = [...groups.values()].map(g => ({
    key: g.key,
    label: g.label,
    receiptLabel: g.receiptLabel,
    playerNames: g.playerNames,
    outstanding: g.outstanding,
    unpaid: g.unpaid,
    labelledByPlayer: g.labelledByPlayer,
  }));
  const owing = all
    .filter(g => g.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.label.localeCompare(b.label));

  return {
    owing,
    paidUpCount: all.length - owing.length,
    familyCount: all.length,
    totalOutstanding: Math.round(owing.reduce((s, g) => s + g.outstanding, 0) * 100) / 100,
  };
}
