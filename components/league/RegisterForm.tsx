'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DateInput from '@/components/shared/DateInput';
import { CheckCircle } from 'lucide-react';
import { useOrgHref } from '@/lib/use-public-pathname';
import { childTag, childLine, forecastChildren, hasAgeBands, nameList, ordinal, signupHeadline, signupToPay, type FormDivision, type FormSeason, type PlacedChild } from '@/lib/league-signup';
import { dollarsLine } from '@/lib/house-league-season';
import type { Cutoff } from '@/lib/born-years';
import styles from './register.module.css';
import formKit from '@/components/public/ClubForm.module.css';
import kit from '@/components/public/ClubKit.module.css';
import LeaguePayBlock from '@/components/public/LeaguePayBlock';
import type { LeaguePayView } from '@/lib/league-pay-view';
import PhoneInput from '@/components/shared/PhoneInput';
import { SECOND_PARENT_WORDS as SP } from '@/lib/league-second-parent';
import FriendFields, { FriendCodeRow, friendsToSend, type FriendDraft } from './FriendFields';
import { FRIEND_WORDS as FW } from '@/lib/league-friends';
import { answerError, answerName, onceQuestions, perChildQuestions, type AnswerIn, type SignupFormView } from '@/lib/club-form-signup';
import { FAMILY_FORM_WORDS as QW } from '@/lib/club-form-family-words';
import { DocumentBlock, FormNotice, QuestionField, anyAnswer, anyFile, anyUploading, errorAttrs, firstFileFieldId, toAnswerIn, type AnswerDraft } from './SignupFormFields';

/**
 * THE FAMILY'S SIGN-UP FORM (Club Tier Stage 9b-1, Part 5; drawing §4, words HOUSE_LEAGUE_STAGE9B1_COPY.md §7–§8; owner Q5,
 * 9b·4, 9b·5, 9b·9, 9b·12, 9b·13). One sign-up registers one child or several. Each child's date of birth finds the
 * division (required whenever the season sorts by age), and before anyone presses Sign up each child shows what will
 * happen: a spot and its price (the early bird applied, or when it ended), or the waitlist and nothing to pay. Two
 * divisions for one age group: the family picks, seeing each one's note and room. No division takes the birth year: the
 * form says so with the club's contact, and that child is left out (the others can still sign up). The total counts only
 * children who will be accepted. After Sign up: the reference, each child's tag ("Accepted", never "Approved"), and the
 * club's how-to-pay words — or, while the club takes card payments (12b, drawn k2), THE one pay block: Pay by card for
 * every accepted child at once (Board Ready Stage 1, tabs 1–2: while the club asks for friends, each child's card asks
 * "Who would you like {child} to play with?" under the division line, and the confirmation shows each child's friend
 * code with Copy). When it doesn't, today's words and no button at all (A6).
 *
 * Board Ready Stage 4 Part 2 (drawing tab 5): THE CLUB'S QUESTIONS AND DOCUMENTS. The per-child questions sit under the
 * division and friends once a child has a spot or waitlist line (kept while hidden, never sent for a child not signed up);
 * the sign-up's own follow the parent's details under "Questions from {club}"; the fixed notice sits once above the first
 * of them. "Documents and agreement": typed text ticks in place, a PDF only after the family opens it through our server.
 * Pressing Sign up with mistakes: the box says how many and names the first, focus moves to it, "Go to it" goes to the
 * field. A form the club changed meanwhile comes back with everything typed kept. Typed answers are kept for the browser
 * tab across a reload; health answers and files are NEVER kept (call C3), and the page says so.
 */

type Child = {
  key: number; firstName: string; lastName: string; dob: string; divisionId: string; jersey: string; position: string; notes: string;
  more: boolean; friends: FriendDraft[];
  /** The club's per-child questions, by question id. Kept while the block is hidden (a date of birth being corrected). */
  answers: Record<string, AnswerDraft>;
};
const blankChild = (key: number): Child => ({ key, firstName: '', lastName: '', dob: '', divisionId: '', jersey: '', position: '', notes: '', more: false, friends: [], answers: {} });
const MAX_CHILDREN = 8;

type Outcome = 'active' | 'pending_review' | 'waitlisted' | 'duplicate' | 'nofit' | 'failed' | 'failed_file';
type Result = {
  reference: string;
  guardianEmail: string;
  /** Stage 3: the second parent's email, when one was added. */
  guardianEmail2?: string | null;
  howToPay: string | null;
  children: (PlacedChild & { outcome: Outcome })[];
  /** 12b: the pay block while the club takes card payments and something is owed; null keeps today's words. */
  pay?: LeaguePayView | null;
  /** Signed-in family accounts Stage 1: the family's "Your sign-up" link (null when this server signs no links). */
  signupToken?: string | null;
};

interface Props {
  orgSlug: string;
  orgName: string;
  seasonSlug: string;
  seasonName: string;
  /** "May 31 – Aug 30" for the eyebrow, or null. */
  seasonDates: string | null;
  /** Board Ready Stage 4: the season's sign-up form as a family meets it (the club's questions and documents). */
  form: SignupFormView;
  /** The club's own privacy policy, for the fixed notice (only when the club has set one). */
  privacyUrl: string | null;
  askEmailConsent: boolean;
  divisions: FormDivision[];
  season: FormSeason;
  cutoff: Cutoff;
  /** The club's day the form was drawn (the early bird is judged on it). */
  today: string;
  /** Where a family's questions go (the no-division-fits card). */
  contact: { email: string | null; phone: string | null };
  /** Board Ready Stage 1: friends a family can name per child (0: the question is absent). */
  friendMax: number;
}

