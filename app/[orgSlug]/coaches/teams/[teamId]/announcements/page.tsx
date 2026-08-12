'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
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

  // Chunk D 3.1 — a draft handed over from the schedule's score entry. Read here rather than
  // inside the editor so the editor stays a plain controlled component with no URL knowledge.
  const searchParams = useSearchParams();
  const draftSubject = searchParams.get(DRAFT_SUBJECT_PARAM);
  const draftBody = searchParams.get(DRAFT_BODY_PARAM);
  const initialDraft = draftSubject && draftBody
    ? { subject: draftSubject, body: draftBody }
    : null;

  if (assignmentsLoading) {
    return <div className={styles.page}><p className={styles.bodyNote}>Loading…</p></div>;
  }
  if (!assignment) {
    return <div className={styles.page}><p className={styles.bodyNote}>You are not assigned to this team.</p></div>;
  }

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the breadcrumb and the team+season line both retire — the
          masthead already carries every crumb they printed.
          Chunk B (P1 #1): the DOOR and the DESTINATION must agree. Renaming the nav item
          to "Email families" without renaming the screen it opens would have re-broken the very
          rule the rename cites (a control is named by where it goes), just one step further in.
          "Announcement" stays the noun for an individual sent item; only the place is renamed. */}
      <CoachPageHeader
        icon={Mail}
        title="Email families"
        helpLabel="Email families"
        help={{ module: 'coaches', sectionIds: ['recipe-announcements'], fullGuideHref: `/${params.orgSlug}/coaches/help#recipe-announcements` }}
      />

      {/* What this screen is for — kept, and kept HERE: it is the editor's own framing line, the
          first thing read by a coach about to send to every family at once. */}
      <p className={styles.bodyNote} style={{ margin: '0 0 1rem' }}>
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
