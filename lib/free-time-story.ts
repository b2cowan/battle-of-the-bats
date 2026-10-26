import { consoleDay } from './console-dates';
import { overrideWhat, sectionLabel } from './platform-labels';
import { possessive } from './utils';
import { earliestLastDay, formatLongDay, formatShortDay, isGrantRunning, lastDayOfInstant } from './free-time';
import { isFoundingSeasonCompExpiry } from './plan-config';
import { obj, planName, putBackOf, str, whyFields, type AuditRow, type PutBack, type StoryEntry } from './platform-story-view';

/**
 * Free time on a club's Story (Support console Stage 4; drawings 5eawvGUPwQVPoWiAV7vQY5, B1 and F7). Pure: the Story
 * builder (`lib/platform-story.ts`) reads the rows and hands them here.
 *
 * Given, changed (from what to what), ended early, ended by itself (The product, worked out from the date, nothing
 * stored). Founding Season reads as its own entry and never carries Put it back (its access is the club's plan, not a
 * grant, until its turn-off decision: owner ruling Q4). Put it back sits ONLY on the newest entry of a grant still
 * running: on "given" it ends it now; on "changed" it restores the earlier last day, or ends it now when that day has
 * passed (T10). A comp period that is not Founding Season reads as it always has (owner ruling Q5).
 */

const THE_PRODUCT = 'The product';

export type FreeTimeStoryRow = {
  id: string; type: string; value: string | null; target: { addons?: string[]; plan?: string } | null; starts_at: string | null; expires_at: string | null;
  reason: string | null; created_by: string | null; created_at: string; revoked_at: string | null; revoked_by: string | null;
};