/** The drafts with every choice the form no longer offers taken out (a club removed a choice, or a reload restored an old one). */
function withoutGoneChoices(answers: Record<string, AnswerDraft>, form: SignupFormView): Record<string, AnswerDraft> {
  return Object.fromEntries(Object.entries(answers).map(([id, a]) => {
    const q = form.questions.find(x => x.id === id);
    if (!q || !a.choiceIds) return [id, a];
    const offered = new Set(q.choices.map(c => c.id));
    return [id, { ...a, choiceIds: a.choiceIds.filter(c => offered.has(c)) }];
  }));
}

/** What a reload keeps (call C3): typed answers for this browser tab — never a health answer, never a file. */
type Kept = {
  children: Child[]; guardian: { firstName: string; lastName: string; email: string; phone: string; email2: string };
  once: Record<string, AnswerDraft>; ticked: Record<string, boolean>; opened: Record<string, boolean>; consent: boolean;
  dropped: { health: boolean; files: boolean; notes?: boolean };
  /** The version of each document the ticks and Opens were made on. */
  versions?: Record<string, string>;
};

export default function RegisterForm({
  orgSlug, orgName, seasonSlug, seasonName, seasonDates, form: firstForm, privacyUrl, askEmailConsent, divisions, season, cutoff, today, contact, friendMax,
}: Props) {
  const friendKey = useRef(1);
  const orgHref = useOrgHref(orgSlug);
  const bands = hasAgeBands(divisions);
  const [form, setForm] = useState<SignupFormView>(firstForm);
  const [children, setChildren] = useState<Child[]>([blankChild(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [guardian, setGuardian] = useState({ firstName: '', lastName: '', email: '', phone: '', email2: '' });
  const [once, setOnce] = useState<Record<string, AnswerDraft>>({});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [firstError, setFirstError] = useState<{ name: string; target: string } | null>(null);
  const [restored, setRestored] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const [noticeShown, setNoticeShown] = useState(0);
  const noticeBox = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  const perChild = perChildQuestions(form);
  const onceQs = onceQuestions(form);
  const health = useMemo(() => new Set(form.questions.filter(q => q.health).map(q => q.id)), [form]);
  const fileQs = useMemo(() => new Set(form.questions.filter(q => q.type === 'file').map(q => q.id)), [form]);
  const forecast = forecastChildren(children.map(c => ({ dob: c.dob, divisionId: c.divisionId })), divisions, season, cutoff, today);
  const going = forecast.filter(f => f.kind === 'spot' || f.kind === 'waitlist' || f.kind === 'pick' || f.kind === 'needDob').length;
  // Every set of answers on the page: each child's, then the sign-up's own.
  const answerSets = [...children.map(c => c.answers), once];
  const uploading = answerSets.some(anyUploading);

  // ── Call C3: typed answers kept for the tab; a health answer and a file never are ──
  const keyName = `fl-signup:${orgSlug}:${seasonSlug}`;
  const strip = (a: Record<string, AnswerDraft>) => Object.fromEntries(Object.entries(a).filter(([id]) => !health.has(id) && !fileQs.has(id)));
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(keyName);
      if (raw) {
        const k = JSON.parse(raw) as Kept;
        if (Array.isArray(k.children) && k.children.length) {
          setChildren(k.children.map(c => ({ ...blankChild(c.key), ...c, answers: withoutGoneChoices(c.answers ?? {}, form) })));
          setNextKey(Math.max(...k.children.map(c => c.key)) + 1);
        }
        if (k.guardian) setGuardian(k.guardian);
        if (k.once) setOnce(withoutGoneChoices(k.once, form));
        // A tick or an Open stands only on the version the family saw: a document the club changed since asks again.
        const current = new Map(form.documents.map(d => [d.id, d.versionId]));
        const onSameVersion = ([id]: [string, unknown]) => !!k.versions && k.versions[id] === current.get(id);
        if (k.ticked) setTicked(Object.fromEntries(Object.entries(k.ticked).filter(onSameVersion)));
        if (k.opened) setOpened(Object.fromEntries(Object.entries(k.opened).filter(onSameVersion)));
        setConsent(!!k.consent);
        if (k.dropped?.health || k.dropped?.files || k.dropped?.notes) setNotice(QW.reloadLost(!!k.dropped.health, !!k.dropped.files, !!k.dropped.notes));
      }
    } catch { /* a private window or blocked storage: the form simply starts empty */ }
    setRestored(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first paint in the browser
  }, []);
  useEffect(() => {
    if (!restored || result) return;
    // Written a moment after the family stops typing (a file's progress or a keystroke never writes on its own).
    const t = window.setTimeout(() => {
      const dropped = {
        health: answerSets.some(a => Object.keys(a).some(id => health.has(id) && toAnswerIn(id, a[id]))),
        files: answerSets.some(anyFile),
        // /legal 2026-11-20: the child's free-text notes often hold an allergy, so they are never kept either.
        notes: children.some(c => c.notes.trim() !== ''),
      };
      const kept: Kept = { children: children.map(c => ({ ...c, notes: '', answers: strip(c.answers) })), guardian, once: strip(once), ticked, opened, consent, dropped, versions: Object.fromEntries(form.documents.map(d => [d.id, d.versionId])) };
      try { window.sessionStorage.setItem(keyName, JSON.stringify(kept)); } catch { /* not kept: nothing worse than today */ }
    }, 400);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `answerSets`/`strip` follow these
  }, [restored, result, children, guardian, once, ticked, opened, consent, health, fileQs, form]);

  const clear = (key: string) => setErrors(prev => {
    if (!prev[key]) return prev;
    const copy = { ...prev };
    delete copy[key];
    return copy;
  });
  const setChild = (i: number, patch: Partial<Child>) => {
    setChildren(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    for (const k of Object.keys(patch)) clear(`children.${i}.${k === 'dob' ? 'dateOfBirth' : k}`);
  };
  // Functional, so a file's progress (reported from its upload) never writes over a newer answer. By the child's KEY, not its
  // place in the list: an upload that finishes after an earlier child was removed still lands on the child it began for.
  const childrenNow = useRef(children);
  useEffect(() => { childrenNow.current = children; });
  const setAnswer = (key: number, qid: string, next: AnswerDraft) => {
    setChildren(cs => cs.map(c => (c.key === key ? { ...c, answers: { ...c.answers, [qid]: next } } : c)));
    const at = childrenNow.current.findIndex(c => c.key === key);
    if (at >= 0) clear(`children.${at}.q.${qid}`);
  };
  const setOnceAnswer = (qid: string, next: AnswerDraft) => { setOnce(o => ({ ...o, [qid]: next })); clear(`once.q.${qid}`); };
  const removeChild = (i: number) => {
    // A file already waiting on the server goes at once (ruling 9: Remove deletes it).
    for (const a of Object.values(children[i].answers)) {
      if (a.file?.state === 'done') void fetch(`/api/league/${orgSlug}/${seasonSlug}/form/files/${a.file.id}`, { method: 'DELETE' }).catch(() => {});
    }
    setChildren(cs => cs.filter((_, j) => j !== i));
    setRemoving(null);
    setErrors({});
  };

  // Name the first error on the page (in its order) as errors come and go.
  useEffect(() => {
    if (Object.keys(errors).length === 0) { setFirstError(null); return; }
    const el = formRef.current?.querySelector<HTMLElement>('[data-field-error]');
    setFirstError(el ? { name: el.dataset.fieldName ?? '', target: el.dataset.fieldTarget ?? '' } : null);
  }, [errors]);
  // Focus moves to the box only when Sign up is refused, never while the family is fixing a field (each fix changes `errors`).
  useEffect(() => { if (refusals > 0) errorBox.current?.focus(); }, [refusals]);
  // The form-changed note comes into view and takes focus: Sign up was pressed at the bottom, the note sits at the top.
  useEffect(() => { if (noticeShown > 0) { noticeBox.current?.scrollIntoView({ block: 'center' }); noticeBox.current?.focus(); } }, [noticeShown]);
  // Remove child asks first: the question takes focus, so a keyboard or screen-reader user lands on it.
  const removeAsk = useRef<HTMLDivElement>(null);
  useEffect(() => { if (removing !== null) removeAsk.current?.focus(); }, [removing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    // A file that failed or was refused is never quietly left out of the sign-up: it is named, so the family chooses it
    // again or removes it.
    const fileErrors: Record<string, string> = {};
    const unsent = (f: AnswerDraft['file']) => f && (f.state === 'failed' || f.state === 'refused');
    children.forEach((c, i) => {
      if (!asksFriends(forecast[i].kind)) return;
      for (const q of perChild) if (unsent(c.answers[q.id]?.file)) fileErrors[`children.${i}.q.${q.id}`] = answerError(q, c.firstName.trim() || null, 'invalid');
    });
    for (const q of onceQs) if (going > 0 && unsent(once[q.id]?.file)) fileErrors[`once.q.${q.id}`] = answerError(q, null, 'invalid');
    if (Object.keys(fileErrors).length) { setErrors(fileErrors); setMissing([]); setRefusals(n => n + 1); return; }
    setSubmitting(true);
    setGlobalError(null);
    setNotice(null);
    setErrors({});
    setMissing([]);
    // Only the children who will be registered are sent (a child no division takes is left out, 9b·4).
    const send = children.filter((_, i) => forecast[i].kind !== 'nofit');
    const answersOf = (a: Record<string, AnswerDraft>, ids: { id: string }[]) => ids.map(q => toAnswerIn(q.id, a[q.id])).filter((x): x is AnswerIn => !!x);
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          children: send.map(c => {
            const shows = asksFriends(forecast[children.indexOf(c)].kind);
            return {
              firstName: c.firstName, lastName: c.lastName, dateOfBirth: c.dob || undefined, divisionId: c.divisionId || undefined,
              jerseyPref: c.jersey || undefined, positionPref: c.position || undefined, notes: c.notes || undefined,
              // Friends are sent only while their block shows (the division is known).
              friends: friendMax > 0 && shows ? friendsToSend(c.friends) : undefined,
              // The club's questions likewise: kept while hidden, never sent for a child they don't show for.
              answers: shows ? answersOf(c.answers, perChild) : [],
            };
          }),
          once: answersOf(once, onceQs),
          guardianFirstName: guardian.firstName,
          guardianLastName: guardian.lastName,
          guardianEmail: guardian.email,
          guardianPhone: guardian.phone || undefined,
          guardianEmail2: guardian.email2 || undefined,
          // One tick per document, with the version the family read, and the form as the page was drawn with it.
          documents: form.documents.filter(d => ticked[d.id] && (d.source === 'text' || opened[d.id])).map(d => ({ id: d.id, versionId: d.versionId })),
          formStamp: form.stamp,
          emailConsent: consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.errors) {
        // The server numbers the children it was sent; map them back onto the form's own order.
        const sentIndex = children.map((_, i) => i).filter(i => forecast[i].kind !== 'nofit');
        const remap = (k: string) => {
          const m = k.match(/^children\.(\d+)\.(.+)$/);
          return m ? `children.${sentIndex[Number(m[1])]}.${m[2]}` : k;
        };
        setErrors(Object.fromEntries(Object.entries(data.errors as Record<string, string>).map(([k, v]) => [remap(k), v])));
        setMissing(((data.missing ?? []) as string[]).map(remap));
        setRefusals(n => n + 1);
        return;
      }
      if (res.status === 409 && data.code === 'form_changed' && data.form) {
        // The form came back as it is now: keep every answer whose question is still asked, keep a tick only on a
        // document whose version didn't change, and say what happened (drawing tab 5).
        const next = data.form as SignupFormView;
        const was = new Map(form.documents.map(d => [d.id, d.versionId]));
        const newQuestion = next.questions.some(q => !form.questions.some(o => o.id === q.id));
        const docChanged = next.documents.some(d => was.get(d.id) !== d.versionId);
        const same = ([id]: [string, unknown]) => next.documents.some(d => d.id === id && was.get(id) === d.versionId);
        setTicked(t => Object.fromEntries(Object.entries(t).filter(same)));
        // A PDF opened is a version opened: a new version asks for its own Open.
        setOpened(o => Object.fromEntries(Object.entries(o).filter(same)));
        // A choice the club removed leaves every draft that held it (it would refuse Sign up with nothing visible to fix).
        setChildren(cs => cs.map(c => ({ ...c, answers: withoutGoneChoices(c.answers, next) })));
        setOnce(o => withoutGoneChoices(o, next));
        setForm(next);
        setNotice(newQuestion ? QW.changedQuestion(orgName) : docChanged ? QW.changedDocuments(orgName) : QW.changedOther(orgName));
        setNoticeShown(n => n + 1);
        return;
      }
      if (!res.ok) {
        setGlobalError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      try { window.sessionStorage.removeItem(keyName); } catch { /* nothing kept */ }
      setResult(data as Result);
    } catch {
      setGlobalError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // The confirmation replaces a long form: start it at the top rather than wherever the submit button was.
  useEffect(() => {
    if (result) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [result]);

  if (result) {
    // F8: the confirmation names every child, including one the page never sent because no division takes them.
    const left = children.filter((_, i) => forecast[i].kind === 'nofit').map(c => c.firstName.trim()).filter(Boolean);
    return <Confirmation result={result} seasonName={seasonName} orgName={orgName} left={left} statusHref={orgHref(result.signupToken ? `/league/${seasonSlug}/status/${result.signupToken}` : `/league/${seasonSlug}/status`)} forecast={children.map((c, i) => ({ name: c.firstName, kind: forecast[i].kind }))} />;
  }

  // ── The total (copy §7.8): accepted children only ──
  const free = divisions.every(d => ((d.price ?? season.registrationFee) ?? 0) === 0);
  const spots = forecast.flatMap((f, i) => (f.kind === 'spot' ? [{ name: children[i].firstName || `Child ${i + 1}`, amount: f.amount ?? 0 }] : []));
  const waits = forecast.flatMap((f, i) => (f.kind === 'waitlist' ? [children[i].firstName || `Child ${i + 1}`] : []));
  const sum = Math.round(spots.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  const review = !season.autoApproveUnderCapacity;

  // The fixed notice sits once, just above the first of the club's questions the page shows (tab 5).
  const firstAsking = perChild.length ? forecast.findIndex(f => asksFriends(f.kind)) : -1;
  const noticeAt: number | 'once' | null = form.questions.length === 0 ? null : firstAsking >= 0 ? firstAsking : onceQs.length && going > 0 ? 'once' : null;
  const errorCount = Object.keys(errors).length;
  const allMissing = errorCount > 0 && Object.keys(errors).every(k => missing.includes(k));
  const goTo = () => {
    if (!firstError) return;
    const el = document.getElementById(firstError.target);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  };
  const fieldProps = { club: orgName, orgSlug, seasonSlug };

  return (
    <form ref={formRef} className={formKit.form} onSubmit={handleSubmit} noValidate>
      <div className={formKit.section}>
        <p className={formKit.hint} style={{ marginTop: 0 }}>{[seasonName, seasonDates].filter(Boolean).join(' · ')}</p>
        <p className={formKit.hint}>Sign up one child or several.{bands ? ' Each child’s date of birth finds their division.' : ''}</p>
      </div>
      {notice && <p ref={noticeBox} tabIndex={-1} className={styles.changedNote} role="status">{notice}</p>}

      {children.map((c, i) => {
        const f = forecast[i];
        const name = c.firstName.trim() || `Child ${i + 1}`;
        const err = (k: string) => errors[`children.${i}.${k}`];
        return (
          <div key={c.key} className={formKit.section}>
            <div className={styles.childHead}>
              <h2 className={formKit.sectionTitle}>Child {i + 1}</h2>
              {i > 0 && removing !== i && (
                <button type="button" className={styles.linkButton} aria-label={`Remove child ${i + 1}`}
                  onClick={() => (anyAnswer(c.answers) ? setRemoving(i) : removeChild(i))}>Remove</button>
              )}
            </div>
            {removing === i && (
              <div ref={removeAsk} tabIndex={-1} className={styles.removeAsk} role="alertdialog" aria-labelledby={`c${c.key}-remove`}>
                <span id={`c${c.key}-remove`}>{QW.removeAsk(i + 1, name, anyFile(c.answers))}</span>
                <button type="button" className={styles.linkButton} onClick={() => { setRemoving(null); window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-label="Remove child ${i + 1}"]`)?.focus()); }}>{QW.removeKeep}</button>
                <button type="button" className={styles.linkButton} onClick={() => removeChild(i)}>{QW.removeYes}</button>
              </div>
            )}
            <div className={formKit.fieldRow}>
              <div>
                <label className={formKit.label} htmlFor={`c${c.key}-first`}>First name <span className={formKit.required}>*</span></label>
                <input id={`c${c.key}-first`} className={`${formKit.input}${err('firstName') ? ` ${formKit.inputError}` : ''}`} type="text"
                  value={c.firstName} onChange={e => setChild(i, { firstName: e.target.value })} maxLength={80} autoComplete="off"
                  {...errorAttrs(err('firstName'), `First name for Child ${i + 1}`, `c${c.key}-first`)} />
                {err('firstName') && <p className={formKit.errorMsg}>{err('firstName')}</p>}
              </div>
              <div>
                <label className={formKit.label} htmlFor={`c${c.key}-last`}>Last name <span className={formKit.required}>*</span></label>
                <input id={`c${c.key}-last`} className={`${formKit.input}${err('lastName') ? ` ${formKit.inputError}` : ''}`} type="text"
                  value={c.lastName} onChange={e => setChild(i, { lastName: e.target.value })} maxLength={80} autoComplete="off"
                  {...errorAttrs(err('lastName'), `Last name for ${name}`, `c${c.key}-last`)} />
                {err('lastName') && <p className={formKit.errorMsg}>{err('lastName')}</p>}
              </div>
            </div>
            <div className={formKit.field} {...errorAttrs(err('dateOfBirth'), `Date of birth for ${name}`, `c${c.key}-dob`)}>
              <label className={formKit.label} htmlFor={`c${c.key}-dob`}>Date of birth {bands && <span className={formKit.required}>*</span>}</label>
              <DateInput id={`c${c.key}-dob`} className={formKit.input} value={c.dob} max={today} onChange={v => setChild(i, { dob: v, divisionId: '' })} />
              {err('dateOfBirth') && <p className={formKit.errorMsg}>{err('dateOfBirth')}</p>}
            </div>

            {/* What will happen, before Sign up (9b·5). */}
            {f.kind === 'spot' && (
              <div className={styles.fit}>
                <p className={styles.fitLine}>
                  {[f.division.name, f.division.note, f.division.capacity != null ? `${f.division.capacity - f.division.heldCount} ${f.division.capacity - f.division.heldCount === 1 ? 'spot' : 'spots'} left` : null,
                    f.amount != null ? `${dollarsLine(f.amount)}${f.early ? ' early bird' : ''}` : null].filter(Boolean).join(' · ')}
                </p>
                {f.earlyEnded && <p className={styles.fitDim}>The early-bird price ({dollarsLine(f.earlyEnded.amount)}) ended {f.earlyEnded.until}.</p>}
                {f.review && (f.amount ?? 0) > 0 && <p className={styles.fitDim}>The club reviews each sign-up. Nothing is due until {name} is accepted.</p>}
              </div>
            )}
            {f.kind === 'waitlist' && (
              <div className={styles.fit}>
                <p className={styles.fitLine}>
                  {f.division.name} is full · {name} joins the waitlist, {ordinal(f.position ?? 1)} in line · {f.review ? 'nothing to pay unless a spot opens' : `${name} pays nothing unless a spot opens`}
                </p>
              </div>
            )}
            {f.kind === 'pick' && (
              <fieldset className={styles.pick} {...errorAttrs(err('divisionId'), `Division for ${name}`, `c${c.key}-div-0`)}>
                <legend className={formKit.label}>{bands ? `${name} fits more than one division. Choose one.` : 'Division'}</legend>
                <div className={styles.divisionList}>
                  {f.options.map((d, n) => {
                    const left = d.capacity == null ? null : d.capacity - d.heldCount;
                    const full = (left != null && left <= 0) || d.waitlistCount > 0;
                    const price = (d.price ?? season.registrationFee);
                    return (
                      <label key={d.id} className={`${styles.divisionOption}${c.divisionId === d.id ? ` ${styles.divisionOptionSelected}` : ''}`}>
                        <span className={styles.divisionOptionLeft}>
                          <input type="radio" id={`c${c.key}-div-${n}`} name={`c${c.key}-division`} value={d.id} checked={c.divisionId === d.id}
                            onChange={() => setChild(i, { divisionId: d.id })} className={styles.divisionRadio} />
                          <span>
                            <span className={styles.divisionOptionName}>{d.name}</span>
                            <span className={styles.divisionCapacity}>
                              {[d.note, full ? 'Full · joins the waitlist' : left != null ? `${left} ${left === 1 ? 'spot' : 'spots'} left` : null,
                                !full && price != null ? dollarsLine(price) : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {err('divisionId') && <p className={formKit.errorMsg}>{err('divisionId')}</p>}
                {!c.divisionId && <p className={styles.fitDim}>Choose a division to see what happens next.</p>}
              </fieldset>
            )}
            {f.kind === 'nofit' && (
              <div className={`${kit.card} ${styles.nofit}`} role="status">
                <p className={styles.nofitTitle}>{name} doesn’t fit a division this season</p>
                <p className={styles.fitDim}>No division takes children born in {f.year}. {orgName} can tell you what is available.</p>
                <p className={styles.fitDim}>
                  {contact.email || contact.phone ? (
                    <>Contact {orgName}: {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.email && contact.phone && ' · '}{contact.phone}</>
                  ) : `Contact ${orgName} to ask what is available.`}
                </p>
                <p className={styles.fitDim}>Nothing is signed up for {name}.</p>
              </div>
            )}

            {/* Board Ready Stage 1 (tab 1): under the division line, never under "Jersey number, position and notes". */}
            {friendMax > 0 && (f.kind === 'spot' || f.kind === 'waitlist') && (
              <FriendFields idPrefix={`c${c.key}`} childName={c.firstName.trim() || `Child ${i + 1}`} division={f.division.name} max={friendMax}
                friends={c.friends} nextKey={() => friendKey.current++}
                onChange={next => { setChild(i, { friends: next }); setErrors(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`children.${i}.friends`)))); }}
                errors={childFriendErrors(errors, i)} />
            )}

            {/* Board Ready Stage 4 Part 2 (tab 5): the club's per-child questions, under the division and friends, only once
                the child has a spot or waitlist line (the friends block's rule). */}
            {perChild.length > 0 && asksFriends(f.kind) && (
              <div className={styles.clubBlock}>
                {noticeAt === i && <FormNotice club={orgName} privacyUrl={privacyUrl} />}
                <p className={styles.capLabel}>{QW.fromClub(orgName)}</p>
                {perChild.map(q => (
                  <QuestionField key={q.id} q={q} idBase={`c${c.key}`} value={c.answers[q.id]} onChange={next => setAnswer(c.key, q.id, next)}
                    error={errors[`children.${i}.q.${q.id}`]} who={name} errorName={answerName(q, name)} {...fieldProps} />
                ))}
                {err('files') && <p className={formKit.errorMsg} {...errorAttrs(true, `files for ${name}`, firstFileFieldId(perChild, `c${c.key}`))}>{err('files')}</p>}
              </div>
            )}

            <button type="button" className={styles.linkButton} aria-expanded={c.more} onClick={() => setChild(i, { more: !c.more })}>
              Jersey number, position and notes
            </button>
            {c.more && (
              <>
                <div className={formKit.fieldRow}>
                  <div>
                    <label className={formKit.label} htmlFor={`c${c.key}-jersey`}>Jersey number preference</label>
                    <input id={`c${c.key}-jersey`} className={formKit.input} type="text" value={c.jersey} maxLength={3} placeholder="e.g. 12"
                      onChange={e => setChild(i, { jersey: e.target.value })} />
                  </div>
                  <div>
                    <label className={formKit.label} htmlFor={`c${c.key}-position`}>Position preference</label>
                    <input id={`c${c.key}-position`} className={formKit.input} type="text" value={c.position} maxLength={60}
                      onChange={e => setChild(i, { position: e.target.value })} />
                  </div>
                </div>
                <div className={formKit.field}>
                  <label className={formKit.label} htmlFor={`c${c.key}-notes`}>Additional notes</label>
                  <textarea id={`c${c.key}-notes`} className={formKit.textarea} value={c.notes} maxLength={500} rows={3}
                    onChange={e => setChild(i, { notes: e.target.value })} />
                  <p className={formKit.hint}>Up to 500 characters.</p>
                </div>
              </>
            )}
          </div>
        );
      })}

      {children.length < MAX_CHILDREN ? (
        <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={() => { setChildren(cs => [...cs, blankChild(nextKey)]); setNextKey(k => k + 1); }}>
          + Add another child
        </button>
      ) : (
        <p className={formKit.hint}>You can sign up {MAX_CHILDREN} children at once. Sign up again for more.</p>
      )}

      {/* F8: a page where no child fits a division says so above the parent's section. */}
      {going === 0 && <p className={styles.changedNote} role="status">{QW.noChildFits}</p>}

      <div className={formKit.section}>
        <h2 className={formKit.sectionTitle}>Parent or guardian</h2>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label} htmlFor="g-first">First name <span className={formKit.required}>*</span></label>
            <input id="g-first" className={`${formKit.input}${errors.guardianFirstName ? ` ${formKit.inputError}` : ''}`} type="text" value={guardian.firstName}
              onChange={e => { setGuardian(g => ({ ...g, firstName: e.target.value })); clear('guardianFirstName'); }} maxLength={80} autoComplete="given-name"
              {...errorAttrs(errors.guardianFirstName, 'your first name', 'g-first')} />
            {errors.guardianFirstName && <p className={formKit.errorMsg}>{errors.guardianFirstName}</p>}
          </div>
          <div>
            <label className={formKit.label} htmlFor="g-last">Last name <span className={formKit.required}>*</span></label>
            <input id="g-last" className={`${formKit.input}${errors.guardianLastName ? ` ${formKit.inputError}` : ''}`} type="text" value={guardian.lastName}
              onChange={e => { setGuardian(g => ({ ...g, lastName: e.target.value })); clear('guardianLastName'); }} maxLength={80} autoComplete="family-name"
              {...errorAttrs(errors.guardianLastName, 'your last name', 'g-last')} />
            {errors.guardianLastName && <p className={formKit.errorMsg}>{errors.guardianLastName}</p>}
          </div>
        </div>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label} htmlFor="g-email">Email <span className={formKit.required}>*</span></label>
            <input id="g-email" className={`${formKit.input}${errors.guardianEmail ? ` ${formKit.inputError}` : ''}`} type="email" value={guardian.email}
              onChange={e => { setGuardian(g => ({ ...g, email: e.target.value })); clear('guardianEmail'); }} maxLength={200} autoComplete="email"
              {...errorAttrs(errors.guardianEmail, 'your email', 'g-email')} />
            <p className={formKit.hint}>We’ll send the confirmation here. You’ll need this email and your reference to check your status later.</p>
            {errors.guardianEmail && <p className={formKit.errorMsg}>{errors.guardianEmail}</p>}
          </div>
          <div>
            <label className={formKit.label} htmlFor="g-phone">Phone</label>
            <PhoneInput id="g-phone" className={formKit.input} value={guardian.phone}
              onChange={v => setGuardian(g => ({ ...g, phone: v }))} maxLength={30} autoComplete="tel" />
          </div>
        </div>
        {/* Signed-in family accounts Stage 3 (ask 1): always visible, bare label (only required fields carry a mark),
            one address for the whole sign-up. */}
        <div className={formKit.field}>
          <label className={formKit.label} htmlFor="g-email2">{SP.label}</label>
          <input id="g-email2" className={`${formKit.input}${errors.guardianEmail2 ? ` ${formKit.inputError}` : ''}`} type="email" value={guardian.email2}
            onChange={e => { setGuardian(g => ({ ...g, email2: e.target.value })); clear('guardianEmail2'); }} maxLength={200} autoComplete="off"
            placeholder="name@example.com"
            {...errorAttrs(errors.guardianEmail2, SP.label, 'g-email2')} />
          <p className={formKit.hint}>{SP.hint}</p>
          {errors.guardianEmail2 && <p className={formKit.errorMsg}>{errors.guardianEmail2}</p>}
        </div>
        {/* Club Tier 9c, ruling 9c·9 (copy §12): the coach sees these, so the form says so, every season (Stage 3 ask 5:
            and the second parent's email). */}
        <p className={formKit.hint}>{SP.coachLine}</p>
      </div>

      {/* Board Ready Stage 4 Part 2 (tab 5): the questions asked once per sign-up, after the parent's details. */}
      {onceQs.length > 0 && going > 0 && (
        <div className={formKit.section}>
          <h2 className={formKit.sectionTitle}>{QW.questionsFrom(orgName)}</h2>
          {noticeAt === 'once' && <FormNotice club={orgName} privacyUrl={privacyUrl} />}
          {onceQs.map(q => (
            <QuestionField key={q.id} q={q} idBase="once" value={once[q.id]} onChange={next => setOnceAnswer(q.id, next)}
              error={errors[`once.q.${q.id}`]} who={children.length === 1 ? (children[0].firstName.trim() || 'your child') : 'your children'}
              errorName={answerName(q, null)} {...fieldProps} />
          ))}
          {errors['once.files'] && <p className={formKit.errorMsg} {...errorAttrs(true, 'files for your sign-up', firstFileFieldId(onceQs, 'once'))}>{errors['once.files']}</p>}
        </div>
      )}

      {(form.documents.length > 0 || askEmailConsent) && (
        <div className={formKit.section}>
          {form.documents.length > 0 && (
            <>
              {/* Board Ready Stage 4 Part 2 (tab 5): each document its own block; a PDF's tick waits until it is opened. */}
              <h2 className={formKit.sectionTitle}>{QW.documentsTitle}</h2>
              {form.documents.map(d => (
                <DocumentBlock key={d.id} d={d} idBase="signup" ticked={!!ticked[d.id]} opened={!!opened[d.id]}
                  onOpened={() => setOpened(o => ({ ...o, [d.id]: true }))}
                  onTick={on => { setTicked(t => ({ ...t, [d.id]: on })); clear(`documents.${d.id}`); }}
                  error={errors[`documents.${d.id}`]} orgSlug={orgSlug} seasonSlug={seasonSlug} club={orgName} contact={contact.email} />
              ))}
            </>
          )}
          {askEmailConsent && (
            <div className={styles.checkRow}>
              <input type="checkbox" id="emailConsent" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <label htmlFor="emailConsent">
                {orgName} may email me about future seasons and club news. You can unsubscribe at any time.
                <span className={styles.fitDim} style={{ display: 'block' }}>Emails about this sign-up are sent either way.</span>
              </label>
            </div>
          )}
        </div>
      )}

      <div>
        <div className={styles.feeNote}>
          {free ? (
            <p><strong>Free.</strong> There is nothing to pay.</p>
          ) : review ? (
            <p>
              <strong>Nothing to pay yet.</strong> The club reviews each sign-up, and you pay once a child is accepted.
              {sum > 0 && <> If {spots.length === 1 ? spots[0].name : 'all'} {spots.length === 1 ? 'is' : 'are'} accepted: <strong>{dollarsLine(sum)}</strong>.</>}
            </p>
          ) : spots.length === 0 && waits.length > 0 ? (
            <p><strong>Nothing to pay.</strong> {nameList(waits)} {waits.length === 1 ? 'pays' : 'pay'} nothing unless a spot opens. We’ll email you if one does.</p>
          ) : spots.length > 0 ? (
            <>
              <p>
                <strong>{dollarsLine(sum)} to pay</strong> for {spots.length === 1 ? spots[0].name : `${spots.length} children`}. Payable separately to {orgName}. How to pay is on the next screen and in your email.
              </p>
              {spots.length > 1 && <p className={styles.fitDim}>{spots.map(s => `${s.name} ${dollarsLine(s.amount)}`).join(' · ')}</p>}
              {waits.map(w => <p key={w} className={styles.fitDim}>{w} pays nothing unless a spot opens.</p>)}
            </>
          ) : null}
        </div>
        {errorCount > 0 && (
          <div ref={errorBox} tabIndex={-1} className={`${formKit.globalError} ${styles.errorBox}`} role="group" aria-labelledby="signup-errors-text">
            <span id="signup-errors-text">{(allMissing ? QW.errorsMissing : QW.errorsMixed)(errorCount, firstError?.name ?? 'above')}</span>
            {firstError && <button type="button" className={styles.linkButton} onClick={goTo}>{QW.goToIt}</button>}
          </div>
        )}
        {globalError && <div className={formKit.globalError}>{globalError}</div>}
        {going > 0 && (
          <button type="submit" className={formKit.submitBtn} disabled={submitting || uploading}>
            {uploading ? QW.uploadingButton : submitting ? 'Signing up…' : going === 1 ? 'Sign up' : `Sign up ${going} children`}
          </button>
        )}
      </div>
    </form>
  );
}

/** A child the sign-up placed (accepted, received or waitlisted), as opposed to one it didn't. */
const isPlacedOutcome = (o: Outcome): o is 'active' | 'pending_review' | 'waitlisted' => o === 'active' || o === 'pending_review' || o === 'waitlisted';

/** Does a forecast show the friend block (and the club's per-child questions)? Only once the division is known. */
const asksFriends = (kind: string) => kind === 'spot' || kind === 'waitlist';

/** One child's friend errors, keyed as the block reads them (`friends.{n}.{field}`). */
const childFriendErrors = (errors: Record<string, string>, i: number) =>
  Object.fromEntries(Object.entries(errors).flatMap(([k, v]) => (k.startsWith(`children.${i}.friends`) ? [[k.slice(`children.${i}.`.length), v]] : [])));

/** The moment after Sign up (copy §8): the reference, each child's tag and line, the pay card with the club's words. */
function Confirmation({ result, seasonName, orgName, statusHref, forecast, left }: {
  result: Result;
  seasonName: string;
  orgName: string;
  statusHref: string;
  forecast: { name: string; kind: string }[];
  /** F8: children the page didn't send, because no division takes them. */
  left: string[];
}) {
  const placed = result.children.filter(c => isPlacedOutcome(c.outcome));
  const toPay = signupToPay(placed);
  const accepted = placed.filter(c => c.status === 'active');
  const free = placed.every(c => (c.fee ?? 0) === 0);
  const notPlacedLine = (c: { firstName: string; outcome: Outcome }) =>
    c.outcome === 'failed' ? QW.notSignedUpFailed(c.firstName) : c.outcome === 'failed_file' ? QW.notSignedUpFile(c.firstName)
      : c.outcome === 'nofit' ? QW.notSignedUpNoFit(c.firstName) : QW.notSignedUp(c.firstName);
  return (
    <div className={formKit.successPanel}>
      <div className={formKit.successIcon}><CheckCircle size={28} /></div>
      <p className={formKit.hint} style={{ margin: 0 }}>{seasonName}</p>
      <h2 className={formKit.successTitle}>{signupHeadline(placed)}</h2>
      <div className={formKit.refBox}>Your reference: <span className={formKit.refCode}>{result.reference}</span> (one for this sign-up)</div>

      <div className={styles.results}>
        {result.children.map((c, i) => {
          const was = forecast.find(f => f.name === c.firstName);
          const isPlaced = isPlacedOutcome(c.outcome);
          return (
            <div key={`${c.firstName}-${c.lastName}-${i}`} className={kit.card}>
              <div className={styles.resultHead}>
                <strong>{c.firstName} {c.lastName}</strong>
                {isPlaced && (
                  <span className={`${kit.chip} ${c.outcome === 'active' ? kit.chipOk : kit.chipNeutral}`}>{childTag(c.outcome, c.waitlistPosition)}</span>
                )}
              </div>
              {c.outcome === 'duplicate' ? (
                <p className={styles.fitDim}>{c.firstName} {c.lastName} is already signed up for this season, so nothing changed for {c.firstName}.</p>
              ) : isPlaced ? (
                <p className={styles.fitDim}>Division · {childLine(c)}</p>
              ) : (
                <p className={styles.fitDim}>{notPlacedLine(c)}</p>
              )}
              {c.outcome === 'waitlisted' && was?.kind === 'spot' && (
                <p className={styles.fitDim}>A spot filled while you were signing up, so {c.firstName} joined the waitlist.</p>
              )}
              {/* Board Ready Stage 1 (tab 2): each child's own code, with the same Copy as "Your sign-up". */}
              {c.friendCode && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div className={styles.resultHead}><span className={styles.fitDim} style={{ marginTop: 0 }}>{FW.codeLabel}</span><FriendCodeRow code={c.friendCode} childName={c.firstName} /></div>
                  <p className={styles.codeShare}>{FW.codeShare(c.firstName)}</p>
                </div>
              )}
            </div>
          );
        })}
        {left.map(name => (
          <div key={`left-${name}`} className={kit.card}>
            <div className={styles.resultHead}><strong>{name}</strong></div>
            <p className={styles.fitDim}>{QW.notSignedUpNoFit(name)}</p>
          </div>
        ))}
      </div>

      {result.pay ? (
        <LeaguePayBlock pay={result.pay} returnedSession={null} left={false} centered />
      ) : accepted.length > 0 && !free && toPay > 0 ? (
        <div className={kit.card}>
          <div className={styles.resultHead}><strong>To pay</strong><strong>{dollarsLine(toPay)}</strong></div>
          {accepted.length > 1 && <p className={styles.fitDim}>{accepted.map(c => `${c.firstName} · ${dollarsLine(c.fee ?? 0)}`).join('; ')}</p>}
          {result.howToPay && <p>How to pay: {result.howToPay}</p>}
          <p className={styles.fitDim}>Payable separately to {orgName}.</p>
        </div>
      ) : placed.some(c => c.status === 'pending_review') ? (
        <div className={kit.card}>
          <strong>Nothing to pay yet</strong>
          <p className={styles.fitDim}>The club will review {placed.length === 1 ? 'this sign-up' : 'each child'}. Once {placed.length === 1 ? placed[0].firstName : 'a child'} is accepted, we’ll email you what to pay and how.</p>
        </div>
      ) : free && accepted.length > 0 ? (
        <p className={styles.fitDim}>This season is free. There is nothing to pay.</p>
      ) : placed.length > 0 && placed.every(c => c.status === 'waitlisted') ? (
        <p className={styles.fitDim}>Nothing to pay unless a spot opens. We’ll email you if one does.</p>
      ) : null}

      <p className={formKit.successBody} style={{ marginTop: '1.5rem' }}>We’ve emailed this to <strong>{result.guardianEmail}</strong>{result.guardianEmail2 && <> and <strong>{result.guardianEmail2}</strong></>}. Keep your reference to quote if you contact the club.</p>
      <p className={styles.fitDim}>Didn’t get it? Check your spam folder.</p>
      <p className={styles.successStatusLink}><a href={statusHref}>{result.signupToken ? 'Your sign-up →' : 'Email me my link →'}</a></p>
    </div>
  );
}
