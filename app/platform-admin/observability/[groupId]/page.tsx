import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { isPlatformAreaReadOnly } from '@/lib/platform-areas';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import { getErrorGroupDetail, type EventSample } from '@/lib/observability/dashboard';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StatusControls from './StatusControls';
import styles from '../observability.module.css';

export const dynamic = 'force-dynamic';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'badge-danger',
  error: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
};
const STATUS_BADGE: Record<string, string> = {
  open: 'badge-warning',
  resolved: 'badge-success',
  ignored: 'badge-neutral',
  snoozed: 'badge-info',
};
const FB_TYPE_BADGE: Record<string, string> = { bug: 'badge-danger', feature: 'badge-info', feedback: 'badge-neutral' };
const FB_STATUS_BADGE: Record<string, string> = { new: 'badge-warning', triaged: 'badge-info', acknowledged: 'badge-info', resolved: 'badge-success' };

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

const fmtDateTime = (iso: string | null) => fmtAbsoluteDateTime(iso);

function jsonPretty(v: unknown): string {
  if (v === null || v === undefined) return '—';
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function Sparkline({ data }: { data: { label: string; count: number }[] }) {
  const VW = 560, VH = 90, MT = 8, MB = 18, ML = 4, MR = 4;
  const CH = VH - MT - MB;
  const max = Math.max(...data.map(d => d.count), 1);
  const n = data.length;
  const gap = 3;
  const bw = (VW - ML - MR - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Occurrences per day, last 14 days">
      {data.map((d, i) => {
        const h = (d.count / max) * CH;
        const x = ML + i * (bw + gap);
        const y = MT + (CH - h);
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={Math.max(h, d.count > 0 ? 2 : 0)} fill="var(--logic-lime, #84cc16)" opacity={d.count > 0 ? 0.8 : 0.15} />
            {(i === 0 || i === n - 1) && (
              <text x={x + bw / 2} y={VH - 5} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.35)">{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function EventCard({ ev }: { ev: EventSample }) {
  const title = `${ev.http_method ? ev.http_method + ' ' : ''}${ev.route ?? '(no route)'}`;
  return (
    <CollapsibleCard
      defaultOpen={false}
      title={title}
      meta={
        <span className={styles.eventSummary}>
          {ev.status_code != null && <span>{ev.status_code}</span>}
          <span className={`badge ${ev.source === 'client' ? 'badge-info' : 'badge-neutral'}`}>{ev.source ?? 'server'}</span>
          <span>{fmtDateTime(ev.occurred_at)}</span>
        </span>
      }
    >
      <div className={styles.eventBody}>
        <div className={styles.eventSummary}>
          {ev.org_slug && <span>org: <strong style={{ color: 'var(--fl-text)' }}>{ev.org_slug}</strong></span>}
          {ev.user_role && <span>role: {ev.user_role}</span>}
          {ev.user_email && <span>{ev.user_email}</span>}
          {ev.request_id && <span>req: <code>{ev.request_id}</code></span>}
        </div>
        {ev.error_message && (
          <div>
            <div className={styles.eventPreLabel}>Message</div>
            <pre className={styles.pre}>{ev.error_message}</pre>
          </div>
        )}
        <div>
          <div className={styles.eventPreLabel}>Stack trace (redacted)</div>
          <pre className={styles.pre}>{ev.stack_trace || '—'}</pre>
        </div>
        <div>
          <div className={styles.eventPreLabel}>Request context (redacted)</div>
          <pre className={styles.pre}>{jsonPretty(ev.request_context)}</pre>
        </div>
      </div>
    </CollapsibleCard>
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
      <div className={styles.page}>
        <Link href="/platform-admin/observability" className={styles.backLink}><ArrowLeft size={13} /> Observability</Link>
        <div className={styles.detailHeader}>
          <h1 className={styles.detailTitle}>Issue not found</h1>
          <p className={styles.emptyPanel}>This error group does not exist or has been purged.</p>
        </div>
      </div>
    );
  }

  const g = detail.group;
  const related = await getRelatedFeedback(groupId);

  return (
    <div className={styles.page}>
      <Link href="/platform-admin/observability" className={styles.backLink}><ArrowLeft size={13} /> Observability</Link>

      <div className={styles.detailHeader}>
        <div className={styles.detailTitleRow}>
          <AlertTriangle size={18} style={{ color: 'var(--logic-lime)' }} />
          <h1 className={styles.detailTitle}>{g.title || g.error_name || 'Untitled error'}</h1>
          <span className={`badge ${SEVERITY_BADGE[g.severity] ?? 'badge-neutral'}`}>{g.severity}</span>
          <span className={`badge ${STATUS_BADGE[g.status] ?? 'badge-neutral'}`}>{g.status}</span>
          <span className={`badge ${g.env === 'production' ? 'badge-neutral' : 'badge-info'}`}>{g.env}</span>
        </div>

        <div className={styles.fingerprint}>{g.error_name ?? '—'} · fp {g.fingerprint.slice(0, 16)}</div>

        <div className={styles.detailMetaGrid}>
          <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>Route</span><span className={styles.detailMetaValue}>{g.http_method ? `${g.http_method} ` : ''}{g.route ?? '—'}</span></div>
          <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>Occurrences</span><span className={styles.detailMetaValue}>{Number(g.occurrence_count).toLocaleString()}</span></div>
          <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>Affected orgs</span><span className={styles.detailMetaValue}>{Number(g.distinct_org_count).toLocaleString()}</span></div>
          <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>First seen</span><span className={styles.detailMetaValue}>{fmtDateTime(g.first_seen_at)}</span></div>
          <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>Last seen</span><span className={styles.detailMetaValue}>{fmtDateTime(g.last_seen_at)}</span></div>
          {g.status === 'resolved' && (
            <div className={styles.detailMeta}><span className={styles.detailMetaLabel}>Resolved</span><span className={styles.detailMetaValue}>{fmtDateTime(g.resolved_at)}{g.resolved_by ? ` · ${g.resolved_by}` : ''}</span></div>
          )}
          {g.status === 'snoozed' && (
            <div className={styles.detailMeta}>
              <span className={styles.detailMetaLabel}>Snoozed until</span>
              <span className={styles.detailMetaValue}>
                {fmtDateTime(g.snooze_until)}
                {detail.snoozeExpired && <span className={styles.expiredTag}>expired</span>}
              </span>
            </div>
          )}
        </div>

        <StatusControls groupId={g.id} currentStatus={g.status} readOnly={readOnly} />
      </div>

      {related.length > 0 && (
        <>
          <div className={styles.sectionHead}>
            <span className={styles.sectionKicker}>Support</span>
            <h2 className={styles.sectionTitle}>Related feedback</h2>
            <span className={styles.count}>{related.length}</span>
          </div>
          <div className={styles.eventList}>
            {related.map(f => (
              <CollapsibleCard
                key={f.id}
                defaultOpen={false}
                title={f.title ?? f.body.slice(0, 80)}
                meta={
                  <span className={styles.eventSummary}>
                    <span className={`badge ${FB_TYPE_BADGE[f.type] ?? 'badge-neutral'}`}>{f.type}</span>
                    <span className={`badge ${FB_STATUS_BADGE[f.status] ?? 'badge-neutral'}`}>{f.status}</span>
                    <span>{f.user_email ?? f.submitter_name ?? 'anonymous'}</span>
                    <span>{fmtDateTime(f.created_at)}</span>
                  </span>
                }
              >
                <pre className={styles.pre}>{f.body}</pre>
              </CollapsibleCard>
            ))}
            <Link href="/platform-admin/feedback?status=all" className={styles.issueLink}>Open Feedback →</Link>
          </div>
        </>
      )}

      <div className={styles.sparkWrap}>
        <p className={styles.chartTitle}>Occurrences · last 14 days (from sampled events)</p>
        <Sparkline data={detail.daily} />
      </div>

      <div className={styles.sectionHead}>
        <span className={styles.sectionKicker}>Samples</span>
        <h2 className={styles.sectionTitle}>Recent occurrences</h2>
        <span className={styles.count}>{detail.events.length} shown</span>
      </div>

      {detail.events.length === 0 ? (
        <p className={styles.emptyPanel}>No sampled occurrences stored for this issue (they may have been purged after 30 days).</p>
      ) : (
        <div className={styles.eventList}>
          {detail.events.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  );
}
