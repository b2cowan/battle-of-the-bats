/**
 * Plan templates — the practice shape a coach saves and starts from again (Phase 3, mig 221).
 *
 * ⚠ **THE ONE RULE THIS FILE EXISTS TO HOLD — a template is SCAFFOLDING, a drill is an IDENTITY.**
 * They sit one screen apart in the plan editor and their rules are opposites. A session that
 * "makes them consistent" breaks one of them:
 *
 * |                | A TEMPLATE                          | A DRILL                                  |
 * |----------------|-------------------------------------|------------------------------------------|
 * | On load        | copy-on-load, **fully editable**    | **read-only**; editing DETACHES it       |
 * | Its provenance | KEPT through every edit             | CLEARED the moment a word changes        |
 * | Its count says | "this template started 8 plans"     | "these 8 plans contain *this same drill*"|
 *
 * ⚠ **`templateToPlan` MUST PRESERVE EACH STATION'S `drillId`.** Stripping it would make every
 * drill-backed station in a loaded template arrive editable and would silently break every drill's
 * count — and nothing would fail loudly. That is the seam frame 06 of the mockups draws.
 *
 * ⚠ **A template carries NO PEOPLE** (D20, one level up from a drill). No players, no staff, no
 * rotation groups, no "just for tonight". The template supplies the shape and the teaching; the
 * practice supplies the people and the moment. That is what lets one template work in April with
 * twelve and July with nine — and it keeps the "people live at exactly one level" invariant intact.
 *
 * ⚠ **PLANS, never practices.** "Started 8 plans", never "used 8×": nothing records what was
 * actually run (D4), so "used" would be a claim the data cannot support.
 *
 * ⚠ **No ranking, ever (§4).** Templates sort by NAME, never by use — the library must not quietly
 * tell a coach which of their own ideas is best. Nothing here counts, scores or orders a child.
 */
import {
  MAX_TITLE_LEN, PRACTICE_PLAN_VERSION, newPracticePlanId, sanitizePracticePlan,
  totalPlannedMinutes,
  type PracticePlan, type PracticePlanBlock, type PracticeStation,
} from './rep-practice-plan';
import { MAX_TAGS_PER_ITEM, uniqueIds } from './rep-drills';
import type { RepTeamPlanTemplate } from './types';

export type { RepTeamPlanTemplate, RepTeamPlanTemplateWithUsage } from './types';

/** Matches the `rep_team_plan_templates.name` CHECK in mig 221. */
export const MAX_TEMPLATE_NAME_LEN = 120;
/** How many ACTIVE templates one team may keep. Retire one to add another, as the drill library. */
export const MAX_TEMPLATES_PER_TEAM = 60;

/** The editable half of a template — what the create and update routes accept. */
export interface PlanTemplateInput {
  name: string;
  /** Tag ids from the team's 'focus' vocabulary. ⚠ IDs, not names — minting is an explicit act. */
  tagIds?: string[] | null;
  /** The plan SHAPE. Always run through `planToTemplateShape` before it reaches storage. */
  plan?: PracticePlan | null;
}

/**
 * Validate a template payload from the room or from "Save as template…".
 *
 * ⚠ **An empty NAME is rejected — and that asymmetry with the plan editor is deliberate, not an
 * inconsistency.** A template is created by an explicit, deliberate submit, so a nameless one is a
 * mistake worth reporting. A plan's block or station exists because the coach pressed "Add" and is
 * mid-typing under autosave, so discarding it would be data loss (§10.5). The distinguishing fact
 * is whether a human pressed a button.
 */
export function validatePlanTemplateInput(input: unknown): { template: PlanTemplateInput } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Invalid template.' };
  const raw = input as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_TEMPLATE_NAME_LEN) : '';
  if (!name) return { error: 'Give the template a name.' };

  return {
    template: {
      name,
      tagIds: uniqueIds(raw.tagIds, MAX_TAGS_PER_ITEM),
      // `undefined` (key absent) means "not editing the shape" — a rename must not blank a
      // template's blocks. `null` and a malformed body both collapse to an empty shape below.
      plan: raw.plan === undefined ? undefined : planToTemplateShape(raw.plan),
    },
  };
}

/** Strip a station down to what a TEMPLATE may carry. The drill half rides along untouched. */
function stationForTemplate(station: PracticeStation): PracticeStation {
  const next: PracticeStation = { ...station };
  // ── The PRACTICE half — the people and the moment, which belong to a practice, never here ──
  delete next.staff;
  // ⚠ mig 266's id-backed picker is the SAME "people" concept as `staff` above, just a different
  // storage — stripping the name and leaving the id would silently smuggle a specific person (a
  // real tag id, still resolvable to a name) into every practice this template is loaded onto.
  delete next.staffTagIds;
  delete next.playerIds;
  delete next.note;         // "just for tonight" — the one field that must never travel either way
  delete next.rotationNote;
  // ⚠ `drillId` and `drillTags` deliberately SURVIVE. A template's stations keep pointing at the
  // drills they came from, so loading one hands the coach the same read-only, still-counted drill
  // stations they picked when they saved it. Stripping them here is the silent-breakage path.
  // ⚠ `equipment`/`equipmentTagIds` deliberately SURVIVE too — kit is part of the SHAPE a template
  // carries (what to bring), not people; only staff is an identity claim here.
  return next;
}