export function freeTimeStoryEntries(input: {
  org: { name: string; plan_id: string | null };
  overrides: FreeTimeStoryRow[];
  /** The club's audit entries, newest first (the Story's own read). */
  audit: AuditRow[];
  /** Entries already put back, and when (an undone entry is marked, never edited). */
  putBackAt: Map<string, string>;
  now?: Date;
}): StoryEntry[] {
  const { org, audit, putBackAt } = input;
  const entries: StoryEntry[] = [];
  const markPutBack = (entry: StoryEntry, offer: PutBack | null) => {
    const done = putBackAt.get(entry.key);
    if (done) entry.putBackAt = done;
    else if (offer) entry.putBack = offer;
  };
  // Support console Stage 4: given, changed (from what to what), ended early, ended by itself (The product, worked out
  // from the date, nothing stored). Founding Season reads as its own entry and never carries Put it back. Put it back
  // sits only on the NEWEST entry of a grant still running: on "given" it ends it now; on "changed" it restores the
  // earlier last day. A comp period that is not Founding Season reads as it always has (owner ruling Q5).
  const revokeReasons = new Map<string, unknown>();
  for (const r of audit) if (r.action === 'revoke_override' && typeof r.old_value === 'string') revokeReasons.set(r.old_value, r.new_value);
  const changesByGrant = new Map<string, AuditRow[]>();
  for (const r of [...audit].reverse()) {
    if (r.action !== 'change_override_end') continue;
    const grant = str(obj(r.new_value)?.override_id);
    if (!grant) continue;
    changesByGrant.set(grant, [...(changesByGrant.get(grant) ?? []), r]);
  }
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const ownPlan = planName(org.plan_id);
  const short = (iso: string) => formatShortDay(lastDayOfInstant(iso));
  for (const o of input.overrides) {
    const running = isGrantRunning(o, now);
    const ranOut = !o.revoked_at && !!o.expires_at && Date.parse(o.expires_at) <= nowMs;

    if (o.type === 'comp_period' && o.expires_at && isFoundingSeasonCompExpiry(o.expires_at)) {
      entries.push({
        key: `override:${o.id}`, at: o.created_at, kind: 'billing',
        title: `Founding Season: ${ownPlan} free through ${short(o.expires_at)}`,
        sub: org.plan_id === 'team' ? 'Given at checkout' : 'Given at sign-up', who: THE_PRODUCT, why: null,
      });
      if (o.revoked_at) {
        entries.push({ key: `override-ended:${o.id}`, at: o.revoked_at, kind: 'billing', title: 'Founding Season ended', who: o.revoked_by ?? 'Staff', ...whyFields(revokeReasons.get(o.id), false) });
      } else if (ranOut) {
        entries.push({ key: `override-ran-out:${o.id}`, at: o.expires_at, kind: 'billing', title: 'Founding Season ended by itself', who: THE_PRODUCT, why: null });
      }
      continue;
    }

    if (o.type === 'comp_period') {
      const what = overrideWhat(o.type, o.value, []);
      const ends = o.expires_at ? `until ${consoleDay(o.expires_at)}` : 'no end date';
      entries.push({ key: `override:${o.id}`, at: o.created_at, kind: 'staff', title: `Override applied: ${what}`, sub: running ? `Running, ${ends}` : ends, who: o.created_by ?? 'Staff', why: o.reason ?? null, whyNotRecorded: !o.reason });
      if (o.revoked_at) entries.push({ key: `override-ended:${o.id}`, at: o.revoked_at, kind: 'staff', title: `Override ended: ${what}`, who: o.revoked_by ?? 'Staff', ...whyFields(revokeReasons.get(o.id), true) });
      else if (ranOut) entries.push({ key: `override-ran-out:${o.id}`, at: o.expires_at!, kind: 'staff', title: `Override ran out: ${what}`, who: THE_PRODUCT, why: null });
      continue;
    }

    const isPlan = o.type === 'plan_tier';
    const subject = isPlan ? planName(o.target?.plan)
      : o.type === 'module_addon' ? ((o.target?.addons ?? []).map(sectionLabel).join(', ') || 'Sections')
      : `Billing status: ${(o.value ?? 'active').replace(/_/g, ' ')}`;
    const back = isPlan ? `Back to ${ownPlan}` : undefined;
    const changes = changesByGrant.get(o.id) ?? [];
    const originalEnd = (typeof changes[0]?.old_value === 'string' ? changes[0].old_value : null) ?? o.expires_at;

    const given: StoryEntry = {
      key: `override:${o.id}`, at: o.created_at, kind: 'staff',
      title: originalEnd ? `Free time given: ${subject} through ${short(originalEnd)}` : `Free time given: ${subject}`,
      sub: isPlan ? `Then back to ${ownPlan} by itself` : undefined,
      who: o.created_by ?? 'Staff', why: o.reason ?? null, whyNotRecorded: !o.reason,
    };
    const newestChange = changes.at(-1) ?? null;
    markPutBack(given, running && !newestChange && o.expires_at ? {
      kind: 'override',
      title: `End ${possessive(org.name)} free time now`,
      sentence: `${possessive(org.name)} ${subject} free time ends now instead of on ${formatLongDay(lastDayOfInstant(o.expires_at))}.${isPlan ? ` It goes back to ${ownPlan} at once.` : ''} Nothing is deleted.`,
      overrideId: o.id,
    } : null);
    entries.push(given);

    for (const c of changes) {
      const to = str(obj(c.new_value)?.expires_at);
      const from = typeof c.old_value === 'string' ? c.old_value : null;
      if (!to || !from) continue;
      const entry: StoryEntry = {
        key: `audit:${c.id}`, at: c.created_at, kind: 'staff',
        title: `${putBackOf(c.new_value) ? 'Put back: ' : ''}Free time changed: ${subject} now free through ${short(to)}`,
        sub: `Was through ${short(from)}`, who: c.actor_email ?? 'Staff', ...whyFields(c.new_value, true),
      };
      // The newest change of a running grant restores the day before it (or ends it now, when that day has passed).
      if (c === newestChange && running && o.expires_at) {
        const earlier = lastDayOfInstant(from);
        const passed = earlier < earliestLastDay(now);
        markPutBack(entry, {
          kind: 'override_end',
          title: passed ? `End ${possessive(org.name)} free time now` : `Put back the end of ${possessive(org.name)} free time`,
          sentence: passed
            ? `${possessive(org.name)} ${subject} free time ends now instead of on ${formatLongDay(lastDayOfInstant(o.expires_at))}: its earlier last day, ${formatLongDay(earlier)}, has passed.`
            : `${possessive(org.name)} ${subject} free time runs through ${formatLongDay(earlier)} again instead of ${formatLongDay(lastDayOfInstant(o.expires_at))}.`,
          overrideId: o.id,
          expectedExpiresAt: o.expires_at,
          lastDay: earlier,
        });
      } else {
        markPutBack(entry, null);
      }
      entries.push(entry);
    }

    if (o.revoked_at) {
      const revoke = revokeReasons.get(o.id);
      entries.push({
        key: `override-ended:${o.id}`, at: o.revoked_at, kind: 'staff',
        title: putBackOf(revoke) ? `Put back: free time ended: ${subject}` : `Free time ended early: ${subject}`,
        sub: back, who: o.revoked_by ?? 'Staff', ...whyFields(revoke, true),
      });
    } else if (ranOut) {
      entries.push({ key: `override-ran-out:${o.id}`, at: o.expires_at!, kind: 'staff', title: `Free time ended by itself: ${subject}`, sub: back, who: THE_PRODUCT, why: null });
    }
  }
  return entries;
}
