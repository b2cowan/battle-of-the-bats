'use client';
import { use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import HelpButton from '@/components/help/HelpButton';
import RepAnnouncementEditor from '@/components/coaches/RepAnnouncementEditor';
import { DRAFT_SUBJECT_PARAM, DRAFT_BODY_PARAM } from '@/lib/postgame-draft';
import styles from '../../../coaches.module.css';

export default function TeamAnnouncementsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);
  const base = `/${params.orgSlug}/coaches/teams/${params.teamId}`;

  // Chunk D 3.1 — a draft handed over from the schedule's score entry. Read here rather than
  // inside the editor so the editor stays a plain controlled component with no URL knowledge.
  const searchParams = useSearchParams();
  const draftSubject = searchParams.get(DRAFT_SUBJECT_PARAM);
  const draftBody = searchParams.get(DRAFT_BODY_PARAM);
  const initialDraft = draftSubject && draftBody
    ? { subject: draftSubject, body: draftBody }
    : null;

  if (assignmentsLoading) {
    return <div className={styles.page}><p className={styles.pageSub}>Loading…</p></div>;
  }
  if (!assignment) {
    return <div className={styles.page}><p className={styles.pageSub}>You are not assigned to this team.</p></div>;
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${params.orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={base}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <span>Email families</span>
      </div>

      {/* Header — Chunk B (P1 #1): the DOOR and the DESTINATION must agree. Renaming the nav item
          to "Email families" without renaming the screen it opens would have re-broken the very
          rule the rename cites (a control is named by where it goes), just one step further in.
          "Announcement" stays the noun for an individual sent item; only the place is renamed. */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Email families</h1>
            <p className={styles.pageSub}>{assignment.teamName} — {assignment.programYearName}</p>
          </div>
        </div>
        <HelpButton
          iconOnly
          label="Email families"
          help={{ module: 'coaches', sectionIds: ['recipe-announcements'], fullGuideHref: `/${params.orgSlug}/coaches/help#recipe-announcements` }}
        />
      </div>

      <p className={styles.pageSub} style={{ marginBottom: '1rem' }}>
        One email to every family at once — a rain-out, a time change, what to bring on Saturday.
        It goes to the guardian emails already on your roster, so there&apos;s no second list to keep,
        and every send is logged with who received it.
      </p>

      <RepAnnouncementEditor
        orgSlug={params.orgSlug}
        teamId={params.teamId}
        canEditRoster={assignment.capabilities.rosterWrite}
        initialDraft={initialDraft}
      />
    </div>
  );
}
