/**
 * lib/public-site-patch.ts — WHAT THE PUBLIC-SITE EDITOR MAY SAVE (Club Tier Stage 4c-1; words CLUB_TIER_STAGE4C1_COPY.md
 * §C, §D, §G–§I, §K).
 *
 * Each editor card saves itself, so the route takes any subset of fields and stores ONLY those (the old full-row save
 * nulled the rest). Every field is checked here, once: the route checks the request, and the editor's fields and list
 * windows call the same checks before they send (`checkSiteField`, `checkListRow`) — so a refusal reads the same in
 * the browser and from the server. A refused field returns its name and the reason, and NOTHING in the request is
 * saved — never a "Saved" over a value that was thrown away (F05). Pure; tested in tests/unit/club-stage4c1.test.ts.
 * Who may save (owner or admin) is the routes' (lib/public-site-access.ts).
 */
import type { OrgPublicSiteContentPatch } from './db';
import type { SiteContact, SiteDocument, SiteQuestion, SiteSponsor } from './types';
import { checkEmail, checkLink, EMAIL_MAX, LINK_MAX, type Checked, type SocialNetwork } from './site-field-checks';
import { normalizeHiddenSections, normalizeSectionOrder } from './club-site-sections';
import { PUBLIC_SITE_WORDS as W } from './public-site-words';
import { isCalendarDate } from './timezone';
import { isOwnSponsorLogo } from './sponsor-logo';

export const TAGLINE_MAX = 100;
export const ABOUT_MAX = 1000;
export const CONTACT_ROLE_MAX = 60;
export const DOCUMENT_HEADING_MAX = 60;
export const DOCUMENT_TITLE_MAX = 120;
export const QUESTION_MAX = 200;
export const ANSWER_MAX = 1000;
export const SPONSOR_NAME_MAX = 80;

export type ListKind = 'contacts' | 'documents' | 'questions' | 'sponsors';
/** Each list's cap — the CHECKs in mig 343 (and 353, for sponsors) hold the same numbers. */
export const LIST_MAX: Record<ListKind, number> = { contacts: 12, documents: 30, questions: 10, sponsors: 20 };

type RowOf = { contacts: SiteContact; documents: SiteDocument; questions: SiteQuestion; sponsors: SiteSponsor };
type ListRow = RowOf[ListKind];

/**
 * What a list row is checked against beyond its own fields. `orgId` (with the project's storage `supabaseOrigin`, which
 * defaults to the environment's) lets a sponsor's logo address be held to the club's own upload folder; the editor's
 * window has no club to name, and its logo came from the upload route, so it checks without one. `lenient` is the READ:
 * a logo that is not the club's own is dropped and the sponsor stays, where a save refuses it.
 */
export interface ListContext { orgId?: string; supabaseOrigin?: string }
interface RowContext extends ListContext {
  lenient?: boolean;
  /** The editor's window checks before it sends: it has no club to name, and nothing it checks is stored. */
  clientCheck?: boolean;
}

export type PatchResult =
  | { ok: true; patch: OrgPublicSiteContentPatch }
  | { ok: false; field: string; error: string };

/** A refusal with the field it is about (null: the request as a whole). Thrown by the checks, and by the editor's save. */
export class Refused extends Error {
  readonly field: string | null;
  constructor(field: string | null, message: string) { super(message); this.field = field; }
}

/** The typed fields the editor saves one at a time. */
export type SiteTextField = 'tagline' | 'description' | 'contactEmail' | 'socialInstagram' | 'socialFacebook' | 'socialX' | 'socialWebsite';

/** Each social field and the network its refusal names. */
export const SOCIAL_FIELD: Record<'socialInstagram' | 'socialFacebook' | 'socialX' | 'socialWebsite', SocialNetwork> = {
  socialInstagram: 'instagram',
  socialFacebook: 'facebook',
  socialX: 'x',
  socialWebsite: 'website',
};

/** Each typed field's longest value (the inputs' maxLength and the route's cut are the same number). */
export const SITE_FIELD_MAX: Record<SiteTextField, number> = {
  tagline: TAGLINE_MAX, description: ABOUT_MAX, contactEmail: EMAIL_MAX,
  socialInstagram: LINK_MAX, socialFacebook: LINK_MAX, socialX: LINK_MAX, socialWebsite: LINK_MAX,
};

function text(raw: unknown, max: number): string | null {
  const v = typeof raw === 'string' ? raw.trim().slice(0, max) : '';
  return v || null;
}

/** One typed field: its stored value, or why it is refused. */
export function checkSiteField(field: SiteTextField, raw: unknown): Checked<string | null> {
  if (field === 'contactEmail') return checkEmail(raw);
  if (field in SOCIAL_FIELD) return checkLink(raw, SOCIAL_FIELD[field as keyof typeof SOCIAL_FIELD]);
  return { ok: true, value: text(raw, SITE_FIELD_MAX[field]) };
}

function required(raw: unknown, max: number, label: string): string {
  const v = text(raw, max);
  if (!v) throw new Refused(null, W.missing(label));
  return v;
}

