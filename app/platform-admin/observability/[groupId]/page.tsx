import Link from 'next/link';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { isPlatformAreaReadOnly } from '@/lib/platform-areas';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { getErrorGroupDetail } from '@/lib/observability/dashboard';
import { issueSentence } from '@/lib/observability/issue-title';
import { resolveSampleSubjects } from '@/lib/observability/sample-people';
import { consoleClock, consoleDay, consoleWhen } from '@/lib/console-dates';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StatusControls from './StatusControls';
import SamplesTable, { type SampleView } from './SamplesTable';
import { cap, severityChip, issueStatusChip, feedbackTypeChip, feedbackStatusChip } from '../../chips';
import kit from '../../console.module.css';
import styles from '../observability.module.css';

export const dynamic = 'force-dynamic';

const BACK = { href: '/platform-admin/observability', label: 'Errors' };

type RelatedFeedback = {
  id: string; type: string; status: string; title: string | null; body: string;
  user_email: string | null; submitter_name: string | null; created_at: string;
};

/** Reverse of the feedback "View related issue" link: feedback whose context.requestId
 *  matches a request_id captured on this group's stored events. */
async function getRelatedFeedback(groupId: string): Promise<RelatedFeedback[]> {
  const { data: events } = await supabaseAdmin
    .from('error_events')
    .select('request_id')
    .eq('group_id', groupId)
    .not('request_id', 'is', null);
  const reqIds = [...new Set((events ?? []).map(e => e.request_id as string | null).filter((v): v is string => !!v))];
  if (reqIds.length === 0) return [];
  const { data } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id, type, status, title, body, user_email, submitter_name, created_at')
    .in('context->>requestId', reqIds)
    .order('created_at', { ascending: false })
    .limit(25);
  return (data ?? []) as RelatedFeedback[];
}

