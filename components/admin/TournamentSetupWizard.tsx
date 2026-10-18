'use client';
/**
 * NEW TOURNAMENT — ONE WINDOW FOR EVERY DOOR (Tournament admin redesign Stage 5, E1 and A47; hub v45, ruled 2026-10-10).
 *
 * The first run opens it after the plan page; the rail's +, the Tournaments list and every "Reuse this setup" door open
 * it through `SetupWizardOpener`. Before Stage 5 the first run had its own six-step wizard with its own answers (a
 * park's diamonds named "Lions Park — Diamond 1", a question nothing read) and this one asked only a street address,
 * so a three-diamond park scheduled as one lane (F25, F77, F79, F91).
 *
 * The kit's form window (`KitDialog`): full screen with ← on a phone, a 640 window at a desk, the live public-page
 * preview beside it at 1280 and wider (unchanged). Three steps and a review:
 *
 *   1 The tournament — name, dates, style, link, each marked required; the style is saved WITH the tournament in the
 *     one create step (F78: it used to be a second call whose failure was swallowed). Under one at a time (A23, A55) a
 *     name last year's finished event still holds is said as it is typed, with the year-bumped name one tap away.
 *   2 Divisions — a list of only this tournament's divisions (the walk §290 finding, round 3 ruled 2026-10-12;
 *     `lib/tournament-setup-divisions`). A "Division name" field with Add (or Enter) and, under it, the nine common
 *     divisions as "+ U11" suggestions, each leaving once its division is listed; then the shared form table, every row
 *     in (`allIn`: no tick), ONE FLAT LIST in the order added (owner, 2026-10-11: no "arbitrary groups"). At a desk Teams
 *     it holds sits in the row and the arrow opens the rest in place; on a phone a row opens its own window (the form
 *     table's one full-screen row). A division leaves by "Remove this division" at the end of its fields. None is
 *     allowed (the board's checklist asks); a mistake opens its division.
 *   3 Venues — one ticked list (the /design review): the club's Venue library for a plan that has one, "your venues"
 *     (each past venue once, with its diamonds — A51) for everyone else; "A new venue" opens the four things with a
 *     count, named "Diamond 1…N" in the sport's word (F77). The raw "every copy" search is gone (F79, S6-04).
 *   Review — each row a door back to its step; the welcome message a switch with its text. "Create the draft" makes the
 *     tournament, its style, divisions, venues (with their diamonds) and welcome in ONE request, which takes everything
 *     back if any part fails.
 *
 * Fees are not asked (optional, owner 2026-06-16). Before the steps, an organization with past events meets "Start
 * blank, or reuse" — left as it is today on the Tournament plan (the free tournament tier review owns it). Stage 4's
 * reuse step (D2) is the same window — and, since Stage 5 (E2, F33), so is "into this draft": the draft board's Start
 * from a past tournament opens the reuse step in a mode that fills THAT draft (no name, link or dates — the draft's stay;
 * the source a dropdown; the five areas; nothing it holds replaced). One reuse flow, three doors.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import type { Tournament, TournamentFormat } from '@/lib/types';
import TournamentStyleCards from './TournamentStyleCards';
import TournamentCreationPreview, {
  type PreviewOrg,
  type PreviewTournamentTheme,
} from './TournamentCreationPreview';
import { PRESETS, isThemePresetKey } from '@/lib/themes';
import { hasOrgVenueLibrary, hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { INVITE_BOARD_WORDS, LOCK_WORDS } from '@/lib/invite-only-words';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { tournamentToday, formatEventDateRange, endDateFollowingStart } from '@/lib/timezone';
import { TOURNAMENT_FORMAT_OPTIONS } from '@/lib/tournament-phase';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { Callout, ClubRow, ClubRowFrame, ClubRowList, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import VenueChooser, { type ChooserVenue } from '@/components/admin/tournament/VenueChooser';
import NewVenueSheet, { type NewVenueDraft } from '@/components/admin/tournament/NewVenueSheet';
import DivisionSheet, { DivisionFields } from '@/components/admin/tournament/DivisionSheet';
import FormTable, { type FormTableInRow } from '@/components/shared/FormTable';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { REUSE_WORDS } from '@/lib/after-event-words';
import { CREATE_STEPS, CREATE_WORDS as W, type CreateStep } from '@/lib/tournament-setup-words';
import {
  addDivisionRefusal, divisionMistakeFor, divisionsPayload, divisionTotals, holdsOpen, openDivision, removeDivision,
  setupDivision, suggestedDivisions, type SetupDivision,
} from '@/lib/tournament-setup-divisions';
import { nameForYear, sameTournamentName, slugForName } from '@/lib/tournament-name';
import { dedupePastVenues, facilityKindForSport, facilityNames, type PastVenueRow } from '@/lib/venue-facilities';
import styles from './TournamentSetupWizard.module.css';

type PastTournament = { id: string; name: string; year?: number | null; status?: string | null };

/** An event that holds a name or a link (any status but Archived) — read when the window opens. */
type LiveEvent = { id: string; name: string; slug: string | null; year: number | null; status: string | null };

type CloneCopiedCounts = {
  venues?: number;
  divisions?: number;
  pools?: number;
  slots?: number;
  rules?: number;
  resources?: number;
  welcome?: boolean;
  registrationFields?: number;
};

export type CreatedTournament = {
  id: string;
  name: string;
  slug: string;
  creationMethod?: 'blank' | 'reused_setup';
  sourceName?: string;
  copied?: CloneCopiedCounts;
  /** The reuse path's new draft, whole (the clone route returns it), so its board can open on it. */
  record?: Tournament;
};

type PreStepMode = 'choose' | 'clone-name' | 'into';

/** The draft "into this draft" fills. */
export type IntoDraft = { id: string; name: string; year: number | null };

type CloneNameForm = { name: string; slug: string; startDate: string; endDate: string; endPicked: boolean; autoSlug: boolean };
type CloneCopyOptionKey = 'structure' | 'venues' | 'registration' | 'publicPresence' | 'content';
type CloneCopyOptions = Record<CloneCopyOptionKey, boolean>;
type ReuseSetupWarning = { key: string; text: string };

/** The door that opened the wizard (product analytics). ⚠ Every value here must also be in the clone
 *  route's `SOURCE_SURFACES`, or that door records `unknown`. */
export type ReuseSetupSourceSurface =
  | 'sidebar_create'
  | 'manage_tournaments_new_button'
  | 'manage_tournaments_row'
  // Stage 5: the first run opens this same window after the plan page (E1).
  | 'first_run'
  // Stage 4's doors (D2, A19): the reuse step opens with the event already chosen.
  | 'finished_board'
  | 'summary'
  | 'past_tournaments_row'
  | 'tournament_record'
  | 'unknown';

type TournamentSetupWizardProps = {
  isOpen: boolean;
  orgSlug?: string;
  orgContactEmail?: string | null;
  /** Pass existing non-archived tournaments to enable the "Start blank, or reuse" pre-step. */
  existingTournaments?: PastTournament[];
  /** The event a door opened the reuse step FOR (Stage 4, D2): no "pick a source" behind it. */
  initialSource?: PastTournament | null;
  sourceSurface?: ReuseSetupSourceSurface;
  /** The org, for the desktop live preview (and its plan, for the Venue library). */
  previewOrg?: PreviewOrg | null;
  /** Whether this member may set tournament branding (the preview's swatches). */
  canManageBranding?: boolean;
  /** Whether the org's plan includes tournament cloning. */
  canClone?: boolean;
  /** The organization's sport — the venue step's word for a lane ("Diamond"). */
  sport?: string | null;
  /** "Into this draft" (Stage 5, E2): the reuse step fills this draft instead of making a new one. */
  into?: IntoDraft | null;
  /** "Into this draft" landed: the source it came from, and what came in. */
  onBroughtIn?: (result: { sourceName: string; copied?: CloneCopiedCounts }) => void | Promise<void>;
  onClose: () => void;
  onCreated: (tournament: CreatedTournament) => void | Promise<void>;
};