/** Strip a block down to what a TEMPLATE may carry. */
function blockForTemplate(block: PracticePlanBlock): PracticePlanBlock {
  const next: PracticePlanBlock = { ...block };
  delete next.staff;
  delete next.staffTagIds;  // see stationForTemplate — same "people, not shape" reasoning
  delete next.playerIds;
  if (next.stations) next.stations = next.stations.map(stationForTemplate);
  // A rotation's SHAPE is worth keeping — how often groups move is part of how the practice runs.
  // Its GROUPS are people, so they go, and the plan the template produces draws fresh ones.
  if (next.rotation) next.rotation = { ...next.rotation, groups: [], groupSource: 'manual' };
  return next;
}

/**
 * Turn anything plan-shaped into what a template stores: sanitised, then emptied of people.
 *
 * Runs the shared plan sanitiser FIRST so a template's jsonb obeys exactly the same caps and
 * invariants as a practice's — one shape, one set of rules, so a template can never load into a
 * plan that the plan's own sanitiser would then reject.
 *
 * ⚠ `templateId` is dropped: a template saved from a plan that itself came from a template is a
 * new template, not a reference to the old one.
 */
export function planToTemplateShape(input: unknown): PracticePlan {
  const plan = sanitizePracticePlan(input);
  if (!plan) return { version: PRACTICE_PLAN_VERSION, blocks: [] };
  const next: PracticePlan = { ...plan, blocks: plan.blocks.map(blockForTemplate) };
  delete next.templateId;
  delete next.templateName;
  return next;
}

/**
 * Load a template onto a practice: fresh ids throughout, provenance stamped, fully editable.
 *
 * ⚠ **Every station's `drillId` and `drillTags` survive** — see the module header. A drill-backed
 * station in a loaded template arrives read-only and still counts toward its drill, exactly as it
 * did on the practice the template was saved from.
 *
 * ⚠ The template NAME is snapshotted alongside the id, so the provenance line keeps reading after
 * a rename or a retire — the same reason `drillTags` snapshots names rather than ids.
 *
 * ⚠ It carries no people by construction (the shape was emptied on save), so there is nothing to
 * re-check against the roster: a template can never smuggle a player who left in September into a
 * plan written in October.
 */
export function templateToPlan(
  template: Pick<RepTeamPlanTemplate, 'id' | 'name' | 'plan'>,
  newId: () => string = newPracticePlanId,
): PracticePlan {
  const shape = planToTemplateShape(template.plan);
  return {
    ...shape,
    templateId: template.id,
    templateName: template.name.slice(0, MAX_TITLE_LEN),
    blocks: shape.blocks.map(block => ({
      ...block,
      id: newId(),
      stations: block.stations?.map(s => ({ ...s, id: newId() })),
      rotation: block.rotation ? { ...block.rotation, groups: [] } : block.rotation,
    })),
  };
}

/** What a plan template's row says about itself, for the room's meta line. */
export interface TemplateUse {
  planCount: number;
  lastPlannedAt: string | null;
}

/**
 * How many PLANS each template has started, and when the most recent one was.
 *
 * A separate walk from `countDrillUses` rather than a generalisation of it, deliberately: that one
 * counts STATIONS inside a plan and this counts PLANS, so folding them together would need a
 * key-extractor that returns zero-or-many and would make neither call site readable.
 *
 * ⚠ "last planned", never "last run" — the date of the practice the plan was written FOR, which is
 * the only date this data actually knows (D4).
 */
export function countTemplateUses(
  plans: readonly { plan: PracticePlan | null; startsAt: string | null }[],
): Map<string, TemplateUse> {
  const uses = new Map<string, TemplateUse>();
  for (const { plan, startsAt } of plans) {
    const id = plan?.templateId;
    if (!id) continue;
    const seen = uses.get(id);
    if (!seen) {
      uses.set(id, { planCount: 1, lastPlannedAt: startsAt });
      continue;
    }
    seen.planCount += 1;
    // Newest wins, whatever order the caller walked in — a caller that sorts ascending must not
    // silently produce "last planned" = the oldest practice.
    if (startsAt && (!seen.lastPlannedAt || startsAt > seen.lastPlannedAt)) seen.lastPlannedAt = startsAt;
  }
  return uses;
}

/**
 * The meta line under a template's name — "90 min · 5 blocks · Started 8 plans · last planned …".
 *
 * ⚠ Zero is rendered as **"Not started a plan yet"** in words, never a bare 0, so an unused
 * template does not read as a failing score. Same rule as the drill library's "Not in a plan yet".
 */
export function templateUseLabel(planCount: number): string {
  return planCount > 0
    ? `Started ${planCount} plan${planCount === 1 ? '' : 's'}`
    : 'Not started a plan yet';
}

/**
 * One activity-free summary of a template's shape: total planned minutes and block count.
 *
 * Derived rather than stored, so it can never drift from the blocks — the same reason
 * `summarizePracticePlan` derives its own line.
 */
export function templateShapeLabel(plan: PracticePlan): string {
  const blocks = plan.blocks.length;
  // ⚠ `totalPlannedMinutes`, never a second reducer. An earlier draft inlined a character-identical
  // copy of it — which is two definitions of "planned minutes" in two files with nothing linking
  // them, so the day "rest of practice" stops contributing zero, only one of them would learn.
  const minutes = totalPlannedMinutes(plan);
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} min`);
  parts.push(`${blocks} block${blocks === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