function jsonPretty(v: unknown): string {
  if (v === null || v === undefined) return '—';
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function Sparkline({ data }: { data: { label: string; count: number }[] }) {
  const VW = 1100, VH = 110, MT = 8, MB = 22, ML = 4, MR = 4;
  const CH = VH - MT - MB;
  const max = Math.max(...data.map(d => d.count), 1);
  const n = data.length;
  const gap = 4;
  const bw = (VW - ML - MR - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Occurrences per day, last 14 days">
      {data.map((d, i) => {
        const h = (d.count / max) * CH;
        const x = ML + i * (bw + gap);
        const y = MT + (CH - h);
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={Math.max(h, d.count > 0 ? 2 : 0)} rx={2} style={{ fill: 'var(--home-olive)' }} opacity={d.count > 0 ? 0.8 : 0.15} />
            {(i === 0 || i === n - 1) && (
              <text x={x + bw / 2} y={VH - 6} textAnchor="middle" style={{ fill: 'var(--text-tertiary)', fontSize: 'var(--type-label)' }}>{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default async function ErrorGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const auth = await requirePlatformAreaView('observability');
  const readOnly = isPlatformAreaReadOnly(auth.role, 'observability');

  const { groupId } = await params;
  const detail = await getErrorGroupDetail(groupId);

  if (!detail) {
    return (
      <div className={`${kit.page} ${kit.reading}`}>
        <AdminPageHeader title="Issue not found" backTo={BACK} />
        <div className={`${kit.card} ${kit.cardPad}`}>
          <p className={styles.emptyPanel}>This error group does not exist or has been purged.</p>
        </div>
      </div>
    );
  }

  const g = detail.group;
  const [related, subjects] = await Promise.all([
    getRelatedFeedback(groupId),
    resolveSampleSubjects(detail.events, auth.role),
  ]);

  // The samples arrive ready to draw: the house clock (Toronto zone) and the viewer's links are decided here, on the server.
  const samples: SampleView[] = detail.events.map(ev => ({
    id: ev.id,
    when: consoleWhen(ev.occurred_at),
    who: subjects.who.get(ev)!,
    club: subjects.club.get(ev) ?? null,
    source: cap(ev.source ?? 'server'),
    statusCode: ev.status_code,
    route: `${ev.http_method ? ev.http_method + ' ' : ''}${ev.route ?? '(no route)'}`,
    requestId: ev.request_id,
    message: ev.error_message,
    stack: ev.stack_trace,
    context: jsonPretty(ev.request_context),
  }));

  return (
    <div className={kit.page}>
      <AdminPageHeader
        title={issueSentence(g.title, g.error_name, g.route)}
        backTo={BACK}
        titleChips={
          <>
            <span className={`${kit.chip} ${severityChip(g.severity)}`}>{cap(g.severity)}</span>
            <span className={`${kit.chip} ${issueStatusChip(g.status)}`}>{cap(g.status)}</span>
            <span className={`${kit.chip} ${g.env === 'production' ? kit.chipQuiet : kit.chipInfo}`}>{cap(g.env)}</span>
          </>
        }
      />

      <p className={`${kit.caption} ${kit.code}`}>{g.error_name ?? '—'} · fp {g.fingerprint.slice(0, 16)}</p>

      <section className={kit.band} aria-label="Issue facts">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Route</span>
          <span className={`${kit.bandValueText} ${kit.code}`}>{g.http_method ? `${g.http_method} ` : ''}{g.route ?? '—'}</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Occurrences</span>
          <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{Number(g.occurrence_count).toLocaleString()}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Affected orgs</span>
          <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{Number(g.distinct_org_count).toLocaleString()}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>First seen</span>
          <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{consoleDay(g.first_seen_at)}</strong>
          <span className={kit.bandNote}>at {consoleClock(g.first_seen_at)}</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Last seen</span>
          <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{consoleDay(g.last_seen_at)}</strong>
          <span className={kit.bandNote}>at {consoleClock(g.last_seen_at)}</span>
        </div>
        {g.status === 'resolved' && (
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Resolved</span>
            <span className={kit.bandValueText}>{consoleWhen(g.resolved_at)}{g.resolved_by ? ` · ${g.resolved_by}` : ''}</span>
          </div>
        )}
        {g.status === 'snoozed' && (
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Snoozed until</span>
            <span className={kit.bandValueText}>
              {consoleWhen(g.snooze_until)}
              {detail.snoozeExpired && <>{' '}<span className={`${kit.chip} ${kit.chipWarn}`}>Expired</span></>}
            </span>
          </div>
        )}
      </section>

      <div className={`${kit.card} ${kit.cardPad}`}>
        <StatusControls groupId={g.id} currentStatus={g.status} readOnly={readOnly} />
      </div>

      {related.length > 0 && (
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>
            Related feedback <span className={styles.titleCount}>{related.length}</span>
          </h2>
          <div className={kit.card}>
            {/* Each row opens the feedback's own record (Stage 5, drawing D). */}
            {related.map(f => (
              <Link key={f.id} href={`/platform-admin/feedback/${f.id}`} className={styles.relatedRow}>
                <span className={styles.relatedTitle}>{f.title ?? f.body.slice(0, 80)}</span>
                <span className={`${kit.chip} ${feedbackTypeChip(f.type)}`}>{cap(f.type)}</span>
                <span className={`${kit.chip} ${feedbackStatusChip(f.status)}`}>{cap(f.status)}</span>
                <span className={kit.countQuiet}>{f.submitter_name ?? f.user_email ?? 'Not signed in'}</span>
                <span className={kit.countQuiet}>{consoleWhen(f.created_at)}</span>
                <span className={styles.relatedGo} aria-hidden>›</span>
              </Link>
            ))}
          </div>
          <Link href="/platform-admin/feedback?status=all" className={kit.door}>Open Feedback →</Link>
        </section>
      )}

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Occurrences · last 14 days (from samples)</h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          <Sparkline data={detail.daily} />
        </div>
      </section>

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>
          Recent samples <span className={styles.titleCount}>{samples.length} shown</span>
        </h2>
        <p className={kit.caption}>Every time up to 50, then one in ten.</p>
        {samples.length === 0 ? (
          <div className={`${kit.card} ${kit.cardPad}`}>
            <p className={styles.emptyPanel}>No samples are stored for this issue (they may have been purged after 30 days).</p>
          </div>
        ) : (
          <div className={kit.card}>
            <SamplesTable rows={samples} />
          </div>
        )}
      </section>
    </div>
  );
}