const DEFAULT_CLONE_COPY_OPTIONS: CloneCopyOptions = {
  structure: true, venues: true, registration: true, publicPresence: true, content: true,
};
/** The five areas, in the step's order; their words are /marketing's (`REUSE_WORDS.areas`). */
const REUSE_COPY_OPTION_KEYS: CloneCopyOptionKey[] = ['structure', 'venues', 'registration', 'publicPresence', 'content'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function todayValue() { return tournamentToday(); }

/** A new tournament's End date fills in this many days after its Start date (a three-day weekend). */
const END_AFTER_START_DAYS = 2;

function uniqueName(base: string, taken: readonly string[]) {
  if (!taken.some(t => sameTournamentName(t, base))) return base;
  let n = 2;
  while (taken.some(t => sameTournamentName(t, `${base} ${n}`))) n += 1;
  return `${base} ${n}`;
}

let divisionSeq = 0;
function nextDivisionId() { divisionSeq += 1; return `division-${divisionSeq}`; }


function getRepeatNameForm(t: PastTournament): CloneNameForm {
  const nextYear = (t.year ?? new Date().getFullYear()) + 1;
  const name = nameForYear(t.name, nextYear, t.year ?? null);
  return { name, slug: slugForName(name), startDate: '', endDate: '', endPicked: false, autoSlug: true };
}

function buildCloneApiOptions(options: CloneCopyOptions) {
  return {
    includeDivisions: options.structure,
    includePools: options.structure,
    includeSlots: options.structure,
    includeVenues: options.venues,
    includeBranding: options.publicPresence,
    includePublicPages: options.publicPresence,
    includeWelcome: options.content,
    includeRulesResources: options.content,
    includeRegistrationFields: options.registration,
    includeFeeSchedule: options.registration,
  };
}

function getReuseSetupWarnings(source: PastTournament | null, draftYear: number, options: CloneCopyOptions): ReuseSetupWarning[] {
  const warnings: ReuseSetupWarning[] = [];
  const WW = REUSE_WORDS.warning;
  const name = source?.name ?? '';
  const sourceYear = typeof source?.year === 'number' ? source.year : null;
  const yearGap = sourceYear && Number.isInteger(draftYear) ? draftYear - sourceYear : null;
  const sourceStatus = source?.status ?? null;
  const unfinished = sourceStatus === 'draft' || sourceStatus === 'active';
  if (sourceStatus === 'draft') warnings.push({ key: 'source_draft', text: WW.source_draft(name) });
  else if (sourceStatus === 'active') warnings.push({ key: 'source_active', text: WW.source_active(name) });
  if (yearGap !== null && yearGap > 1) warnings.push({ key: 'source_older_than_one_year', text: WW.source_older_than_one_year(name, yearGap) });
  else if (yearGap !== null && yearGap < 0) warnings.push({ key: 'draft_year_before_source', text: WW.draft_year_before_source(name) });
  if (options.registration && (unfinished || (yearGap !== null && yearGap >= 1))) warnings.push({ key: 'registration_setup_review', text: WW.registration_setup_review });
  if ((options.publicPresence || options.content) && (unfinished || (yearGap !== null && yearGap >= 1))) warnings.push({ key: 'public_content_review', text: WW.public_content_review });
  return warnings;
}

function statusLabel(status?: string | null) {
  if (!status) return 'Tournament';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function sourceRank(status?: string | null) {
  return status === 'completed' ? 0 : status === 'archived' ? 1 : status === 'active' ? 2 : status === 'draft' ? 3 : 4;
}

/** Which swatch reads as chosen — it must name the colours the phone beside it is ACTUALLY rendering. */
function resolveSelectedPreset(org: PreviewOrg, tournamentTheme: PreviewTournamentTheme | null): string | null {
  const ownTheme = tournamentTheme && (tournamentTheme.themePreset || tournamentTheme.themePrimary) ? tournamentTheme : null;
  const primary = ownTheme ? ownTheme.themePrimary : org.themePrimary;
  if (primary) return null;
  const preset = (ownTheme ? ownTheme.themePreset : org.themePreset) ?? 'platform';
  return isThemePresetKey(preset) ? preset : 'platform';
}

function describeTheme(org: PreviewOrg, tournamentTheme: PreviewTournamentTheme | null, inherits: boolean): string {
  const selected = resolveSelectedPreset(org, tournamentTheme);
  if (selected) return `Theme: ${PRESETS[selected].name}`;
  return inherits ? 'Theme: copied from the event you are reusing' : 'Theme: your organization’s own colours';
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong.');
  return data as T;
}

/** A venue the step can create from: one from the book (past / library), or one typed in this window. */
type PickedVenue =
  | { key: string; kind: 'past'; sourceVenueId: string; name: string; lanes: string[] }
  | { key: string; kind: 'library'; orgVenueId: string; name: string; lanes: string[] }
  | { key: string; kind: 'new'; draft: NewVenueDraft; name: string; lanes: string[] };

export default function TournamentSetupWizard({
  isOpen,
  orgSlug,
  existingTournaments,
  initialSource = null,
  sourceSurface = 'unknown',
  previewOrg = null,
  canManageBranding = false,
  canClone,
  sport = null,
  into = null,
  onBroughtIn,
  onClose,
  onCreated,
}: TournamentSetupWizardProps) {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const reuseTitleId = useId();
  const kind = facilityKindForSport(sport);
  const libraryPlan = Boolean(previewOrg && hasOrgVenueLibrary(previewOrg.planId));
  // An invite-only event (the free plan, a Premium coach's event) has no spots: the divisions step asks no team count
  // (the free tournament tier, 2026-10-16). The plan is the organization's, read where the step's plan reads are.
  const inviteOnly = runsInviteOnlyEvents(previewOrg?.planId);

  // ── Pre-step (choose / the reuse step) ──────────────────────────────────────────────────────────────
  const hasPast = Boolean(existingTournaments && existingTournaments.length > 0);
  const [preStep, setPreStep] = useState<PreStepMode | null>(hasPast ? 'choose' : null);
  const [cloneSource, setCloneSource] = useState<PastTournament | null>(null);
  const [cloneForm, setCloneForm] = useState<CloneNameForm>({ name: '', slug: '', startDate: '', endDate: '', endPicked: false, autoSlug: true });
  const [cloneOptions, setCloneOptions] = useState<CloneCopyOptions>(DEFAULT_CLONE_COPY_OPTIONS);
  const [cloneWorking, setCloneWorking] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const cloneTouched = useRef(false);
  const openedFromDoor = Boolean(initialSource && canClone);
  // "Into this draft": every other event is a source, newest finished first (the board offers it only when one exists).
  const intoSources = useMemo(
    () => (into ? [...(existingTournaments ?? [])].filter(t => t.id !== into.id)
      .sort((a, b) => (sourceRank(a.status) - sourceRank(b.status)) || ((b.year ?? 0) - (a.year ?? 0))) : []),
    [into, existingTournaments],
  );

  // ── The three steps ─────────────────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<CreateStep>('tournament');
  const [form, setForm] = useState({ name: '', slug: '', startDate: '', endDate: '', endPicked: false, format: 'round_robin_playoffs' as TournamentFormat });
  const [slugEdited, setSlugEdited] = useState(false);
  const [usedSuggestion, setUsedSuggestion] = useState(false);
  // Step 2: an empty list, the name field and the nine suggestions (round 3). A desk opens a row's fields in place; a
  // phone opens its window.
  const isPhone = useIsPhone(isOpen);
  const [divisions, setDivisions] = useState<SetupDivision[]>([]);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [divisionWindow, setDivisionWindow] = useState<{ id: string } | null>(null);
  /** The name field above the list, and why its last Add was refused (blank, or already listed). */
  const [typedDivision, setTypedDivision] = useState('');
  const [addRefusal, setAddRefusal] = useState('');
  const divisionField = useRef<HTMLInputElement>(null);
  /** The suggestions' row — a pressed one leaves it, and focus moves to the next one along. */
  const suggestionRow = useRef<HTMLDivElement>(null);
  /** The divisions Next (or a refused close) flagged: each one's red line shows while its mistake stands. */
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
  /** The row that last landed or moved, and a count — each new count replays its wash (the table's fade). */
  const [washed, setWashed] = useState<{ id: string; n: number } | null>(null);
  const [welcomeOn, setWelcomeOn] = useState(true);
  const [welcomeText, setWelcomeText] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [book, setBook] = useState<PickedVenue[]>([]);
  const [bookCaption, setBookCaption] = useState<Record<string, ChooserVenue>>({});
  const [bookFailed, setBookFailed] = useState(false);
  const [added, setAdded] = useState<PickedVenue[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [leaveAsk, setLeaveAsk] = useState(false);
  const touched = useRef(false);
  const addedSeq = useRef(0);

  // ── Public-page colours (the preview's swatches) ────────────────────────────────────────────────────
  const [chosenPreset, setChosenPreset] = useState<string | null>(null);
  const [sourceTheme, setSourceTheme] = useState<{ id: string; theme: PreviewTournamentTheme } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const past = Boolean(existingTournaments && existingTournaments.length > 0);
    cloneTouched.current = false;
    touched.current = false;
    /* eslint-disable react-hooks/set-state-in-effect -- the open window's reset */
    if (into) {
      setPreStep('into');
      setCloneSource(intoSources[0] ?? null);
    } else if (initialSource && canClone) {
      setPreStep('clone-name');
      setCloneSource(initialSource);
      setCloneForm(getRepeatNameForm(initialSource));
    } else {
      setPreStep(past ? 'choose' : null);
      setCloneSource(null);
      setCloneForm({ name: '', slug: '', startDate: '', endDate: '', endPicked: false, autoSlug: true });
    }
    setCloneOptions(DEFAULT_CLONE_COPY_OPTIONS);
    setCloneWorking(false);
    setCloneError('');
    setStep('tournament');
    setForm({ name: '', slug: '', startDate: '', endDate: '', endPicked: false, format: 'round_robin_playoffs' });
    setSlugEdited(false);
    setUsedSuggestion(false);
    setDivisions([]);
    setOpenRows(new Set());
    setDivisionWindow(null);
    setTypedDivision('');
    setAddRefusal('');
    setFlagged(new Set());
    setWashed(null);
    setWelcomeOn(true);
    setWelcomeText(null);
    setAdded([]);
    setTicked(new Set());
    setSheet(null);
    setSaving(false);
    setError('');
    setLeaveAsk(false);
    setChosenPreset(null);
    setSourceTheme(null);
    setEventsLoaded(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    // "Into this draft" asks no name and adds no venue here: nothing more to read.
    if (into) return;

    // The org's events (the name and link last year's still holds) and the venue book — the club's library for a plan
    // that has one, the venues past events used for everyone else (each once, with its diamonds).
    requestJson<Array<{ id: string; name: string; slug: string | null; year: number | null; status: string | null }>>(`/api/admin/tournaments${orgQuery}`)
      .then(rows => {
        const live = rows.filter(r => r.status !== 'archived').map(r => ({ id: r.id, name: r.name, slug: r.slug, year: r.year, status: r.status }));
        setLiveEvents(live);
        const year = new Date().getFullYear();
        const name = uniqueName(`${year} Tournament`, live.map(e => e.name));
        setForm(f => (f.name ? f : { ...f, name, ...(slugEdited ? {} : { slug: slugForName(name) }) }));
      })
      .catch(() => { /* the server still refuses a taken name at Create */ })
      .finally(() => setEventsLoaded(true));

    const venuesRead = libraryPlan
      ? requestJson<Array<{ id: string; name: string; address: string | null; facilities?: { name: string }[] }>>(`/api/admin/org/venues${orgQuery}`)
        .then(rows => rows.map(v => ({
          picked: { key: `library:${v.id}`, kind: 'library' as const, orgVenueId: v.id, name: v.name, lanes: (v.facilities ?? []).map(f => f.name) },
          row: { key: `library:${v.id}`, name: v.name, address: v.address, caption: W.libraryCaption((v.facilities ?? []).length, kind, v.address) },
        })))
      : requestJson<Array<PastVenueRow & { facilities?: { name: string }[] }>>(`/api/admin/venues?scope=past${orgParam}`)
        .then(rows => dedupePastVenues(rows).map(v => ({
          picked: { key: `past:${v.id}`, kind: 'past' as const, sourceVenueId: v.id, name: v.name, lanes: (v.facilities ?? []).map(f => f.name) },
          row: { key: `past:${v.id}`, name: v.name, address: v.address, caption: W.pastCaption((v.facilities ?? []).length, kind, v.sourceTournamentName) },
        })));
    venuesRead
      .then(rows => {
        setBook(rows.map(r => r.picked));
        setBookCaption(Object.fromEntries(rows.map(r => [r.row.key, r.row])));
        setBookFailed(false);
      })
      .catch(() => { setBook([]); setBookCaption({}); setBookFailed(true); });
  // Once per opening: the window mounts when a door opens it. Re-running on the event list's length wiped what was typed
  // when the list finished loading behind an open window (/review 2026-10-10).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The branding a reuse would carry over, so the preview paints the reused event in its own colours.
  useEffect(() => {
    const sourceId = cloneSource?.id;
    if (!isOpen || !sourceId) return;
    let cancelled = false;
    requestJson<PreviewTournamentTheme>(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(sourceId)}${orgParam}`)
      .then(b => { if (!cancelled) setSourceTheme({ id: sourceId, theme: { themePreset: b.themePreset ?? null, themePrimary: b.themePrimary ?? null, themeAccent: b.themeAccent ?? null } }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, cloneSource?.id, orgParam]);

  // ── A55: the name and link last year's finished event still holds ───────────────────────────────────
  const nameHolder = useMemo(
    () => (form.name.trim() ? liveEvents.find(e => sameTournamentName(e.name, form.name)) ?? null : null),
    [liveEvents, form.name],
  );
  const suggestion = useMemo(() => {
    if (!nameHolder) return null;
    const startYear = form.startDate ? Number(form.startDate.slice(0, 4)) : null;
    const base = nameHolder.year ?? new Date().getFullYear();
    let year = startYear && startYear > base ? startYear : base + 1;
    for (let tries = 0; tries < 5; tries += 1, year += 1) {
      const candidate = nameForYear(form.name, year, nameHolder.year);
      if (!liveEvents.some(e => sameTournamentName(e.name, candidate))) return candidate;
    }
    return null;
  }, [nameHolder, form.name, form.startDate, liveEvents]);
  const slugHolder = form.slug ? liveEvents.find(e => e.slug === form.slug) ?? null : null;

  if (!isOpen) return null;

  const touch = () => { touched.current = true; };

  function setName(name: string) {
    touch();
    setUsedSuggestion(false);
    setForm(f => ({ ...f, name, ...(slugEdited ? {} : { slug: slugForName(name) }) }));
  }

  function takeSuggestion() {
    if (!suggestion) return;
    touch();
    setUsedSuggestion(true);
    setForm(f => ({ ...f, name: suggestion, ...(slugEdited ? {} : { slug: slugForName(suggestion) }) }));
  }

  function setStartDate(startDate: string) {
    touch();
    setForm(f => {
      const { end: endDate, endPicked } = endDateFollowingStart({ end: f.endDate, endPicked: f.endPicked }, startDate, END_AFTER_START_DAYS);
      // An untouched "2026 Tournament" follows the year of its start date.
      const auto = /^\d{4} Tournament(?: \d+)?$/.test(f.name);
      if (!startDate || !auto) return { ...f, startDate, endDate, endPicked };
      const name = uniqueName(`${startDate.slice(0, 4)} Tournament`, liveEvents.map(e => e.name));
      return { ...f, startDate, endDate, endPicked, name, ...(slugEdited ? {} : { slug: slugForName(name) }) };
    });
  }

  // ── Steps ────────────────────────────────────────────────────────────────────────────────────────────
  function tournamentMistake(): string | null {
    if (!form.name.trim()) return W.nameRequired;
    if (nameHolder) return nameHolder.year && nameHolder.status === 'completed' ? W.nameHeld(nameHolder.year) : W.nameTaken;
    if (!SLUG_RE.test(form.slug)) return W.linkInvalid;
    if (slugHolder) return 'Another tournament already uses this public link. Choose a different one.';
    if (!form.startDate || !form.endDate) return W.datesRequired;
    if (form.startDate < todayValue()) return W.startPast;
    if (form.endDate < form.startDate) return W.endBeforeStart;
    return null;
  }

  // ── Step 2's list (only the divisions added; one flat list — a row never moves) ─────────────────────────────────
  // The rules are `lib/tournament-setup-divisions`'; these only hold them in state.
  const wash = (id: string) => setWashed(w => ({ id, n: (w?.n ?? 0) + 1 }));

  /** Edits apply as typed; nothing is saved until Create the draft. */
  function updateDivision(id: string, patch: Partial<SetupDivision>) {
    touch();
    setDivisions(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)));
  }

  /** A division by name — typed or a suggestion — at the end of the list; or, refused (blank, or already listed), the
   *  reason under the field. Whether it landed. */
  function addNamedDivision(name: string): boolean {
    const refusal = addDivisionRefusal(divisions, name);
    setAddRefusal(refusal ?? '');
    if (refusal) return false;
    const id = nextDivisionId();
    touch();
    setDivisions(ds => [...ds, setupDivision(id, name.trim())]);
    wash(id);
    return true;
  }

  /** The name field's Add (or Enter). The field keeps focus, so a mixed event is "U11 Girls", Enter, "U11 Boys", Enter. */
  function addTypedDivision() {
    if (addNamedDivision(typedDivision)) setTypedDivision('');
    divisionField.current?.focus();
  }

  /** A suggestion leaves the row once its division is listed, so focus moves on to the next one along (or back to the
   *  field), never left on a button that is gone. */
  function addSuggestedDivision(name: string, offered: readonly string[]) {
    if (!addNamedDivision(name)) return;
    const at = offered.indexOf(name);
    const next = offered[at + 1] ?? offered[at - 1];
    requestAnimationFrame(() => {
      const button = next ? suggestionRow.current?.querySelector<HTMLButtonElement>(`[data-suggestion="${next}"]`) : null;
      if (button) button.focus();
      else focusDivisionField();
    });
  }

  /** Focus back on the name field — at a desk only: on a phone it would raise the keyboard after a tap that never asked
   *  to type (a division's window is a record for exactly that reason). It never scrolls the page to get there. */
  function focusDivisionField() {
    if (!isPhone) divisionField.current?.focus({ preventScroll: true });
  }

  /** "Remove this division", from the end of its own fields: it leaves the list, and its arrow or window closes. Its red
   *  line goes with it — the step's error too, when that was its mistake — and so does a refusal about its name. */
  function removeRow(id: string) {
    touch();
    setDivisions(ds => removeDivision(ds, id));
    setOpenRows(s => { const n = new Set(s); n.delete(id); return n; });
    setFlagged(s => { const n = new Set(s); n.delete(id); return n; });
    if (divisionWindow?.id === id) setDivisionWindow(null);
    if (flagged.has(id)) setError('');
    setAddRefusal('');
    requestAnimationFrame(focusDivisionField);
  }

  /** A row's arrow or window opening (it remembers its name — see `openDivision`). */
  function openRow(id: string, where: 'arrow' | 'window') {
    if (where === 'arrow' && openRows.has(id)) return;
    setDivisions(ds => openDivision(ds, id));
    if (where === 'arrow') setOpenRows(s => new Set(s).add(id));
    else setDivisionWindow({ id });
  }

  /** A row's arrow or window closing: a cleared name holds it open, flagged. Returns whether it may close. */
  function closeRow(id: string): boolean {
    if (!holdsOpen(divisions, id)) return true;
    setFlagged(s => new Set(s).add(id));
    return false;
  }

  function toggleRow(id: string) {
    if (!openRows.has(id)) { openRow(id, 'arrow'); return; }
    if (!closeRow(id)) return;
    setOpenRows(s => { const n = new Set(s); n.delete(id); return n; });
  }

  /** A mistake opens its division — its arrow at a desk, its window on a phone — so it never hides in a closed row. */
  function showDivisionMistake(m: { id: string; text: string }) {
    setFlagged(s => new Set(s).add(m.id));
    setError(m.text);
    openRow(m.id, isPhone ? 'window' : 'arrow');
  }

  const pickedVenues = [...book, ...added].filter(v => ticked.has(v.key));

  function next() {
    setError('');
    if (step === 'tournament') {
      const mistake = tournamentMistake();
      if (mistake) { setError(mistake); return; }
      setStep('divisions');
    } else if (step === 'divisions') {
      // A name typed into the box but never added is never dropped without a word (/review, round 3).
      if (typedDivision.trim()) { setAddRefusal(W.divisionNotAdded(typedDivision.trim())); divisionField.current?.focus(); return; }
      // Next with no divisions still works; the draft's board asks for a division before Activate.
      const { mistake } = divisionsPayload(divisions);
      if (mistake) { showDivisionMistake(mistake); return; }
      setFlagged(new Set());
      // A wash belongs to the moment a row lands; coming back to the step must not replay it.
      setWashed(null);
      setStep('venues');
    } else if (step === 'venues') {
      setStep('review');
    }
  }

  function back() {
    setError('');
    setAddRefusal('');
    setWashed(null);
    if (step === 'review') setStep('venues');
    else if (step === 'venues') setStep('divisions');
    else if (step === 'divisions') setStep('tournament');
  }

  function requestClose() {
    if (saving || cloneWorking) return;
    if (preStep === 'choose') { onClose(); return; }
    if (preStep === 'clone-name' || preStep === 'into') { if (cloneTouched.current) setLeaveAsk(true); else onClose(); return; }
    if (touched.current || step !== 'tournament') { setLeaveAsk(true); return; }
    onClose();
  }

  async function create() {
    if (saving) return;
    setError('');
    const mistake = tournamentMistake();
    if (mistake) { setStep('tournament'); setError(mistake); return; }
    const { rows, mistake: divMistake } = divisionsPayload(divisions);
    if (divMistake) { setStep('divisions'); showDivisionMistake(divMistake); return; }
    const welcome = (welcomeText ?? W.welcomeDefault(form.name.trim())).trim();
    setSaving(true);
    let created: (CreatedTournament & { success: boolean }) | null = null;
    try {
      created = await requestJson<CreatedTournament & { success: boolean }>(`/api/admin/setup-tournament${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament: {
            name: form.name.trim(),
            slug: form.slug,
            startDate: form.startDate,
            endDate: form.endDate,
            // The style rides WITH the tournament (F78).
            format: form.format,
            // A preset only when the organizer picked one; left alone, the draft keeps following the org's theme.
            ...(chosenPreset ? { themePreset: chosenPreset } : {}),
          },
          divisions: rows,
          announcement: welcomeOn && welcome ? { body: welcome } : null,
          venues: pickedVenues.map(v => (v.kind === 'new'
            ? { kind: 'new', name: v.draft.name, address: v.draft.address || null, notes: v.draft.notes || null, count: v.draft.count, facilityType: v.draft.facilityType }
            : v.kind === 'past' ? { kind: 'past', sourceVenueId: v.sourceVenueId } : { kind: 'library', orgVenueId: v.orgVenueId })),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The tournament couldn’t be created. Please try again.');
      setSaving(false);
      return;
    }
    // The draft exists now: a failure past this point is the board not opening, never "couldn't be created" (a retry
    // would only meet the name it just took).
    try {
      await onCreated({ id: created.id, name: created.name, slug: created.slug, creationMethod: 'blank' });
    } catch {
      setError(`${created.name} was created, but its board didn’t open. Find it on Tournaments.`);
    } finally {
      setSaving(false);
    }
  }

  // ── The preview beside the window (1280 and wider) ──────────────────────────────────────────────────
  function preview(source: { name: string; slug: string; startDate: string; endDate: string; bindDivisions: boolean; inheritsSourceBranding?: boolean }) {
    if (!previewOrg) return null;
    const inheritedTheme = source.inheritsSourceBranding && sourceTheme?.id === cloneSource?.id ? sourceTheme?.theme ?? null : null;
    const tournamentTheme: PreviewTournamentTheme | null = chosenPreset ? { themePreset: chosenPreset, themePrimary: null, themeAccent: null } : inheritedTheme;
    const canChooseTheme = canManageBranding && hasPlanFeature(previewOrg.planId, 'advanced_tournament_branding');
    // The ticked divisions only — what Create will make.
    const totals = divisionTotals(divisions);
    const bound = source.bindDivisions && totals.count > 0;
    // The End fields store what is typed, half-typed years included; the preview shows only a real day on or after the
    // start (its dates read TBD for that moment rather than flashing a day count of 1 or 39,000).
    const shownEnd = /^\d{4}-\d{2}-\d{2}$/.test(source.endDate) && source.endDate >= source.startDate ? source.endDate : '';
    return (
      <TournamentCreationPreview
        org={previewOrg}
        name={source.name}
        slug={source.slug}
        startDate={source.startDate}
        endDate={shownEnd}
        divisionCount={bound ? totals.count : null}
        teamSpots={bound ? totals.spots : null}
        tournamentTheme={tournamentTheme}
        themePicker={canChooseTheme ? {
          selected: resolveSelectedPreset(previewOrg, tournamentTheme),
          onSelect: p => setChosenPreset(p),
          caption: describeTheme(previewOrg, tournamentTheme, Boolean(inheritedTheme)),
          onClear: chosenPreset ? () => setChosenPreset(null) : null,
          clearLabel: source.inheritsSourceBranding ? 'Use the colours from the event you are reusing' : 'Use my organization’s colours',
        } : null}
      />
    );
  }

  const leaveQuestion = leaveAsk && (
    <KitDialog
      kind="question"
      title={W.leaveTitle}
      onClose={() => setLeaveAsk(false)}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => setLeaveAsk(false)}>{W.keepWorking}</button>
          <button type="button" className="btn btn-danger" onClick={() => { setLeaveAsk(false); onClose(); }}>{W.leave}</button>
        </>
      )}
    >
      <p>{W.leaveBody}</p>
    </KitDialog>
  );

  // ── PRE-STEP: "Start blank, or reuse". On a plan without Reuse (specimen 8, M4 — the free tournament tier): one
  //    sentence on how teams join an invite-only event (the hosts who see this step ran an event before, maybe with open
  //    registration), then Reuse as the one lock line in the draft board's words — it was a badge, a sentence and a
  //    boxed callout, a different lock shape (F09). ─────
  if (preStep === 'choose') {
    const sorted = [...(existingTournaments ?? [])].sort((a, b) => (sourceRank(a.status) - sourceRank(b.status)) || ((b.year ?? 0) - (a.year ?? 0)));
    return (
      <KitDialog
        kind="form"
        title={W.title}
        identity="Start blank, or reuse setup from an event you already ran."
        onClose={requestClose}
        footer={<button type="button" className="btn btn-lime" onClick={() => setPreStep(null)}>Start blank tournament</button>}
      >
        {!canClone ? (
          <div className={styles.reuseIntro}>
            {inviteOnly && <Callout role="note" flush>{INVITE_BOARD_WORDS.howTeamsJoin}</Callout>}
            <PlanLockLine href={tournamentPlusPanelHref(previewOrg?.slug ?? 'admin')}>{LOCK_WORDS.reuseSetup}</PlanLockLine>
          </div>
        ) : (
        <div className={styles.reuseIntro}>
          <div className={styles.reuseTitleRow}>
            <Copy size={15} aria-hidden />
            <strong>Reuse a previous tournament setup</strong>
          </div>
          <p>Best for annual tournaments, seasonal classics, and repeat events where the structure already worked.</p>
          {(
            <ClubRowFrame>
              <ClubRowList inset label="Reuse a previous tournament setup">
                {sorted.map(t => (
                  <ClubRow
                    key={t.id}
                    as="button"
                    title={t.name}
                    caption={[t.year, statusLabel(t.status)].filter(Boolean).join(' · ')}
                    chevron
                    onClick={() => {
                      setCloneSource(t);
                      setCloneForm(getRepeatNameForm(t));
                      setCloneOptions(DEFAULT_CLONE_COPY_OPTIONS);
                      // A colour chosen for a DIFFERENT source never carries over to this one.
                      setChosenPreset(null);
                      setCloneError('');
                      cloneTouched.current = false;
                      setPreStep('clone-name');
                    }}
                  />
                ))}
              </ClubRowList>
            </ClubRowFrame>
          )}
        </div>
        )}
        {canClone && <div className={styles.choiceDivider}><span /><strong>or</strong><span /></div>}
      </KitDialog>
    );
  }

  // ── "INTO THIS DRAFT" (Stage 5, E2 · F33 · F80): the reuse step filling the draft it was opened from ─────────
  if (preStep === 'into' && into) {
    // The first past event until one is chosen (the event list may arrive after the window opened).
    const source = cloneSource ?? intoSources[0] ?? null;
    const selectedCount = Object.values(cloneOptions).filter(Boolean).length;
    const selectedGroups = REUSE_COPY_OPTION_KEYS.filter(k => cloneOptions[k]);
    const warnings = getReuseSetupWarnings(source, into.year ?? NaN, cloneOptions);
    const ctouch = () => { cloneTouched.current = true; };

    async function submitInto() {
      if (!source || !into || cloneWorking) return;
      if (selectedCount === 0) { setCloneError(REUSE_WORDS.nothingChosenDoor); return; }
      setCloneWorking(true);
      setCloneError('');
      let copied: CloneCopiedCounts | undefined;
      try {
        const data = await requestJson<{ copied?: CloneCopiedCounts }>(
          `/api/admin/tournaments/${encodeURIComponent(into.id)}/populate-from${orgQuery}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTournamentId: source.id,
              areas: cloneOptions,
              analytics: { sourceSurface: 'draft_dashboard', selectedCopyGroups: selectedGroups, warningCount: warnings.length, warningKeys: warnings.map(w => w.key) },
            }),
          },
        );
        copied = data.copied;
      } catch (err) {
        setCloneError(err instanceof Error ? err.message : REUSE_WORDS.intoFailed);
        setCloneWorking(false);
        return;
      }
      // It landed: a failure past here is the board not refreshing, never "couldn't be brought in".
      try {
        await onBroughtIn?.({ sourceName: source.name, copied });
      } finally {
        setCloneWorking(false);
      }
    }

    return (
      <>
        <KitDialog
          kind="form"
          title={REUSE_WORDS.intoTitle}
          identity={REUSE_WORDS.intoLede(into.name)}
          onClose={requestClose}
          busy={cloneWorking}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={requestClose} disabled={cloneWorking}>{REUSE_WORDS.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => void submitInto()} disabled={cloneWorking || !source}>
                {cloneWorking ? REUSE_WORDS.intoBringing : REUSE_WORDS.intoBring}
              </button>
            </>
          )}
        >
          <FormError>{cloneError}</FormError>
          <label className={ck.field} htmlFor="into-source">
            <span className={ck.label}>{REUSE_WORDS.intoSource}<span className={repKit.req} aria-hidden>*</span></span>
            <select
              id="into-source"
              className={ck.select}
              value={source?.id ?? ''}
              onChange={e => { ctouch(); setCloneSource(intoSources.find(t => t.id === e.target.value) ?? null); setCloneError(''); }}
            >
              {intoSources.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <section className={styles.areas} aria-labelledby={`${reuseTitleId}-into-areas`}>
            <h3 id={`${reuseTitleId}-into-areas`} className={styles.areasHeading}>
              {REUSE_WORDS.whatToBring} <span className={styles.areasCount}>{REUSE_WORDS.count(selectedCount, REUSE_COPY_OPTION_KEYS.length)}</span>
            </h3>
            {REUSE_COPY_OPTION_KEYS.map(key => (
              <CheckChoice
                key={key}
                checked={cloneOptions[key]}
                onChange={() => { ctouch(); setCloneOptions(o => ({ ...o, [key]: !o[key] })); setCloneError(''); }}
                title={REUSE_WORDS.areas[key].title}
                caption={REUSE_WORDS.areas[key].caption}
              />
            ))}
          </section>
          <p className={ck.hint}>{REUSE_WORDS.intoKeeps}</p>
          <p className={ck.hint}>{REUSE_WORDS.intoNeverCopied(source?.name ?? '')}</p>
          {warnings.length > 0 && (
            <Callout tone="warn" flush>
              <b className={styles.reviewHeading}>{REUSE_WORDS.reviewHeading}</b>
              <ul className={styles.reviewList}>{warnings.map(w => <li key={w.key}>{w.text}</li>)}</ul>
            </Callout>
          )}
        </KitDialog>
        {leaveQuestion}
      </>
    );
  }

  // ── PRE-STEP: the reuse step (Stage 4, D2) — the same window ──────────────────────────────────────────
  if (preStep === 'clone-name') {
    const selectedCount = Object.values(cloneOptions).filter(Boolean).length;
    const selectedGroups = REUSE_COPY_OPTION_KEYS.filter(k => cloneOptions[k]);
    const draftYear = cloneForm.startDate ? Number(cloneForm.startDate.slice(0, 4)) : NaN;
    const warnings = getReuseSetupWarnings(cloneSource, draftYear, cloneOptions);
    const ctouch = () => { cloneTouched.current = true; };

    async function submitClone() {
      if (!cloneSource) return;
      const name = cloneForm.name.trim();
      const slug = cloneForm.slug.trim();
      if (!name) { setCloneError(W.nameRequired); return; }
      if (!slug || !SLUG_RE.test(slug)) { setCloneError(REUSE_WORDS.slugInvalid); return; }
      if (!cloneForm.startDate || !cloneForm.endDate) { setCloneError(W.datesRequired); return; }
      if (cloneForm.startDate < todayValue()) { setCloneError(W.startPast); return; }
      if (cloneForm.endDate < cloneForm.startDate) { setCloneError(W.endBeforeStart); return; }
      if (selectedCount === 0) { setCloneError(openedFromDoor ? REUSE_WORDS.nothingChosenDoor : REUSE_WORDS.nothingChosenNew); return; }
      setCloneWorking(true);
      setCloneError('');
      try {
        const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(cloneSource.id)}/clone${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, slug, year: Number(cloneForm.startDate.slice(0, 4)),
            startDate: cloneForm.startDate || null,
            endDate: cloneForm.endDate || null,
            ...(chosenPreset ? { themePreset: chosenPreset } : {}),
            options: buildCloneApiOptions(cloneOptions),
            analytics: { sourceSurface, selectedCopyGroups: selectedGroups, warningCount: warnings.length, warningKeys: warnings.map(w => w.key) },
          }),
        });
        const data = await res.json() as { tournament?: Tournament; copied?: CloneCopiedCounts; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Unable to create tournament draft.');
        if (!data.tournament) throw new Error('No tournament returned.');
        await onCreated({
          id: data.tournament.id, name: data.tournament.name, slug: data.tournament.slug,
          creationMethod: 'reused_setup', sourceName: cloneSource.name, copied: data.copied, record: data.tournament,
        });
      } catch (err) {
        setCloneError(err instanceof Error ? err.message : 'Unable to create tournament draft.');
      } finally {
        setCloneWorking(false);
      }
    }

    return (
      <>
        <KitDialog
          kind="form"
          size="medium"
          title={<span id={reuseTitleId}>{REUSE_WORDS.title(cloneSource?.name ?? '')}</span>}
          identity={REUSE_WORDS.lede}
          onClose={requestClose}
          busy={cloneWorking}
          aside={preview({ name: cloneForm.name, slug: cloneForm.slug, startDate: cloneForm.startDate, endDate: cloneForm.endDate, bindDivisions: false, inheritsSourceBranding: cloneOptions.publicPresence })}
          footer={(
            <>
              {openedFromDoor
                ? <button type="button" className="btn btn-outline" onClick={requestClose} disabled={cloneWorking}>{REUSE_WORDS.cancel}</button>
                : <button type="button" className="btn btn-outline" onClick={() => { setPreStep('choose'); setCloneError(''); }} disabled={cloneWorking}>{W.back}</button>}
              <button type="button" className="btn btn-lime" onClick={() => void submitClone()} disabled={cloneWorking}>
                {cloneWorking ? REUSE_WORDS.creating : REUSE_WORDS.create}
              </button>
            </>
          )}
        >
          <FormError>{cloneError}</FormError>
          <div className={styles.grid2}>
            <label className={ck.field} htmlFor="reuse-name">
              <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
              <input id="reuse-name" className={ck.input} value={cloneForm.name} placeholder="e.g. Spring Classic 2027"
                onChange={e => { const name = e.target.value; ctouch(); setCloneForm(f => ({ ...f, name, ...(f.autoSlug ? { slug: slugForName(name) } : {}) })); }} />
            </label>
            <label className={ck.field} htmlFor="reuse-link">
              <span className={ck.label}>{W.publicLink}<span className={repKit.req} aria-hidden>*</span></span>
              <input id="reuse-link" className={ck.input} value={cloneForm.slug} placeholder="spring-classic-2027"
                onChange={e => { ctouch(); setCloneForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'), autoSlug: false })); }} />
            </label>
            <label className={ck.field} htmlFor="reuse-start">
              <span className={ck.label}>{W.startDate}<span className={repKit.req} aria-hidden>*</span></span>
              <input id="reuse-start" className={ck.input} type="date" value={cloneForm.startDate} min={todayValue()}
                onChange={e => { ctouch(); const v = e.target.value; setCloneForm(f => { const next = endDateFollowingStart({ end: f.endDate, endPicked: f.endPicked }, v, END_AFTER_START_DAYS); return { ...f, startDate: v, endDate: next.end, endPicked: next.endPicked }; }); }} />
            </label>
            <label className={ck.field} htmlFor="reuse-end">
              <span className={ck.label}>{W.endDate}<span className={repKit.req} aria-hidden>*</span></span>
              <input id="reuse-end" className={ck.input} type="date" value={cloneForm.endDate} min={cloneForm.startDate || todayValue()} disabled={!cloneForm.startDate}
                onChange={e => { ctouch(); const v = e.target.value; setCloneForm(f => ({ ...f, endDate: v, endPicked: v !== '' })); }} />
            </label>
          </div>
          <p className={ck.hint}>{REUSE_WORDS.dateHint}</p>
          <section className={styles.areas} aria-labelledby={`${reuseTitleId}-areas`}>
            <h3 id={`${reuseTitleId}-areas`} className={styles.areasHeading}>
              {REUSE_WORDS.whatToBring} <span className={styles.areasCount}>{REUSE_WORDS.count(selectedCount, REUSE_COPY_OPTION_KEYS.length)}</span>
            </h3>
            {REUSE_COPY_OPTION_KEYS.map(key => (
              <CheckChoice
                key={key}
                checked={cloneOptions[key]}
                onChange={() => { ctouch(); setCloneOptions(o => ({ ...o, [key]: !o[key] })); setCloneError(''); }}
                title={REUSE_WORDS.areas[key].title}
                caption={REUSE_WORDS.areas[key].caption}
              />
            ))}
            <p className={ck.hint}>{REUSE_WORDS.neverCopied(cloneSource?.name ?? '')}</p>
          </section>
          {warnings.length > 0 && (
            <Callout tone="warn" flush>
              <b className={styles.reviewHeading}>{REUSE_WORDS.reviewHeading}</b>
              <ul className={styles.reviewList}>{warnings.map(w => <li key={w.key}>{w.text}</li>)}</ul>
            </Callout>
          )}
          <p className={`${ck.hint} ${styles.privacy}`}>{REUSE_WORDS.privacy}</p>
        </KitDialog>
        {leaveQuestion}
      </>
    );
  }

  // ── The three steps and the review ───────────────────────────────────────────────────────────────────
  const at = step === 'review' ? CREATE_STEPS.length : CREATE_STEPS.indexOf(step) + 1;
  const identity = step === 'review' ? W.reviewLine : W.stepLine(at, W.stepLabel[step]);
  const host = typeof window !== 'undefined' ? window.location.host : '';
  /** A flagged division's mistake while it stands (its red line), and the division a phone's window is open on. */
  const mistakeOf = (id: string) => (flagged.has(id) ? divisionMistakeFor(divisions, id) : null);
  const editing = divisionWindow ? divisions.find(r => r.id === divisionWindow.id) ?? null : null;

  const footer = (
    <>
      {step === 'tournament'
        ? <button type="button" className="btn btn-outline" onClick={requestClose} disabled={saving}>{W.cancel}</button>
        : <button type="button" className="btn btn-outline" onClick={back} disabled={saving}>{W.back}</button>}
      {step === 'review'
        ? <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={saving}>{saving ? W.creating : W.create}</button>
        : <button type="button" className="btn btn-lime" onClick={next} disabled={saving || (step === 'tournament' && !eventsLoaded)}>
            {step === 'tournament' && !eventsLoaded ? W.loading : W.next}
          </button>}
    </>
  );

  let body: React.ReactNode = null;

  if (step === 'tournament') {
    const heldLine = nameHolder && (
      <div className={styles.held} role="status">
        <span>{nameHolder.year && nameHolder.status === 'completed' ? W.nameHeld(nameHolder.year) : W.nameTaken}</span>
        {suggestion && <button type="button" className={styles.heldUse} onClick={takeSuggestion}>{W.takeName(suggestion)}</button>}
      </div>
    );
    body = (
      <>
        <label className={ck.field} htmlFor="new-t-name">
          <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="new-t-name" className={ck.input} value={form.name} maxLength={120} placeholder="e.g. Spring Classic 2027"
            onChange={e => setName(e.target.value)} data-autofocus="" />
          {heldLine}
        </label>
        <div className={styles.grid2}>
          <label className={ck.field} htmlFor="new-t-start">
            <span className={ck.label}>{W.startDate}<span className={repKit.req} aria-hidden>*</span></span>
            <input id="new-t-start" className={ck.input} type="date" value={form.startDate} min={todayValue()} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label className={ck.field} htmlFor="new-t-end">
            <span className={ck.label}>{W.endDate}<span className={repKit.req} aria-hidden>*</span></span>
            <input id="new-t-end" className={ck.input} type="date" value={form.endDate} min={form.startDate || todayValue()} disabled={!form.startDate}
              onChange={e => { touch(); const v = e.target.value; setForm(f => ({ ...f, endDate: v, endPicked: v !== '' })); }} />
            {/* Stored as typed, never clamped to the start: a year typed into this field passes through "0002…" and
                "0020…", and a clamp rewrote each one to the start mid-typing. Next says an End before the start is wrong. */}
          </label>
        </div>
        <div className={ck.field}>
          <span className={ck.label} id="new-t-style-label">{W.style}<span className={repKit.req} aria-hidden>*</span></span>
          <TournamentStyleCards labelledBy="new-t-style-label" value={form.format} onChange={format => { touch(); setForm(f => ({ ...f, format })); }} />
        </div>
        <label className={ck.field} htmlFor="new-t-link">
          <span className={ck.label}>{W.publicLink}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="new-t-link" className={ck.input} value={form.slug} maxLength={80}
            onChange={e => { touch(); setSlugEdited(true); setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })); }} />
          <span className={`${ck.hint} ${styles.address}`}>{host ? `${host}/${orgSlug ?? ''}/${form.slug}` : `/${orgSlug ?? ''}/${form.slug}`}</span>
          {usedSuggestion && !slugEdited && !slugHolder && <span className={ck.hint}>{W.linkKept}</span>}
        </label>
      </>
    );
  } else if (step === 'divisions') {
    // Round 3 (ruled 2026-10-12): the name field and the nine suggestions ABOVE the list, so they never move as it grows
    // and the list ends with its total; then the shared form table, every row in (`allIn`), one flat list in the order
    // added. Teams it holds in the row at a desk; the arrow opens the rest in place. On a phone a row opens its own
    // window (the form table's one full-screen row). An empty list draws no table (the standard §3.7).
    const totals = divisionTotals(divisions);
    const offered = suggestedDivisions(divisions, new Set([...openRows, ...(divisionWindow ? [divisionWindow.id] : [])]));
    const rows: FormTableInRow[] = divisions.map(d => {
      const name = d.name.trim() || W.divisionName;
      return {
        key: d.id,
        name: d.name,
        cells: inviteOnly ? {
          ages: <span className={styles.ages}>{W.agesColumn(d.minAge, d.maxAge)}</span>,
        } : {
          ages: <span className={styles.ages}>{W.agesColumn(d.minAge, d.maxAge)}</span>,
          teams: (
            <span className={styles.teamsCell}>
              <input className={`${ck.input} ${moneyKit.shareInput}`} inputMode="numeric" value={d.capacity}
                aria-label={`${name}, ${W.maxTeams.toLowerCase()}`}
                // A count of teams: digits only (a text field, New allocation's — it would otherwise take "8.5" or "0x10").
                onChange={e => updateDivision(d.id, { capacity: e.target.value.replace(/\D/g, '') })} />
            </span>
          ),
        },
        phoneLine: W.divisionLine(inviteOnly ? '' : d.capacity, d.minAge, d.maxAge),
        phoneOpen: { label: W.openDivision(name, inviteOnly ? '' : d.capacity, d.minAge, d.maxAge), onOpen: () => openRow(d.id, 'window') },
        // Its form is built only while it is open; it ends with the row's rare door, "Remove this division".
        expand: {
          open: openRows.has(d.id),
          onToggle: () => toggleRow(d.id),
          label: W.divisionDetails(name),
          content: openRows.has(d.id) && (
            <DivisionFields idPrefix={d.id} division={d} onChange={patch => updateDivision(d.id, patch)}
              onRemove={() => removeRow(d.id)} mistake={mistakeOf(d.id)} />
          ),
        },
        wash: washed?.id === d.id ? washed.n : undefined,
      };
    });
    body = (
      <>
        <p className={styles.lede}>{W.divisionsLede}</p>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="new-t-division">{W.divisionName}</label>
          <div className={repKit.fieldRow}>
            <input id="new-t-division" ref={divisionField} className={ck.input} value={typedDivision} maxLength={60}
              placeholder={W.divisionPlaceholder} autoComplete="off"
              onChange={e => { setTypedDivision(e.target.value); if (addRefusal) setAddRefusal(''); }}
              // Enter adds — never while an input method is still composing the word (it would add half of it).
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addTypedDivision(); } }} />
            <button type="button" className={`btn btn-outline ${styles.addButton}`} onClick={addTypedDivision}>{W.add}</button>
          </div>
          <FormError inPlace>{addRefusal}</FormError>
        </div>
        {offered.length > 0 && (
          <div className={styles.suggestions} role="group" aria-labelledby="new-t-suggestions">
            <span className={ck.hint} id="new-t-suggestions">{W.suggestionsLabel}</span>
            <div className={styles.suggestionRow} ref={suggestionRow}>
              {offered.map(p => (
                <button key={p} type="button" className={styles.suggestion} aria-label={W.addSuggestion(p)} data-suggestion={p}
                  onClick={() => addSuggestedDivision(p, offered)}>
                  <Plus size={14} aria-hidden />{p}
                </button>
              ))}
            </div>
          </div>
        )}
        {divisions.length > 0 && (
          <FormTable
            ariaLabel={W.stepLabel.divisions}
            leadLabel={W.colDivision}
            expandLabel={W.detailsHead}
            columns={inviteOnly ? [
              { key: 'ages', label: W.colAges, width: 116 },
            ] : [
              { key: 'ages', label: W.colAges, width: 116 },
              { key: 'teams', label: W.maxTeams, numeric: true, width: 136 },
            ]}
            rows={rows}
            allIn
            phoneRowWindows
            closing={{
              label: W.divisionsRow(totals.count),
              cells: inviteOnly ? {} : { teams: totals.spots },
              phone: W.divisionsBand(totals.count, inviteOnly ? null : totals.spots),
            }}
          />
        )}
      </>
    );
  } else if (step === 'venues') {
    const chooserRows: ChooserVenue[] = book.map(v => bookCaption[v.key]).filter(Boolean);
    const addedRows: ChooserVenue[] = added.map(v => ({
      key: v.key, name: v.name, address: v.kind === 'new' ? v.draft.address || null : null,
      caption: v.kind === 'new' ? W.newCaption(v.draft.count, v.draft.facilityType, v.draft.address) : '',
    }));
    const lineVenues = pickedVenues.map(v => ({ names: v.lanes }));
    body = (
      <>
        <p className={styles.lede}>{W.venuesLede(kind)}</p>
        <VenueChooser
          idPrefix="new-t-venues"
          heading={libraryPlan ? W.library : W.yourVenues}
          searchPlaceholder={libraryPlan ? W.searchLibrary : W.searchYours}
          venues={chooserRows}
          added={addedRows}
          ticked={ticked}
          onToggle={(key, checked) => { touch(); setTicked(t => { const n = new Set(t); if (checked) n.add(key); else n.delete(key); return n; }); }}
          newLabel={libraryPlan ? W.notTheClubs : W.newVenue}
          newCaption={libraryPlan ? W.notTheClubsCaption : W.newVenueCaption(kind)}
          onNew={typed => setSheet({ name: typed })}
          noMatch={W.noMatch}
          notice={bookFailed ? W.venuesLoadFailed : undefined}
        />
        <p className={styles.venueLine}>{W.venueLine(lineVenues, kind)}</p>
      </>
    );
  } else {
    const lanes = pickedVenues.reduce((n, v) => n + v.lanes.length, 0);
    const welcome = welcomeText ?? W.welcomeDefault(form.name.trim());
    body = (
      <>
        <ClubRowFrame>
          <ClubRowList inset label={W.reviewLine}>
            <ClubRow as="button" aria-label={W.editStep(W.stepLabel.tournament)} onClick={() => setStep('tournament')} chevron
              title={form.name.trim()}
              caption={[formatEventDateRange(form.startDate, form.endDate, true), TOURNAMENT_FORMAT_OPTIONS.find(o => o.value === form.format)?.title].filter(Boolean).join(' · ')} />
            <ClubRow as="button" aria-label={W.editStep(W.stepLabel.divisions)} onClick={() => setStep('divisions')} chevron
              title={W.divisionsRow(divisions.length)}
              caption={divisions.length ? divisions.map(d => d.name.trim()).join(' · ') : undefined} />
            <ClubRow as="button" aria-label={W.editStep(W.stepLabel.venues)} onClick={() => setStep('venues')} chevron
              title={W.venuesRow(pickedVenues.length, lanes, kind)}
              caption={pickedVenues.length ? pickedVenues.map(v => v.name).join(' · ') : undefined} />
          </ClubRowList>
        </ClubRowFrame>
        <div className={`${ck.switchRow} ${styles.welcome}${welcomeOn ? '' : ` ${ck.switchRowOff}`}`}>
          <div className={ck.switchText}>
            <span className={ck.switchName} id="new-t-welcome-label">{W.welcome}</span>
            {welcomeOn && (
              <textarea className={`${ck.textarea} ${styles.welcomeText}`} rows={3} maxLength={1000} value={welcome}
                aria-labelledby="new-t-welcome-label" onChange={e => { touch(); setWelcomeText(e.target.value); }} />
            )}
          </div>
          <button type="button" role="switch" aria-checked={welcomeOn} aria-labelledby="new-t-welcome-label" className={ck.switch}
            onClick={() => { touch(); setWelcomeOn(on => !on); }} />
        </div>
        <p className={ck.hint}>{W.reviewFoot}</p>
      </>
    );
  }

  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        title={W.title}
        identity={identity}
        progress={{ at, of: CREATE_STEPS.length }}
        levelKey={step}
        onClose={requestClose}
        busy={saving}
        footer={footer}
        aside={preview({ name: form.name, slug: form.slug, startDate: form.startDate, endDate: form.endDate, bindDivisions: step !== 'tournament' })}
      >
        <FormError>{error}</FormError>
        {body}
      </KitDialog>
      {sheet && (
        <NewVenueSheet
          defaultKind={kind}
          initialName={sheet.name}
          identity={libraryPlan ? W.notTheClubsCaption : undefined}
          onCancel={() => setSheet(null)}
          onAdd={draft => {
            addedSeq.current += 1;
            const key = `new:${addedSeq.current}`;
            setAdded(a => [...a, { key, kind: 'new', draft, name: draft.name, lanes: facilityNames(draft.count, draft.facilityType) }]);
            setTicked(t => new Set(t).add(key));
            touch();
            setSheet(null);
          }}
        />
      )}
      {editing && (
        <DivisionSheet
          key={editing.id}
          division={editing}
          withTeams={!inviteOnly}
          mistake={mistakeOf(editing.id)}
          onChange={patch => updateDivision(editing.id, patch)}
          onClose={() => { if (closeRow(editing.id)) setDivisionWindow(null); }}
          onRemove={() => removeRow(editing.id)}
        />
      )}
      {leaveQuestion}
    </>
  );
}