const ROW: { [K in ListKind]: (r: Record<string, unknown>, ctx: RowContext) => Omit<RowOf[K], 'id'> } = {
  contacts: r => {
    const role = required(r.role, CONTACT_ROLE_MAX, W.role);
    const email = checkEmail(r.email);
    if (!email.ok) throw new Refused(null, email.error);
    if (!email.value) throw new Refused(null, W.missing(W.email));
    return { role, email: email.value };
  },
  documents: r => {
    const heading = required(r.heading, DOCUMENT_HEADING_MAX, W.heading);
    const title = required(r.title, DOCUMENT_TITLE_MAX, W.docTitle);
    const url = checkLink(r.url);
    if (!url.ok) throw new Refused(null, url.error);
    if (!url.value) throw new Refused(null, W.missing(W.link));
    return { heading, title, url: url.value };
  },
  questions: r => ({
    question: required(r.question, QUESTION_MAX, W.question),
    answer: required(r.answer, ANSWER_MAX, W.answer),
  }),
  // Only the name is required. An absent field is an absent key (never an empty string), so a stored row stays small and
  // the editor can tell "no link" from "a link".
  sponsors: (r, ctx) => {
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) throw new Refused(null, W.missing(W.sponsorName));
    if (name.length > SPONSOR_NAME_MAX) throw new Refused(null, W.nameTooLong(SPONSOR_NAME_MAX));
    const link = checkLink(r.link);
    if (!link.ok) throw new Refused(null, link.error);
    const endsOn = typeof r.endsOn === 'string' ? r.endsOn.trim() : '';
    if (endsOn && !isCalendarDate(endsOn)) throw new Refused(null, W.badLastDay);
    const logoUrl = typeof r.logoUrl === 'string' ? r.logoUrl.trim() : '';
    // The address drives a public <img> and a service-role delete: only a file this club's own upload wrote.
    // Fails CLOSED: a caller that names no club (a save or a read) gets no logo, never an unchecked one.
    const logoOk = !logoUrl || (ctx.orgId ? isOwnSponsorLogo(logoUrl, ctx.orgId, ctx.supabaseOrigin) : !!ctx.clientCheck);
    if (!logoOk && !ctx.lenient) throw new Refused(null, W.logoNotOurs);
    return {
      name,
      ...(logoUrl && logoOk ? { logoUrl } : {}),
      ...(link.value ? { link: link.value } : {}),
      ...(endsOn ? { endsOn } : {}),
    };
  },
};

/** Why one list row can't be saved yet, or null — the list window asks before it sends. */
export function checkListRow(kind: ListKind, row: Record<string, unknown>): string | null {
  try { ROW[kind](row, { clientCheck: true }); return null; } catch (e) { if (e instanceof Refused) return e.message; throw e; }
}

/** A row's id: the one it came with when it is short and not already taken, else a new one. */
const ID_MAX = 64;
function rowId(raw: unknown, taken: Set<string>, newId: () => string): string {
  const id = typeof raw === 'string' && raw.length > 0 && raw.length <= ID_MAX && !taken.has(raw) ? raw : newId();
  taken.add(id);
  return id;
}

function list(kind: ListKind, raw: unknown, newId: () => string, ctx: ListContext): ListRow[] {
  if (!Array.isArray(raw)) throw new Refused(kind, W.saveFailed);
  if (raw.length > LIST_MAX[kind]) throw new Refused(kind, W.listFull(LIST_MAX[kind], kind));
  const taken = new Set<string>();
  return raw.map(item => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = rowId(r.id, taken, newId);
    try {
      return { id, ...ROW[kind](r, ctx) } as ListRow;
    } catch (e) {
      if (e instanceof Refused) throw new Refused(kind, e.message);
      throw e;
    }
  });
}

/**
 * A stored list as a page may show it: only the rows the route would accept, each with an id, at most the cap. The
 * route is the only writer, so this changes nothing for its rows — it keeps a row written some other way (SQL, a
 * script) from reaching a public page as an unchecked link or a crash.
 */
export function cleanSiteList(kind: ListKind, raw: unknown, ctx: ListContext = {}): ListRow[] {
  if (!Array.isArray(raw)) return [];
  const taken = new Set<string>();
  let n = 0;
  const out: ListRow[] = [];
  for (const item of raw.slice(0, LIST_MAX[kind])) {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    try {
      const row = ROW[kind](r, { ...ctx, lenient: true });
      out.push({ id: rowId(r.id, taken, () => `${kind}-${n++}`), ...row } as ListRow);
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
    }
  }
  return out;
}

function strings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * The checked patch for a body, or the first refused field. `newId` names a new list row (crypto.randomUUID); `ctx` names
 * the club whose lists these are (the route passes it, so a sponsor's logo can be held to the club's own folder).
 */
export function parsePublicSitePatch(body: unknown, newId: () => string = () => crypto.randomUUID(), ctx: ListContext = {}): PatchResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const patch: OrgPublicSiteContentPatch = {};
  try {
    for (const field of Object.keys(SITE_FIELD_MAX) as SiteTextField[]) {
      if (!(field in b)) continue;
      const c = checkSiteField(field, b[field]);
      if (!c.ok) throw new Refused(field, c.error);
      patch[field] = c.value;
    }
    if ('homeSectionOrder' in b) patch.homeSectionOrder = normalizeSectionOrder(strings(b.homeSectionOrder));
    if ('homeSectionsHidden' in b) patch.homeSectionsHidden = normalizeHiddenSections(strings(b.homeSectionsHidden));
    if ('contacts' in b) patch.contacts = list('contacts', b.contacts, newId, ctx) as SiteContact[];
    if ('documents' in b) patch.documents = list('documents', b.documents, newId, ctx) as SiteDocument[];
    if ('questions' in b) patch.questions = list('questions', b.questions, newId, ctx) as SiteQuestion[];
    if ('sponsors' in b) patch.sponsors = list('sponsors', b.sponsors, newId, ctx) as SiteSponsor[];
  } catch (e) {
    if (e instanceof Refused) return { ok: false, field: e.field ?? 'request', error: e.message };
    throw e;
  }
  return { ok: true, patch };
}
