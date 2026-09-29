'use client';
/**
 * Rep Teams › a team › Tryouts — ON THE TEAM'S LIVE SEASON (Club Tier Stage 2, specimen 7; B07,
 * S2-05). It replaced the season-level tryout page, which worked on whichever season it was opened
 * from — even a finished one — while the coach worked on the live one. Now a tryout belongs to the
 * team's live season on every surface, and a closed season's tryout is a record.
 *
 *   header   — back to the team; "Tryouts" + the season's state chip; Add applicant (lime; live only).
 *   Sign-ups — a section in the portal's shape: its Open/Closed chip, Copy link, Close/Open sign-ups
 *              (one click — reopening is one click too), and the TEAM-named address (a link on last
 *              spring's flyer can never take sign-ups for a finished year).
 *   toolbar  — the status views lead; Export is pinned right, over what it exports.
 *   table    — one chevron per row, which opens the applicant's window (the per-row buttons moved in
 *              there); headings in the standard's display face, not the S2-06 override.
 *   notes    — the coach runs the tryout; accepting adds a player to the roster; nothing is emailed.
 *   closed   — no sign-up switch, no accept, no Add applicant: the list reads as a record, each row
 *              opens read-only, and the way forward is the season door ("Start the 2027 Season").
 * ⚠ Departure, told at build time: a "Waitlisted" view joins the drawn four, because the build added
 * the way to waitlist someone (S2-05, matching the coach's decision board) — the drawing's own note.
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronRight, Copy, Lock, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CoachListToolbar } from '@/components/coaches/kit';
import {
  ClubSection, EmptyCard, LoadFailed, PageLoading, RepChip, repKit, TwoOpenNote, useDeferredLoad,
  useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { TRYOUT_STATUS_LABEL, TRYOUT_STATUS_TONE, tryoutNotice, type AddApplicantForm } from '@/components/admin/kit/club/TryoutDialogs';
import type { SeasonPreflight } from '@/components/admin/kit/club/SeasonDialogs';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { publicTryoutHref } from '@/lib/public-tryout-links';
import { latestClosedSeasonOf, liveSeasonOf } from '@/lib/season-live';
import { startButton } from '@/lib/club-season-words';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import type { ClubBoardRow } from '@/lib/club-team-board';
import type { RepProgramYear, RepTeam, RepTryoutRegistration, RepTryoutRegistrationStatus } from '@/lib/types';

const ApplicantDialog = dynamic(() => import('@/components/admin/kit/club/TryoutDialogs').then(m => m.ApplicantDialog));
const AddApplicantDialog = dynamic(() => import('@/components/admin/kit/club/TryoutDialogs').then(m => m.AddApplicantDialog));
const StartSeasonDialog = dynamic(() => import('@/components/admin/kit/club/SeasonDialogs').then(m => m.StartSeasonDialog));

type View = 'pending_review' | 'offered' | 'waitlisted' | 'accepted' | 'declined_withdrawn' | 'all';
const VIEW_LABEL: Record<View, string> = {
  pending_review: 'Pending review', offered: 'Offered', waitlisted: 'Waitlisted', accepted: 'Accepted',
  declined_withdrawn: 'Declined or withdrawn', all: 'All',
};
const VIEWS: View[] = ['pending_review', 'offered', 'waitlisted', 'accepted', 'declined_withdrawn', 'all'];
const inView = (r: RepTryoutRegistration, v: View) =>
  v === 'all' ? true : v === 'declined_withdrawn' ? r.status === 'declined' || r.status === 'withdrawn' : r.status === v;

const EXPORT_COLS: ExportColumnDef[] = [
  { label: 'First Name', key: 'playerFirstName', format: 'text' },
  { label: 'Last Name', key: 'playerLastName', format: 'text' },
  { label: 'Date of Birth', key: 'playerDateOfBirth', format: 'date', sensitive: true },
  { label: 'Guardian Name', key: 'guardianName', format: 'text', sensitive: true },
  { label: 'Guardian Email', key: 'guardianEmail', format: 'text', sensitive: true },
  { label: 'Guardian Phone', key: 'guardianPhone', format: 'text', sensitive: true },
  { label: 'Player Notes', key: 'playerNotes', format: 'text', sensitive: true },
  { label: 'Admin Notes', key: 'adminNotes', format: 'text', sensitive: true },
  { label: 'Submitted At', key: 'submittedAt', format: 'date' },
  { label: 'Status', key: 'status', format: 'text' },
  { label: 'Consent Given', key: 'consentGiven', format: 'text' },
  { label: 'Consent Date', key: 'consentDate', format: 'text' },
  // CASL (2026-07-30): news-email consent is optional marketing consent, recorded separately.
  { label: 'News-Email Consent', key: 'consentNews', format: 'text' },
  { label: 'Consent IP', key: 'consentIp', format: 'text', sensitive: true },
];

interface TeamRead { team: RepTeam; programYears: RepProgramYear[]; board: ClubBoardRow; seasons: { id: string; rosterCount: number }[] }

export default function TeamTryoutsPage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { currentOrg, userRole, loading: orgLoading } = useOrg();
  const canWrite = userRole === 'owner' || userRole === 'admin';
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const teamBase = `/${orgSlug}/admin/rep-teams/teams/${teamId}`;

  const [read, setRead] = useState<TeamRead | null>(null);
  const [regs, setRegs] = useState<RepTryoutRegistration[]>([]);
  const [preflight, setPreflight] = useState<SeasonPreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ notFound: boolean } | null>(null);
  const [view, setView] = useState<View>('pending_review');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const [notice, setNotice] = useNotice();

  const season = useMemo(() => {
    if (!read) return null;
    const years = read.programYears;
    return liveSeasonOf(years) ?? latestClosedSeasonOf(years);
  }, [read]);
  const isLive = !!season && (season.status === 'draft' || season.status === 'active');
  // org-slug-ok: a base only — every call built from it appends `?${q}` (the org).
  const yearApi = season ? `/api/admin/rep-teams/teams/${teamId}/program-years/${season.id}` : null;

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setLoadError(null);
    try {
      const teamRes = await fetch(`/api/admin/rep-teams/teams/${teamId}?${q}`, { cache: 'no-store' });
      if (!teamRes.ok) {
        if (current()) setLoadError({ notFound: teamRes.status === 404 || teamRes.status === 403 });
        return;
      }
      const teamData = await teamRes.json() as TeamRead;
      if (!current()) return;
      setRead(teamData);
      const years = teamData.programYears;
      const shown = liveSeasonOf(years) ?? latestClosedSeasonOf(years);
      const [regsRes, preRes] = await Promise.all([
        shown ? fetch(`/api/admin/rep-teams/teams/${teamId}/program-years/${shown.id}/tryouts?${q}`, { cache: 'no-store' }) : Promise.resolve(null),
        canWrite && shown && !liveSeasonOf(years) ? fetch(`/api/admin/rep-teams/teams/${teamId}/seasons?${q}`, { cache: 'no-store' }) : Promise.resolve(null),
      ]);
      if (regsRes && !regsRes.ok) { if (current()) setLoadError({ notFound: false }); return; }
      const regsData = regsRes ? ((await regsRes.json()).registrations ?? []) : [];
      const preData = preRes?.ok ? await preRes.json() as SeasonPreflight : null;
      if (!current()) return;
      setRegs(regsData);
      setPreflight(preData);
    } catch {
      if (current()) setLoadError({ notFound: false });
    } finally {
      if (current()) setLoading(false);
    }
  }, [teamId, q, canWrite, beginRead]);

  useDeferredLoad(!orgLoading, load);

  useEffect(() => {
    // Server-resolved admin paper for the PDF (D4); a failed fetch prints on default paper. Cleanup-
    // guarded so a slow answer for another org can never land as this one's branding.
    if (!currentOrg) return;
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`).then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [currentOrg, q]);

  const team = read?.team ?? null;
  usePageTitle(team ? `Tryouts · ${team.name}` : 'Tryouts');
  usePublishRailTeam(teamId, team?.name);

  const counts = useMemo(() => {
    const out = {} as Record<View, number>;
    for (const v of VIEWS) out[v] = regs.filter(r => inView(r, v)).length;
    return out;
  }, [regs]);
  // On a closed season the record opens on everyone (nothing is pending any more).
  const activeView: View = isLive ? view : 'all';
  const filtered = useMemo(() => regs.filter(r => inView(r, activeView)), [regs, activeView]);
  const opened = openId ? regs.find(r => r.id === openId) ?? null : null;

  async function patch(regId: string, body: Record<string, unknown>): Promise<{ ok: boolean; registration?: RepTryoutRegistration; error?: string }> {
    if (!yearApi) return { ok: false };
    const res = await fetch(`${yearApi}/tryouts/${regId}?${q}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, registration: data.registration } : { ok: false, error: data.error };
  }

  async function setStatus(reg: RepTryoutRegistration, status: RepTryoutRegistrationStatus) {
    if (busy) return;
    setBusy(true);
    try {
      const out = await patch(reg.id, { status });
      const name = `${reg.playerFirstName} ${reg.playerLastName}`.trim();
      if (!out.ok) { setNotice({ tone: 'bad', text: out.error ?? 'That didn’t work. Please try again.' }); return; }
      setOpenId(null);
      setNotice({ tone: 'good', text: tryoutNotice(status, name, season?.name ?? 'season') });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(reg: RepTryoutRegistration, adminNotes: string): Promise<boolean> {
    const out = await patch(reg.id, { adminNotes });
    if (!out.ok || !out.registration) { setNotice({ tone: 'bad', text: out.error ?? 'The notes could not be saved.' }); return false; }
    setRegs(prev => prev.map(r => (r.id === reg.id ? out.registration! : r)));
    return true;
  }

  async function toggleSignups(open: boolean) {
    if (!yearApi || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${yearApi}?${q}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tryoutOpen: open }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'Sign-ups could not be changed.' }); return; }
      setNotice({ tone: 'good', text: open ? 'Sign-ups are open. Families can use the link.' : 'Sign-ups are closed. The link says so until you open them again.' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addApplicant(form: AddApplicantForm): Promise<string | null> {
    if (!yearApi) return 'This team has no live season.';
    const res = await fetch(`${yearApi}/tryouts?${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerFirstName: form.playerFirstName.trim(), playerLastName: form.playerLastName.trim(),
        playerDateOfBirth: form.playerDateOfBirth || null, playerNotes: form.playerNotes.trim() || null,
        guardianFirstName: form.guardianFirstName.trim(), guardianLastName: form.guardianLastName.trim(),
        guardianEmail: form.guardianEmail.trim(), guardianPhone: form.guardianPhone.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? 'The applicant could not be added.';
    setAdding(false);
    setView('pending_review');
    setNotice({ tone: 'good', text: `${form.playerFirstName.trim()} ${form.playerLastName.trim()} is in Pending review.` });
    await load();
    return null;
  }

  function copyLink() {
    if (!team) return;
    void navigator.clipboard.writeText(`${window.location.origin}${publicTryoutHref(orgSlug, team.slug)}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Export (the list on screen, as today) ──
  const exportScope = team?.name ?? teamId;
  const exportSrc = () => filtered.map(r => ({
    playerFirstName: r.playerFirstName, playerLastName: r.playerLastName, playerDateOfBirth: r.playerDateOfBirth ?? '',
    guardianName: `${r.guardianFirstName} ${r.guardianLastName}`.trim(), guardianEmail: r.guardianEmail,
    guardianPhone: r.guardianPhone ?? '', playerNotes: r.playerNotes ?? '', adminNotes: r.adminNotes ?? '',
    submittedAt: r.submittedAt.slice(0, 10), status: TRYOUT_STATUS_LABEL[r.status] ?? r.status,
    consentGiven: r.consentAt ? 'Yes' : 'No', consentDate: r.consentAt ? r.consentAt.slice(0, 10) : '',
    consentNews: r.consentAt ? (r.consentEmailComms ? 'Yes' : 'No') : '', consentIp: r.consentIp ?? '',
  }));
  const exportXLSX = (sensitive: boolean) => downloadXLSX(
    buildFilename({ org: orgSlug, dataset: sensitive ? 'tryouts-with-contacts' : 'tryouts', scope: exportScope }, 'xlsx'),
    serializeHeaders(EXPORT_COLS, sensitive), serializeRows(exportSrc(), EXPORT_COLS, sensitive), 'Tryout Applications',
  );
  const exportCSV = () => downloadCSVBlob(
    buildFilename({ org: orgSlug, dataset: 'tryouts', scope: exportScope }, 'csv'),
    generateCSV(serializeHeaders(EXPORT_COLS), serializeRows(exportSrc(), EXPORT_COLS)),
  );
  /** Nothing private prints — no birthdate, guardian contact, notes or consent IP; the consent record does. */
  async function exportPDF() {
    if (!filtered.length) return;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings ?? {}) };
    const row = (r: RepTryoutRegistration) => [
      `${r.playerFirstName} ${r.playerLastName}`.trim(), r.submittedAt.slice(0, 10),
      r.consentAt ? 'Yes' : 'No', r.consentAt ? r.consentAt.slice(0, 10) : '—', r.consentAt ? (r.consentEmailComms ? 'Yes' : 'No') : '—',
    ];
    const groups = (Object.keys(TRYOUT_STATUS_LABEL) as RepTryoutRegistrationStatus[])
      .map(s => ({ label: TRYOUT_STATUS_LABEL[s], regs: filtered.filter(r => r.status === s) }))
      .filter(g => g.regs.length > 0);
    await downloadPDF(
      buildFilename({ org: orgSlug, dataset: 'tryouts', scope: exportScope }, 'pdf'),
      'Tryout Applicants',
      [team?.name, season?.name, activeView === 'all' ? 'every applicant' : VIEW_LABEL[activeView].toLowerCase(), `${filtered.length} in total`]
        .filter(Boolean).join('  ·  '),
      ['Player', 'Submitted', 'Consent', 'Consent date', 'Emails OK'],
      groups.flatMap(g => g.regs.map(row)),
      settings,
      { groups: groups.map(g => ({ label: `${g.label} — ${g.regs.length}`, rows: g.regs.map(row) })), identity: currentOrg?.name },
    );
  }

  const seasonChip = season ? <RepChip tone={isLive ? 'good' : 'neutral'}>{season.name} · {isLive ? 'Live' : 'Closed'}</RepChip> : null;
  const header = (
    <AdminPageHeader
      backTo={{ href: teamBase, label: team?.name ?? 'Team' }}
      crumbs={[{ label: 'Rep Teams' }, team?.groupName ? { label: team.groupName } : null]}
      title="Tryouts"
      titleChips={seasonChip}
      actions={canWrite && isLive ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setAdding(true)} aria-label="Add applicant">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add applicant</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;
  if (loadError || !read || !team) {
    return (
      <div className={repKit.page}>
        {header}
        <LoadFailed
          title={loadError?.notFound ? 'This team isn’t one you can open.' : 'We couldn’t load this team’s tryouts.'}
          onRetry={loadError?.notFound ? undefined : () => { setLoading(true); void load(); }}
        />
      </div>
    );
  }

  if (!season) {
    return (
      <div className={repKit.page}>
        {header}
        <EmptyCard title="No season yet" action={<Link href={teamBase} className="btn btn-outline">Open {team.name}</Link>}>
          A tryout runs on the team’s live season. Start {team.name}’s first season from its team page.
        </EmptyCard>
      </div>
    );
  }

  const headName = read.board.headCoach.people[0]?.name ?? null;
  const accepted = regs.filter(r => r.status === 'accepted').length;
  const address = publicTryoutHref(orgSlug, team.slug).replace(/^\//, '');

  return (
    <div className={repKit.page}>
      {header}
      <TwoOpenNote teamName={read!.team.name} seasons={read!.programYears} showingName={season.name} teamHref={teamBase} />
      {notice && <PageNotice notice={notice} />}

      {isLive ? (
        <ClubSection
          id="signups"
          title={<>Sign-ups <RepChip tone={season.tryoutOpen ? 'good' : 'neutral'}>{season.tryoutOpen ? 'Open' : 'Closed'}</RepChip></>}
          actions={canWrite ? (
            <>
              {season.tryoutOpen && (
                <button type="button" className="btn btn-ghost" onClick={copyLink}>
                  <Copy size={14} aria-hidden /> {copied ? 'Copied' : 'Copy link'}
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={() => void toggleSignups(!season.tryoutOpen)} disabled={busy}>
                {season.tryoutOpen ? 'Close sign-ups' : 'Open sign-ups'}
              </button>
            </>
          ) : undefined}
        >
          <span className={repKit.readonlyValue}>{address}</span>
          {!season.tryoutOpen && (
            <p className={repKit.windowNote}>While sign-ups are closed, this address tells families they aren’t open.</p>
          )}
        </ClubSection>
      ) : (
        <div className={repKit.section}>
          <div className={`${repKit.sectionBody} ${repKit.recordCard}`}>
            <Lock size={18} aria-hidden className={repKit.splitDim} />
            <div>
              <h2 className={repKit.closedTitle}>The {season.name} is closed, so its tryout is a record</h2>
              <p className={repKit.windowNote}>
                {pluralize(regs.length, 'applicant')}, {accepted} accepted.
                {preflight?.suggested ? ` To take sign-ups, start the ${preflight.suggested.name}.` : ''}
              </p>
              {canWrite && preflight?.rollsFrom && (
                <div className={repKit.calloutActions}>
                  <button type="button" className="btn btn-lime" onClick={() => setStarting(true)}>{startButton(preflight.suggested?.year ?? null)}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {regs.length === 0 ? (
        isLive && (
          <EmptyCard title="No applicants yet">
            Applicants appear here when sign-ups are open and families use the link. Accepting adds a player to the
            {' '}{season.name} roster directly.
          </EmptyCard>
        )
      ) : (
        <>
          <CoachListToolbar
            actions={
              <ExportMenu
                formats={['xlsx', 'csv', 'pdf']}
                onExportXLSX={() => void exportXLSX(false)}
                onExportCSV={exportCSV}
                onExportPDF={exportPDF}
                pdfFeatureKey="club_exports"
                hasSensitiveOption
                sensitiveOptionLabel="Excel with contact details"
                onExportXLSXWithSensitive={() => void exportXLSX(true)}
                // Guardian names, emails and phones for every applicant: the same key as its neighbours.
                sensitiveFeatureKey="club_exports"
                planId={currentOrg?.planId}
                disabled={filtered.length === 0}
              />
            }
          >
            {isLive && (
              <div className={repKit.views} role="group" aria-label="Show applicants">
                {VIEWS.filter(v => v === 'all' || v === 'pending_review' || counts[v] > 0).map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`${repKit.view}${view === v ? ` ${repKit.viewOn}` : ''}`}
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                  >
                    {VIEW_LABEL[v]}{(v === 'pending_review' || v === 'all') && counts[v] > 0 ? ` · ${counts[v]}` : ''}
                  </button>
                ))}
              </div>
            )}
          </CoachListToolbar>

          {filtered.length === 0 ? (
            <p className={repKit.notes}>Nobody here. Choose another view to see the rest.</p>
          ) : (
            <div className={repKit.tableFrame}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    {isLive && <th scope="col">Date of birth</th>}
                    {isLive && <th scope="col">Guardian email</th>}
                    <th scope="col">Submitted</th>
                    <th scope="col">Status</th>
                    {isLive && <th scope="col">Consent</th>}
                    <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const name = `${r.playerFirstName} ${r.playerLastName}`.trim();
                    return (
                      // The whole row opens the applicant (standard §3.6); the name stays the keyboard's
                      // button, and a click that ends a selection (copying a guardian's email) opens nothing.
                      <tr key={r.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; setOpenId(r.id); }}>
                        <td>
                          <button type="button" className={`${repKit.nameLink} ${repKit.nameButton}`} onClick={e => { e.stopPropagation(); setOpenId(r.id); }} aria-haspopup="dialog">
                            {name}
                          </button>
                        </td>
                        {isLive && <td className={repKit.dim}>{r.playerDateOfBirth ? formatStoredDate(r.playerDateOfBirth) : '—'}</td>}
                        {isLive && <td className={repKit.dim}>{r.guardianEmail}</td>}
                        <td className={repKit.dim}>{formatStoredDate(r.submittedAt, { withYear: !isLive })}</td>
                        <td><RepChip tone={TRYOUT_STATUS_TONE[r.status]}>{TRYOUT_STATUS_LABEL[r.status]}</RepChip></td>
                        {isLive && <td className={repKit.dim}>{r.consentAt ? formatStoredDate(r.consentAt, { withYear: false }) : '—'}</td>}
                        <td className={repKit.go}>
                          <span className={repKit.goLink} aria-hidden>
                            <ChevronRight size={16} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {isLive && (
        <p className={repKit.notes}>
          {headName ? `${headName} runs` : 'The head coach runs'} this tryout in the Coaches Portal: sessions, scoring and
          decisions. This is the same list, on the same season. Accepting adds a player to the {season.name} roster;
          nothing is emailed.
        </p>
      )}

      {opened && (
        <ApplicantDialog
          key={opened.id}
          reg={opened}
          seasonName={season.name}
          canAct={canWrite && isLive}
          busy={busy}
          onClose={() => setOpenId(null)}
          onStatus={status => setStatus(opened, status)}
          onSaveNotes={notes => saveNotes(opened, notes)}
        />
      )}
      {adding && <AddApplicantDialog seasonName={season.name} onClose={() => setAdding(false)} onAdd={addApplicant} />}
      {starting && preflight?.rollsFrom && (
        <StartSeasonDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={team.name}
          preflight={preflight}
          rosterCount={read.seasons.find(x => x.id === preflight.rollsFrom?.id)?.rosterCount ?? 0}
          headCoachName={headName}
          onClose={() => setStarting(false)}
          onStarted={async name => {
            setStarting(false);
            setNotice({ tone: 'good', text: `The ${name} has started. Open sign-ups when you’re ready.` });
            await load();
          }}
        />
      )}
    </div>
  );
}
