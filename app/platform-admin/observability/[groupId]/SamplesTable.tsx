'use client';
/**
 * An issue's recent samples as a table, each opening in a window (Support console Stage 5, Part 5; drawing C2 and C3).
 *
 * A column answers "who did this hit?", so the samples are a table — When · Who · Club · Source · Status code — and not a
 * stack of collapsed cards. The person and the club are links to their records (the server decided which links this viewer
 * may have: `lib/observability/sample-people.ts`); a sample with nobody signed in, a staff account the viewer may not open, or
 * an account since gone says so in words, with no link. The whole row opens the sample's window (640 wide, like an audit
 * entry): the message, the redacted stack and the redacted request context, as the cards showed them. The IP address and
 * browser a client error also stores are never read, so they are not here (T27).
 *
 * The rows arrive ready to draw — times formatted in the house clock on the server — so the browser never builds a time.
 */
import { useState } from 'react';
import Link from 'next/link';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import type { SampleWho, SampleClub } from '@/lib/observability/sample-who';
import kit from '../../console.module.css';
import styles from '../observability.module.css';

export interface SampleView {
  id: string;
  /** "Oct 26, 9:12 a.m." */
  when: string;
  who: SampleWho;
  club: SampleClub;
  /** "Server" or "Client" — the words the screen has always used. */
  source: string;
  statusCode: number | null;
  /** "GET /[orgSlug]/admin/…" — a sample's own route can differ from the issue's. */
  route: string;
  requestId: string | null;
  message: string | null;
  stack: string | null;
  /** The redacted request context, already pretty-printed. */
  context: string;
}

/** Someone dragging to copy an address ends the drag inside the row: that is not a request to open it. */
function selectingText(): boolean {
  return (window.getSelection()?.toString() ?? '').length > 0;
}

/** The Who cell, and the window's Who line: name over address and role, or the honest blank. */
function WhoCell({ who }: { who: SampleWho }) {
  switch (who.kind) {
    case 'person':
      return (
        <>
          {who.href ? (
            <Link href={who.href} className={kit.nameLink} onClick={e => e.stopPropagation()}>{who.name}</Link>
          ) : (
            <span>{who.name}</span>
          )}
          <span className={kit.sub}>{who.name !== who.email ? `${who.email} · ` : ''}{who.role ?? 'No role recorded'}</span>
        </>
      );
    case 'staff':
      return (
        <>
          <span>A staff account</span>
          <span className={kit.sub}>Only Super admin opens staff records</span>
        </>
      );
    case 'gone':
      return (
        <>
          <span>No longer has an account</span>
          {who.email && <span className={kit.sub}>{who.email}</span>}
        </>
      );
    case 'text':
      return (
        <>
          <span>{who.email}</span>
          {who.role && <span className={kit.sub}>{who.role}</span>}
        </>
      );
    case 'unread':
      return <span className={kit.muted}>Could not read this account</span>;
    default:
      return <span className={kit.muted}>Nobody signed in</span>;
  }
}

function ClubCell({ club }: { club: SampleClub }) {
  if (!club) return <span className={kit.muted}>None</span>;
  return club.href
    ? <Link href={club.href} className={kit.nameLink} onClick={e => e.stopPropagation()}>{club.name}</Link>
    : <span>{club.name}</span>;
}

export default function SamplesTable({ rows }: { rows: SampleView[] }) {
  // Kept with the list it came from: a new list shows no window, so one never outlives the rows it was about.
  const rowsKey = rows.map(r => r.id).join(',');
  const [open, setOpen] = useState<{ key: string; id: string | null }>({ key: '', id: null });
  const current = open.key === rowsKey && open.id ? rows.find(r => r.id === open.id) ?? null : null;
  const openSample = (id: string) => setOpen({ key: rowsKey, id });
  const close = () => setOpen({ key: rowsKey, id: null });

  return (
    <>
      <div className={`${kit.tableWrap} table-cards`}>
        <table className={kit.comfortable}>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Club</th>
              <th>Source</th>
              <th className={kit.num}>Status code</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={kit.clickableRow} onClick={() => { if (!selectingText()) openSample(r.id); }}>
                <td className={`${kit.nowrap} table-cards-title`}>{r.when}</td>
                <td data-label="Who"><WhoCell who={r.who} /></td>
                <td data-label="Club"><ClubCell club={r.club} /></td>
                <td data-label="Source">{r.source}</td>
                <td data-label="Status code" className={kit.num}>
                  {r.statusCode != null ? r.statusCode : <span className={kit.muted}>None</span>}
                </td>
                <td className={kit.rowDoor}>
                  <button
                    type="button"
                    className={styles.openBtn}
                    aria-label={`Open the sample from ${r.when}`}
                    onClick={e => { e.stopPropagation(); openSample(r.id); }}
                  >
                    ›
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && (
        <KitDialog
          kind="form"
          size="medium"
          record
          title={`${current.when} · a sample`}
          levelKey={current.id}
          onClose={close}
          footerStart={<span className={styles.windowFoot}>Emails in the message are removed before it is kept.</span>}
          footer={<DialogCancel className="btn btn-secondary">Close</DialogCancel>}
        >
          <div className={styles.eventBody}>
            <div className={styles.sampleFacts}>
              <div>
                <div className={kit.eye}>Who</div>
                <div className={styles.factValue}><WhoCell who={current.who} /></div>
              </div>
              <div>
                <div className={kit.eye}>Club</div>
                <div className={styles.factValue}><ClubCell club={current.club} /></div>
              </div>
              <div>
                <div className={kit.eye}>Source</div>
                <div className={styles.factValue}>
                  {current.source}{current.statusCode != null ? ` · status code ${current.statusCode}` : ''}
                </div>
              </div>
              <div>
                <div className={kit.eye}>Request</div>
                <div className={styles.factValue}>
                  {current.requestId ? <code className={kit.code}>{current.requestId}</code> : <span className={kit.muted}>None</span>}
                </div>
              </div>
              <div className={styles.factWide}>
                <div className={kit.eye}>Route</div>
                <div className={styles.factValue}><code className={kit.code}>{current.route}</code></div>
              </div>
            </div>
            {current.message && (
              <div>
                <div className={`${kit.eye} ${styles.preLabel}`}>Message</div>
                <pre className={styles.pre}>{current.message}</pre>
              </div>
            )}
            <div>
              <div className={`${kit.eye} ${styles.preLabel}`}>Stack trace (redacted)</div>
              <pre className={styles.pre}>{current.stack || '—'}</pre>
            </div>
            <div>
              <div className={`${kit.eye} ${styles.preLabel}`}>Request context (redacted)</div>
              <pre className={styles.pre}>{current.context}</pre>
            </div>
          </div>
        </KitDialog>
      )}
    </>
  );
}
