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
 *   2 Divisions — each a card with its own labels (J1-031); none is allowed (the board's checklist asks).
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
import { Copy } from 'lucide-react';
import type { Tournament, TournamentFormat } from '@/lib/types';
import TournamentStyleCards from './TournamentStyleCards';
import TournamentCreationPreview, {
  type PreviewOrg,
  type PreviewTournamentTheme,
} from './TournamentCreationPreview';
import { PRESETS, isThemePresetKey } from '@/lib/themes';
import { hasOrgVenueLibrary, hasPlanFeature } from '@/lib/plan-features';
import { tournamentToday, formatEventDateRange } from '@/lib/timezone';
import { TOURNAMENT_FORMAT_OPTIONS } from '@/lib/tournament-phase';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { Callout, ClubRow, ClubRowFrame, ClubRowList, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import VenueChooser, { type ChooserVenue } from '@/components/admin/tournament/VenueChooser';
import NewVenueSheet, { type NewVenueDraft } from '@/components/admin/tournament/NewVenueSheet';
import { REUSE_WORDS } from '@/lib/after-event-words';
import { CREATE_STEPS, CREATE_WORDS as W, type CreateStep } from '@/lib/tournament-setup-words';
import { nameForYear, sameTournamentName, slugForName } from '@/lib/tournament-name';
import { dedupePastVenues, facilityKindForSport, facilityNames, type PastVenueRow } from '@/lib/venue-facilities';
import styles from './TournamentSetupWizard.module.css';

const DIVISION_PRESETS = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
} as const;
type DivisionPreset = keyof typeof DIVISION_PRESETS | 'custom';

type DivisionRow = {
  id: string;
  name: string;
  minAge: string;
  maxAge: string;
  capacity: string;
  usePools: boolean;
  poolCount: number;
  poolNames: string[];
  requiresPoolSelection: boolean;
};

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

type CloneNameForm = { name: string; slug: string; startDate: string; endDate: string; autoSlug: boolean };
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
  /** Upgrade copy shown if canClone is false. */
  upgradeCopy?: string;
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

function addDays(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function uniqueName(base: string, taken: readonly string[]) {
  if (!taken.some(t => sameTournamentName(t, base))) return base;
  let n = 2;
  while (taken.some(t => sameTournamentName(t, `${base} ${n}`))) n += 1;
  return `${base} ${n}`;
}

function starterAges(name: string) {
  const youth = name.trim().match(/^U\s*(\d{1,2})$/i) || name.trim().match(/^(\d{1,2})\s*U$/i);
  if (youth) return { minAge: '', maxAge: youth[1] };
  if (['Open', 'Competitive', 'Recreational'].includes(name.trim())) return { minAge: '18', maxAge: '' };
  return { minAge: '', maxAge: '' };
}

let divisionSeq = 0;
function divisionRow(name: string): DivisionRow {
  divisionSeq += 1;
  return {
    id: `division-${divisionSeq}`, name, ...starterAges(name), capacity: '8',
    usePools: false, poolCount: 2, poolNames: ['Pool A', 'Pool B'], requiresPoolSelection: false,
  };
}

function poolLetter(i: number) { return String.fromCharCode(65 + i); }

function getRepeatNameForm(t: PastTournament): CloneNameForm {
  const nextYear = (t.year ?? new Date().getFullYear()) + 1;
  const name = nameForYear(t.name, nextYear, t.year ?? null);
  return { name, slug: slugForName(name), startDate: '', endDate: '', autoSlug: true };
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
  upgradeCopy,
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

  // ── Pre-step (choose / the reuse step) ──────────────────────────────────────────────────────────────
  const hasPast = Boolean(existingTournaments && existingTournaments.length > 0);
  const [preStep, setPreStep] = useState<PreStepMode | null>(hasPast ? 'choose' : null);
  const [cloneSource, setCloneSource] = useState<PastTournament | null>(null);
  const [cloneForm, setCloneForm] = useState<CloneNameForm>({ name: '', slug: '', startDate: '', endDate: '', autoSlug: true });
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
  const [form, setForm] = useState({ name: '', slug: '', startDate: '', endDate: '', format: 'round_robin_playoffs' as TournamentFormat });
  const [slugEdited, setSlugEdited] = useState(false);
  const [usedSuggestion, setUsedSuggestion] = useState(false);
  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [divisions, setDivisions] = useState<DivisionRow[]>(() => DIVISION_PRESETS.youth.map(divisionRow));
  const [newDivision, setNewDivision] = useState('');
  const [divisionMistake, setDivisionMistake] = useState<{ id: string; text: string } | null>(null);
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
      setCloneForm({ name: '', slug: '', startDate: '', endDate: '', autoSlug: true });
    }
    setCloneOptions(DEFAULT_CLONE_COPY_OPTIONS);
    setCloneWorking(false);
    setCloneError('');
    setStep('tournament');
    setForm({ name: '', slug: '', startDate: '', endDate: '', format: 'round_robin_playoffs' });
    setSlugEdited(false);
    setUsedSuggestion(false);
    setDivisionPreset('youth');
    setDivisions(DIVISION_PRESETS.youth.map(divisionRow));
    setNewDivision('');
    setDivisionMistake(null);
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
      const endDate = startDate ? (f.endDate && f.endDate >= startDate ? f.endDate : addDays(startDate, 2)) : '';
      // An untouched "2026 Tournament" follows the year of its start date.
      const auto = /^\d{4} Tournament(?: \d+)?$/.test(f.name);
      if (!startDate || !auto) return { ...f, startDate, endDate };
      const name = uniqueName(`${startDate.slice(0, 4)} Tournament`, liveEvents.map(e => e.name));
      return { ...f, startDate, endDate, name, ...(slugEdited ? {} : { slug: slugForName(name) }) };
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

  function divisionsPayload(): { rows: ReturnType<typeof toPayload>[]; mistake: { id: string; text: string } | null } {
    const named = divisions.filter(d => d.name.trim());
    const seen = new Map<string, string>();
    for (const d of named) {
      const key = d.name.trim().toLowerCase();
      if (seen.has(key)) return { rows: [], mistake: { id: d.id, text: W.divisionDuplicate(d.name.trim()) } };
      seen.set(key, d.id);
      const cap = Number(d.capacity);
      if (!Number.isFinite(cap) || cap < 1) return { rows: [], mistake: { id: d.id, text: W.divisionCapacity } };
      const min = d.minAge === '' ? null : Number(d.minAge);
      const max = d.maxAge === '' ? null : Number(d.maxAge);
      if (min !== null && max !== null && min > max) return { rows: [], mistake: { id: d.id, text: W.divisionAges } };
    }
    return { rows: named.map(toPayload), mistake: null };
  }

  function toPayload(d: DivisionRow) {
    const pools = d.usePools ? Math.max(2, Math.min(4, d.poolCount)) : 0;
    return {
      name: d.name.trim(),
      minAge: d.minAge === '' ? null : Number(d.minAge),
      maxAge: d.maxAge === '' ? null : Number(d.maxAge),
      capacity: Math.max(1, Math.floor(Number(d.capacity)) || 8),
      poolCount: pools,
      poolNames: pools >= 2 ? d.poolNames.slice(0, pools).map((n, i) => n.replace(/,/g, ' ').trim() || `Pool ${poolLetter(i)}`).join(',') : '',
      requiresPoolSelection: pools >= 2 && d.requiresPoolSelection,
    };
  }

  const pickedVenues = [...book, ...added].filter(v => ticked.has(v.key));

  function next() {
    setError('');
    if (step === 'tournament') {
      const mistake = tournamentMistake();
      if (mistake) { setError(mistake); return; }
      setStep('divisions');
    } else if (step === 'divisions') {
      const { mistake } = divisionsPayload();
      setDivisionMistake(mistake);
      if (mistake) { setError(mistake.text); return; }
      setStep('venues');
    } else if (step === 'venues') {
      setStep('review');
    }
  }

  function back() {
    setError('');
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
    const { rows, mistake: divMistake } = divisionsPayload();
    if (divMistake) { setStep('divisions'); setDivisionMistake(divMistake); setError(divMistake.text); return; }
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
    const real = divisions.filter(d => d.name.trim());
    const bound = source.bindDivisions && real.length > 0;
    return (
      <TournamentCreationPreview
        org={previewOrg}
        name={source.name}
        slug={source.slug}
        startDate={source.startDate}
        endDate={source.endDate}
        divisionCount={bound ? real.length : null}
        teamSpots={bound ? real.reduce((n, d) => n + (Number(d.capacity) || 0), 0) : null}
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

  // ── PRE-STEP: "Start blank, or reuse" (left as today on the Tournament plan — the free tier review's) ─────
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
        <div className={styles.reuseIntro}>
          <div className={styles.reuseTitleRow}>
            <Copy size={15} aria-hidden />
            <strong>Reuse a previous tournament setup</strong>
            {!canClone && upgradeCopy && <span className={styles.plusBadge}>Tournament Plus</span>}
          </div>
          <p>Best for annual tournaments, seasonal classics, and repeat events where the structure already worked.</p>
          {!canClone && upgradeCopy ? (
            <Callout role="note" flush>{upgradeCopy}</Callout>
          ) : (
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
        <div className={styles.choiceDivider}><span /><strong>or</strong><span /></div>
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
                onChange={e => { ctouch(); const v = e.target.value; setCloneForm(f => ({ ...f, startDate: v, endDate: v ? addDays(v, 2) : '' })); }} />
            </label>
            <label className={ck.field} htmlFor="reuse-end">
              <span className={ck.label}>{W.endDate}<span className={repKit.req} aria-hidden>*</span></span>
              <input id="reuse-end" className={ck.input} type="date" value={cloneForm.endDate} min={cloneForm.startDate || todayValue()} disabled={!cloneForm.startDate}
                onChange={e => { ctouch(); setCloneForm(f => ({ ...f, endDate: e.target.value })); }} />
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
  const realDivisions = divisions.filter(d => d.name.trim());

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
              onChange={e => { touch(); const v = e.target.value; setForm(f => ({ ...f, endDate: v && v < f.startDate ? f.startDate : v })); }} />
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
    body = (
      <>
        <p className={styles.lede}>{W.divisionsLede}</p>
        <div className={styles.starter}>
          <label className={ck.field} htmlFor="new-t-starter">
            <span className={ck.label}>{W.starter}</span>
            <select id="new-t-starter" className={ck.select} value={divisionPreset}
              onChange={e => {
                touch();
                const p = e.target.value as DivisionPreset;
                setDivisionPreset(p);
                setDivisionMistake(null);
                setDivisions(p === 'custom' ? [] : DIVISION_PRESETS[p].map(divisionRow));
              }}>
              <option value="youth">{W.starterYouth}</option>
              <option value="adult">{W.starterAdult}</option>
              <option value="custom">{W.starterCustom}</option>
            </select>
          </label>
          <div className={styles.addDivision}>
            <label className={ck.field} htmlFor="new-t-add-division">
              <span className={ck.label}>{W.addDivision}</span>
              <input id="new-t-add-division" className={ck.input} value={newDivision} placeholder={W.addDivisionPlaceholder}
                onChange={e => setNewDivision(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newDivision.trim()) { touch(); setDivisions(d => [...d, divisionRow(newDivision.trim())]); setNewDivision(''); } } }} />
            </label>
            <button type="button" className={`btn btn-outline ${styles.addButton}`} disabled={!newDivision.trim()}
              onClick={() => { touch(); setDivisions(d => [...d, divisionRow(newDivision.trim())]); setNewDivision(''); }}>Add</button>
          </div>
        </div>
        {divisions.length === 0 && <p className={ck.hint}>{W.noDivisions}</p>}
        <div className={styles.divisions}>
          {divisions.map(row => {
            const update = (patch: Partial<DivisionRow>) => { touch(); setDivisions(ds => ds.map(d => (d.id === row.id ? { ...d, ...patch } : d))); };
            const mistake = divisionMistake?.id === row.id ? divisionMistake.text : null;
            return (
              <fieldset key={row.id} className={styles.division} aria-invalid={mistake ? true : undefined}>
                <legend className={styles.srOnly}>{row.name || W.divisionName}</legend>
                <div className={styles.divisionHead}>
                  <label className={ck.field} htmlFor={`${row.id}-name`}>
                    <span className={ck.label}>{W.divisionName}</span>
                    <input id={`${row.id}-name`} className={ck.input} value={row.name} maxLength={60} onChange={e => update({ name: e.target.value })} />
                  </label>
                  <button type="button" className={`btn btn-outline ${styles.remove}`} aria-label={W.removeDivision(row.name)}
                    onClick={() => { touch(); setDivisions(ds => ds.filter(d => d.id !== row.id)); }}>✕</button>
                </div>
                <div className={styles.grid3}>
                  <label className={ck.field} htmlFor={`${row.id}-min`}>
                    <span className={ck.label}>{W.youngest}</span>
                    <input id={`${row.id}-min`} className={ck.input} type="number" inputMode="numeric" min={0} value={row.minAge} placeholder={W.anyAge} onChange={e => update({ minAge: e.target.value })} />
                  </label>
                  <label className={ck.field} htmlFor={`${row.id}-max`}>
                    <span className={ck.label}>{W.oldest}</span>
                    <input id={`${row.id}-max`} className={ck.input} type="number" inputMode="numeric" min={0} value={row.maxAge} placeholder={W.anyAge} onChange={e => update({ maxAge: e.target.value })} />
                  </label>
                  <label className={ck.field} htmlFor={`${row.id}-cap`}>
                    <span className={ck.label}>{W.maxTeams}</span>
                    <input id={`${row.id}-cap`} className={ck.input} type="number" inputMode="numeric" min={1} value={row.capacity} onChange={e => update({ capacity: e.target.value })} />
                  </label>
                </div>
                <label className={styles.checkLine}>
                  <input type="checkbox" checked={row.usePools} onChange={e => update({ usePools: e.target.checked })} />
                  <span>{W.usePools}</span>
                </label>
                {row.usePools && (
                  <div className={styles.pools}>
                    <label className={ck.field} htmlFor={`${row.id}-pools`}>
                      <span className={ck.label}>{W.poolCount}</span>
                      <select id={`${row.id}-pools`} className={ck.select} value={row.poolCount}
                        onChange={e => {
                          const n = Number(e.target.value);
                          update({ poolCount: n, poolNames: Array.from({ length: n }, (_, i) => row.poolNames[i] || `Pool ${poolLetter(i)}`) });
                        }}>
                        {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <div className={styles.grid2}>
                      {Array.from({ length: row.poolCount }, (_, i) => (
                        <label key={i} className={ck.field} htmlFor={`${row.id}-pool-${i}`}>
                          <span className={ck.label}>{W.poolName(poolLetter(i))}</span>
                          <input id={`${row.id}-pool-${i}`} className={ck.input} value={row.poolNames[i] ?? ''} maxLength={40}
                            onChange={e => { const names = [...row.poolNames]; names[i] = e.target.value; update({ poolNames: names }); }} />
                        </label>
                      ))}
                    </div>
                    <label className={styles.checkLine}>
                      <input type="checkbox" checked={row.requiresPoolSelection} onChange={e => update({ requiresPoolSelection: e.target.checked })} />
                      <span>{W.registrantPicks}</span>
                    </label>
                  </div>
                )}
                {mistake && <p className={repKit.formError} role="alert">{mistake}</p>}
              </fieldset>
            );
          })}
        </div>
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
              title={W.divisionsRow(realDivisions.length)}
              caption={realDivisions.length ? realDivisions.map(d => d.name.trim()).join(' · ') : undefined} />
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
      {leaveQuestion}
    </>
  );
}
