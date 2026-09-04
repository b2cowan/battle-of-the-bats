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
 * The answers that are NOT one of the eight — the "Not paid yet" rows, which hand the form over
 * to a setup form instead of recording money that moved (owner ruling, §135 walk 2026-09-03).
 *
 * ⚠ THEY ARE NOT BRANCHES AND MUST NOT BECOME ONE. A branch records an event on the books; these
 * two set up an obligation that has not happened yet, and the 2026-08-25 cap counts branches. A
 * door names one with `handOff` instead of `branch`.
 */
export type ConversationHandOff = 'pledge';

/**
 * The identity questions a branch can ask — *which one?*, in each branch's own words.
 *
 * ⚠⚠ THIS EXISTS SO A LOCK CAN BE PARTIAL (owner ruling, §135 walk 2026-09-03). Every identity
 * control on the form is gated by one of these keys, so a door that answered the EVENT but not the
 * WHO can name the one question it is leaving open — see `lock.asks`. A branch that hand-builds a
 * picker without a key is the one control the gate cannot hide, which is why the keys are a closed
 * union rather than a free string.
 */
export type IdentityQuestion =
  | 'dues-player'      // "Which player *" — whose bill a dues receipt lands on
  | 'drive'            // "Which drive *"  — which fundraiser the money was raised for
  | 'drive-player'     // "Which player *" — who raised it, off that drive's leaderboard
  | 'club-installment' // "Which installment *" — which club bill a settlement pays down
  | 'payout-family'    // "Which family *" — whose held credit is being handed back
  | 'sponsor'          // "Which sponsor?" — an existing sponsor, or one this cheque creates
  | 'spend-target';    // "What did this pay for? *" — a bill owed, or a budget item

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
  /**
   * ⚠ OPTIONAL SINCE §135, and exactly one of `branch`/`handOff` is meaningful. A door that names
   * a "Not paid yet" answer has no branch to name — the promise is not an event on the books.
   */
  branch?: ConversationBranch;
  /**
   * The hand-off answer this door opens on, instead of a branch. With `lock`, the answer is
   * STATED and cannot be selected away from — which is the whole difference between Fundraising's
   * "+ Pledge" door (it named what it is for) and picking the same answer inside Record (the coach
   * is still choosing, so every other answer stays one tap away).
   */
  handOff?: ConversationHandOff;
  /**
   * Present = this door named one record. `subject` is the thing itself (a player, a drive and a
   * player, a bill); `detail` is the quiet second line — what they owe, where it came from.
   * The form composes the sentence from the branch's own name plus these, so eight doors cannot
   * produce eight phrasings of one fact.
   *
   * ⚠⚠ `asks` IS THE PARTIAL LOCK (owner ruling, §135 walk 2026-09-03). A lock used to be
   * all-or-nothing: it stated the event AND hid every *which one?* on the form. That is right for a
   * door standing on one money record (a family's dues row, a sponsor), but it left the DRIVE ROOM
   * with nowhere to sit — the room names one drive, yet its Record still has to ask **which player
   * raised it**, and a full lock would hide that question and leave nobody to record for. So the
   * room was left fully switchable, and from inside "Chocolate sale" a coach could switch the answer
   * to *a sponsor came through* — or, far quieter, leave the answer alone and change the DRIVE — and
   * file money somewhere else while the room behind the modal never moved. The same ghost save the
   * A-ruling exists to prevent, one door further along.
   *
   * `asks` names the ONE identity question this door did not answer; every other question the
   * branch would ask stays stated. Absent, the lock hides them all, exactly as before.
   */
  lock?: {
    /** ⚠ EMPTY when the door names what the form is FOR rather than a record that exists — the
     *  Fundraising "+ Pledge" door, whose sponsor is the thing the coach is about to type. The
     *  band drops its dash rather than trailing one with nothing after it. */
    subject: string;
    detail?: string;
    asks?: IdentityQuestion;
  };
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
    /**
     * A NEW sponsor's typed name (owner, §121 walk, 2026-08-29): the pledge sheet's hand-off.
     * Opens the sponsor branch on "A new sponsor…" with this name pre-filled, so a coach who
     * started logging a promise and then said "actually, the cheque is in my hand" keeps their
     * typing — the same carry the bill form's hand-off makes, in the other direction. May be
     * empty (the door still lands on the unfolded new-sponsor form).
     */
    sponsorNewName?: string;
  };
  /** A suggested amount the door already knows (what a family is holding, what a bill has left). */
  amount?: string;
}

/* ⚰ `PledgeCarry` WAS DELETED HERE (owner ruling, §135 walk 2026-09-03). It carried a sponsor's
   name and amount ACROSS panels, from the conversation into a pledge sheet on Fundraising. Its own
   header argued the promise could not be a "What happened?" answer because the 2026-08-25 ruling
   capped that list at eight — but the cap governs the two MONEY groups, and a promise belongs to
   neither. It is a row in "Not paid yet" now, and the form is the conversation's own, so nothing
   travels between panels and there is nothing to carry. */

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
