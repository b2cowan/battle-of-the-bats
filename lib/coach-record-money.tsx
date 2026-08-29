'use client';
/**
 * The hub → shared-form wire for the ONE recording conversation (money centralization P1/P2,
 * owner-approved spec 2026-08-22 — frames A–D — as amended by the P2 gate rulings, 2026-08-23).
 *
 * The conversation LIVES in the shared money form (`accounting/expenses/panel.tsx`) because that
 * form is the thing the plan says to grow, and everything it needs — the taxonomy, the tag
 * library, the save paths — is already there. But its doors are all over the hub: the Record
 * button in the page header, a family's row on Player Dues, a player's row on a drive. This
 * context is how any of them reaches the form:
 *
 *  - `openNonce` — monotonic; each request bumps it. The Transactions instance of the shared panel
 *    (exactly one face listens, or two modals would open) opens the conversation on change. The hub
 *    also marks the transactions panel visited in the same press, so the panel exists to hear it —
 *    mounted `display:none`, with the modal PORTALED to the warm marker so a hidden panel can still
 *    put the form on screen.
 *  - `intent` — WHAT to open it on, read at the same nonce. Carries the branch, the ids the door
 *    already knows, and (when the door named one RECORD rather than one screen) the locked sentence
 *    to state instead of offering.
 *  - `summary` — the hub's own MoneySummary, so the chooser's live hints ("$500 owed", "1 family
 *    in credit") read from data the hub ALREADY loads. ⚠ Never replace this with a fresh fetch on
 *    open: the build prompt's §2.8 names a per-open probe fan-out as a regression.
 *  - `request` — what a door CALLS. ⚠ ONE SIGNAL, NOT A SECOND CHANNEL (P2 build prompt §3): the
 *    doors that live on other panels — the dues drawer, a drive's leaderboard — cannot reach the
 *    expenses panel's own functions, and inventing a second wire for them is how two ways to open
 *    one form start to drift.
 *
 * ⚠ The hook returns null outside the provider rather than throwing: the shared panel must keep
 * working anywhere it is mounted without a hub around it — it just loses the hub door and hints.
 */
import { createContext, useContext } from 'react';
import type { MoneySummary } from './coach-money-summary';

/**
 * The eight answers to "What happened?", as the conversation's own table names them.
 *
 * ⚠ THE TYPE LIVES HERE, THE COPY LIVES IN THE PANEL. A door says which branch it wants; what that
 * branch is CALLED, what its sub-line reads and which writer it submits through are the form's
 * business. Moving the whole table here would put money copy in a context module and make every
 * door a place the wording could drift.
 */
export type ConversationBranch =
  | 'dues' | 'drive' | 'sponsor' | 'refund' | 'other-in'
  | 'spend' | 'club' | 'payout';

/**
 * What a door has already answered on the coach's behalf.
 *
 * ⚠⚠ `lock` IS THE OWNER'S A-RULING (2026-08-23): *a door that names one RECORD locks; a door that
 * names a SCREEN only suggests.* Standing on Jenny's row and switching the question to "we paid for
 * something" saved money against dome rentals while nothing on the screen in front of the coach
 * changed — a ghost save. So a row's answers are STATED, not offered, and the hub button's
 * tab-shaped guess stays changeable. Absent `lock`, everything is editable.
 */
export interface RecordMoneyIntent {
  branch: ConversationBranch;
  /**
   * Present = this door named one record. `subject` is the thing itself (a player, a drive and a
   * player, a bill); `detail` is the quiet second line — what they owe, where it came from.
   * The form composes the sentence from the branch's own name plus these, so eight doors cannot
   * produce eight phrasings of one fact.
   */
  lock?: { subject: string; detail?: string };
  /** The branch's own answers, pre-filled. Only the keys that branch reads are ever set. */
  ids?: {
    duesPlayerId?: string;
    driveId?: string;
    drivePlayerId?: string;
    payoutPlayerId?: string;
    spendExpenseId?: string;
    /** ALLOCATION, not identity — stays editable even under a lock (owner ruling A). */
    spendInstallmentId?: string;
    /**
     * An EXISTING sponsor (mig 268 arrivals): the record page's Record door. Locked, the sponsor
     * branch records an ARRIVAL against this record — amount, date, method — earning the stored
     * credit plan's families as the money lands, instead of creating a new sponsor.
     */
    sponsorId?: string;
  };
  /** A suggested amount the door already knows (what a family is holding, what a bill has left). */
  amount?: string;
}

export interface RecordMoneySignal {
  summary: MoneySummary | null;
  /** 0 = never pressed. Bumped by each request. */
  openNonce: number;
  /** What the request at `openNonce` was for. Null = the cold open: nothing answered. */
  intent: RecordMoneyIntent | null;
  /** Open the recording conversation. Called by every door outside the shared money panel. */
  request: (intent?: RecordMoneyIntent) => void;
}

const RecordMoneyContext = createContext<RecordMoneySignal | null>(null);

export const RecordMoneyProvider = RecordMoneyContext.Provider;

export function useRecordMoneySignal(): RecordMoneySignal | null {
  return useContext(RecordMoneyContext);
}
