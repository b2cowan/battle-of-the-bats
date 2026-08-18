'use client';
import { useState, useEffect, use } from 'react';
import { Download, FileText } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import styles from '../../../coaches.module.css';
import type { RepDocumentType } from '@/lib/types';

const DOC_TYPE_LABELS: Record<RepDocumentType, string> = {
  waiver:           'Waiver',
  medical_consent:  'Medical Consent',
  code_of_conduct:  'Code of Conduct',
  other:            'Other',
};

interface TemplateRow {
  id: string;
  teamId: string | null;
  name: string;
  documentType: RepDocumentType;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  publishedBy: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

export default function TeamDocumentsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { loading: assignmentsLoading } = useCoaches();
  // Which SEASON is on screen — the team's LIVE one, always. ⚠ `page.canWrite()` is GONE
  // (2026-08-18): a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(params.orgSlug, params.teamId);
  const apiBase = `/api/coaches/${params.orgSlug}/teams/${params.teamId}/documents/templates`;

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // No `label` — HelpButton falls back to its own `label` prop, so the string lives in one place.
  const documentsHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['recipe-track-documents'],
    fullGuideHref: `/${params.orgSlug}/coaches/help#recipe-track-documents`,
  };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!assignmentsLoading) load();
  }, [assignmentsLoading, params.teamId]);

  const orgWide = templates.filter(t => t.teamId === null);
  const teamSpecific = templates.filter(t => t.teamId !== null);

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (assignmentsLoading || loading) return <div className={styles.loadingState}>Loading documents…</div>;

  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  function TemplateTable({ rows }: { rows: TemplateRow[] }) {
    if (rows.length === 0) return <p className={styles.detailPlaceholder}>No templates yet.</p>;
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>File</th>
              <th className={styles.th}>Size</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 600 }}>{t.name}</td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles.badgeTryout}`}>
                    {DOC_TYPE_LABELS[t.documentType] ?? t.documentType}
                  </span>
                </td>
                <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.6))', fontSize: '0.82rem' }}>
                  {t.fileName}
                </td>
                <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: '0.82rem' }}>
                  {formatBytes(t.fileSize)}
                </td>
                <td className={styles.td} style={{ textAlign: 'right' }}>
                  {t.downloadUrl ? (
                    <a
                      href={t.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={t.fileName}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Download size={13} /> Download
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Page-header ruling 2026-08-11: the breadcrumb retires (the masthead and the title state
          every crumb), the team+season line goes with it (both are the masthead's), and the page
          joins the portal's one icon convention. */}
      <CoachPageHeader
        icon={FileText}
        title="Documents"
        helpLabel="Documents"
        help={documentsHelpRequest}
      />

      {orgWide.length === 0 && teamSpecific.length === 0 && (
        // No-action empty: coaches DOWNLOAD templates here, they don't publish them (the org admin
        // does). Signed forms are collected per player from the roster, not on this page — so this
        // carries no CTA rather than pointing at a door the coach can't open.
        <CoachEmptyState
          quiet
          icon={<FileText size={20} aria-hidden />}
          headline="No document templates yet"
          description="This is where the blank forms your families need to sign live — waivers, medical consent, codes of conduct — ready to download and hand out."
          payoff="Once a family returns a signed copy, you attach it to that player on your Roster, so the paperwork sits with the player it belongs to instead of in your inbox."
          blocker="Your organization publishes these templates, so nothing appears here until they do — ask your org admin if you're expecting one."
        />
      )}

      {/* Org-wide templates */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Org-Wide Templates</p>
        <TemplateTable rows={orgWide} />
      </div>

      {/* Team templates */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Team Templates</p>
        <TemplateTable rows={teamSpecific} />
      </div>

    </div>
  );
}
