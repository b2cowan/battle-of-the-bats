'use client';
/**
 * Rep Teams › Document templates — ONE LIST, AND WHO EACH APPLIES TO (Club Tier Stage 2, specimen 8;
 * J4-009, B11). Two tables (Org-wide · Team-specific) that never said WHICH team a form belonged to,
 * and an upload that asked for a raw team id, became:
 *   · one table with an "Applies to" column ("Every team" or the team's name), the name opening the
 *     template (Download, Switch off/on, Delete — which asks) and one chevron; no "⋯", no row buttons;
 *   · the scope said once, truly, in the toolbar's lede (templates are club- or team-wide and NOT
 *     tied to a season — the old help's "program-year specific" was wrong; signed copies are per
 *     player per season, which is why the board's Documents count starts at zero on a new season);
 *   · an upload window with an "Applies to" dropdown of the club's teams, grouped, "Every team" first.
 * The server refuses a team that isn't the club's (B11, session 1).
 */
import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronRight, FileText, Upload } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CoachListToolbar } from '@/components/coaches/kit';
import {
  EmptyCard, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { DOC_TYPE_LABEL, type PickerTeam, type TemplateRow } from '@/components/admin/kit/club/TemplateDialogs';
import { formatStoredDate } from '@/lib/timezone';

const TemplateDialog = dynamic(() => import('@/components/admin/kit/club/TemplateDialogs').then(m => m.TemplateDialog));
const UploadTemplateDialog = dynamic(() => import('@/components/admin/kit/club/TemplateDialogs').then(m => m.UploadTemplateDialog));

export default function DocumentTemplatesPage() {
  const { currentOrg, userRole, loading: orgLoading } = useOrg();
  usePageTitle('Document templates');
  const orgSlug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [teams, setTeams] = useState<PickerTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!orgSlug) return;
    const current = beginRead();
    setLoadError(false);
    try {
      const [tplRes, teamsRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/document-templates?${q}`, { cache: 'no-store' }),
        // Archived teams too: a template made for one must still name it (the picker offers it only there).
        fetch(`/api/admin/rep-teams/teams?light=1&archived=true&${q}`, { cache: 'no-store' }),
      ]);
      if (!tplRes.ok) { if (current()) setLoadError(true); return; }
      const tplData = await tplRes.json();
      const teamsData = await teamsRes.json().catch(() => ({}));
      if (!current()) return;
      setTemplates((tplData.templates ?? []) as TemplateRow[]);
      setTeams(((teamsData.teams ?? []) as { team: PickerTeam }[]).map(t => t.team));
    } catch {
      if (current()) setLoadError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [orgSlug, q, beginRead]);

  useDeferredLoad(!orgLoading && !!orgSlug, load);

  const teamName = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);
  const rows = useMemo(() => [...templates].sort((a, b) => {
    // Every team first, then by team, then by name — the order a club reads "what does each team sign?".
    const ta = a.teamId ? teamName.get(a.teamId) ?? '' : '';
    const tb = b.teamId ? teamName.get(b.teamId) ?? '' : '';
    return ta.localeCompare(tb) || a.name.localeCompare(b.name);
  }), [templates, teamName]);
  const opened = openId ? templates.find(t => t.id === openId) ?? null : null;

  async function download(t: TemplateRow) {
    const res = await fetch(`/api/admin/rep-teams/document-templates/${t.id}?${q}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) { setNotice({ tone: 'bad', text: 'The download link could not be made. Please try again.' }); return; }
    const a = document.createElement('a');
    a.href = data.url;
    a.download = t.fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  async function patch(t: TemplateRow, body: { isActive?: boolean; teamId?: string | null }) {
    // The Applies-to select fires on every change: one write at a time (/review).
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/document-templates/${t.id}?${q}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'That didn’t work. Please try again.' }); return; }
      setTemplates(prev => prev.map(r => (r.id === t.id ? { ...r, ...data.template } : r)));
      setNotice({
        tone: 'good',
        text: body.isActive === undefined
          ? `${t.name} now applies to ${body.teamId ? teamName.get(body.teamId) ?? 'that team' : 'every team'}.`
          : body.isActive ? `${t.name} is on. Families see it.` : `${t.name} is off. Families no longer see it.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: TemplateRow) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/document-templates/${t.id}?${q}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'The template could not be deleted.' }); return; }
      setOpenId(null);
      setTemplates(prev => prev.filter(r => r.id !== t.id));
      setNotice({ tone: 'good', text: `${t.name} is deleted.` });
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <AdminPageHeader
      crumbs={[{ label: 'Rep Teams' }, { label: currentOrg?.name ?? '' }]}
      title="Document templates"
      actions={canWrite ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setUploading(true)} aria-label="Upload template">
          <Upload size={15} aria-hidden /><span className={ck.btnWord}>Upload template</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;

  return (
    <div className={repKit.page}>
      {header}
      {notice && <PageNotice notice={notice} />}
      {loadError ? (
        <LoadFailed title="We couldn’t load the templates." onRetry={() => { setLoading(true); void load(); }} />
      ) : (
        <>
          <CoachListToolbar lede="A template belongs to the club. It applies to every team or to one team until you switch it off, whatever the season. Families sign again each season." />
          {rows.length === 0 ? (
            <EmptyCard
              icon={<FileText size={20} aria-hidden />}
              title="No templates yet"
              action={canWrite ? <button type="button" className="btn btn-lime" onClick={() => setUploading(true)}>Upload template</button> : undefined}
            >
              Upload the waiver your insurer asks for, a code of conduct or a medical consent. Families see and sign it in their team’s portal.
            </EmptyCard>
          ) : (
            <div className={repKit.tableFrame}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Applies to</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Added</th>
                    <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => (
                    // The whole row opens the template (standard §3.6); the name stays the keyboard's button.
                    <tr key={t.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; setOpenId(t.id); }}>
                      <td>
                        <button type="button" className={`${repKit.nameLink} ${repKit.nameButton}`} onClick={e => { e.stopPropagation(); setOpenId(t.id); }} aria-haspopup="dialog">{t.name}</button>
                      </td>
                      <td>{t.teamId ? teamName.get(t.teamId) ?? 'A team' : 'Every team'}</td>
                      <td><RepChip tone="info">{DOC_TYPE_LABEL[t.documentType] ?? t.documentType}</RepChip></td>
                      <td>{t.isActive ? <RepChip tone="good">Active</RepChip> : <RepChip>Off</RepChip>}</td>
                      <td className={repKit.dim}>{formatStoredDate(t.createdAt, { withYear: false })}</td>
                      <td className={repKit.go}>
                        <span className={repKit.goLink} aria-hidden>
                          <ChevronRight size={16} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {opened && (
        <TemplateDialog
          template={opened}
          teams={teams}
          canWrite={canWrite}
          busy={busy}
          onClose={() => setOpenId(null)}
          onDownload={() => void download(opened)}
          onPatch={body => patch(opened, body)}
          onDelete={() => remove(opened)}
        />
      )}
      {uploading && (
        <UploadTemplateDialog
          orgSlug={orgSlug}
          teams={teams}
          onClose={() => setUploading(false)}
          onUploaded={async name => {
            setUploading(false);
            setNotice({ tone: 'good', text: `${name} is uploaded and on.` });
            await load();
          }}
        />
      )}
    </div>
  );
}
