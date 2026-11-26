'use client';
/**
 * Prospect clubs, the screen (Club Website Track P, Session P2; drawing tab 2). A table on a computer that becomes cards
 * at 640 px (the global `table-cards` recipe, as Clubs & portals), each card one tap target at least 60 px tall; the
 * state pill on the name line. Count left; Search and Make a club for a meeting right (/design).
 *
 * Where a row goes (Session P3): an open preview opens its room window (tab 4); a claimed one opens its claim window
 * (who claimed, the plan, Undo the claim, the way into Clubs & portals); a removed one has nowhere to go.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import { MAKE_WORDS, OPEN_PREVIEW_CAP, prospectCountLine, prospectCounts, type ProspectRow } from '@/lib/prospect-clubs';
import kit from '../console.module.css';
import styles from './prospect-clubs.module.css';
import MakeClubWindow from './MakeClubWindow';
import RoomWindow from './RoomWindow';
import ClaimedWindow from './ClaimedWindow';

/** A claimed row's facts (tab 2): its plan line ("Club, on trial") and the claimant's masked email (T15). */
export type ClaimedFacts = { plan: string; claimant: string | null; planStarted: boolean };

const STATE_LABEL: Record<ProspectRow['state'], string> = { open: 'Preview', claimed: 'Claimed', removed: 'Removed' };

function rowHref(r: ProspectRow): string | null {
  if (r.state === 'open') return `/${r.slug}`;
  if (r.state === 'claimed') return `/platform-admin/orgs/${r.orgId}`;
  return null;
}

export default function ProspectClubsScreen({ rows, claimed = {} }: { rows: ProspectRow[]; claimed?: Record<string, ClaimedFacts> }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(false);
  const [made, setMade] = useState<{ name: string; slug: string; orgId: string } | null>(null);
  // Tab 3: when the club is ready, its room window opens (Session P3), with the link, the QR and the code.
  const [room, setRoom] = useState<{ orgId: string; name: string } | null>(null);
  const [opened, setOpened] = useState<ProspectRow | null>(null);
  const open = prospectCounts(rows).open;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter(r => r.name.toLowerCase().includes(t) || r.slug.includes(t)) : rows;
  }, [rows, q]);

  const makeButton = (
    <button type="button" className="btn btn-primary" onClick={() => { setMade(null); setMaking(true); }}>{MAKE_WORDS.title}</button>
  );

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Prospect clubs" />
      <p className={kit.caption}>
        Up to {OPEN_PREVIEW_CAP} previews can be open at a time. Each is removed 30 days after its meeting unless the club claims it.
      </p>

      {made && (
        <div className={`${kit.notice} ${kit.noticeGood}`} role="status">
          {made.name}’s preview is ready, with its sample season and tournament.{' '}
          <a href={`/${made.slug}`} target="_blank" rel="noopener noreferrer" className={kit.door}>Open its site ›</a>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <strong>No prospect clubs yet</strong>
          <span>
            Before a meeting, make a preview of the club’s site: its name, logo and colours on a made-up season. You get a
            link, a QR code and a claim code for the room. The preview is removed 30 days after the meeting unless the club
            claims it.
          </span>
          {makeButton}
        </div>
      ) : (
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>{prospectCountLine(rows)}</span>
            <span className={kit.toolbarEnd}>
              <input type="search" className={kit.search} placeholder="Search a club" aria-label="Search prospect clubs by name or web address"
                value={q} onChange={e => setQ(e.target.value)} />
              {makeButton}
            </span>
          </div>
          <div className={`${kit.tableWrap} table-cards ${styles.list}`}>
            <table>
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Meeting</th>
                  <th>Removal date</th>
                  <th>Made by</th>
                  <th>State</th>
                  <th aria-label="Open"></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={6} className={kit.empty}>No prospect club matches “{q.trim()}”.</td></tr>
                )}
                {shown.map(r => <Row key={r.orgId} r={r} facts={claimed[r.orgId] ?? null} onOpen={() => setOpened(r)} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {opened?.state === 'open' && (
        <RoomWindow orgId={opened.orgId} name={opened.name} onClose={() => setOpened(null)} onChanged={() => router.refresh()} />
      )}
      {room && !opened && (
        <RoomWindow orgId={room.orgId} name={room.name} onClose={() => setRoom(null)} onChanged={() => router.refresh()} />
      )}
      {opened?.state === 'claimed' && (
        <ClaimedWindow row={opened} facts={claimed[opened.orgId] ?? null} onClose={() => setOpened(null)}
          onUndone={() => router.refresh()} />
      )}

      {making && (open >= OPEN_PREVIEW_CAP
        ? <CapWindow onClose={() => setMaking(false)} />
        : <MakeClubWindow onClose={() => setMaking(false)}
            onMade={m => { setMaking(false); setMade(m); setRoom({ orgId: m.orgId, name: m.name }); router.refresh(); }} />)}
    </div>
  );
}

function Row({ r, facts, onOpen }: { r: ProspectRow; facts: ClaimedFacts | null; onOpen: () => void }) {
  const href = rowHref(r);
  const pill = <span className={`${kit.chip} ${r.state === 'open' ? styles.pillOpen : r.state === 'claimed' ? kit.chipOk : kit.chipQuiet}`}>{STATE_LABEL[r.state]}</span>;
  // The name opens the row's window; a claimed row's line under it goes straight into Clubs & portals (tab 2).
  const name = href
    ? <button type="button" className={`${kit.nameLink} ${styles.nameButton}`} onClick={onOpen}>{r.name}</button>
    : <span className={styles.plainName}>{r.name}</span>;
  const planLine = r.claimedDay ? `${r.claimedDay} · ${facts?.plan ?? 'No plan yet'}` : null;
  return (
    <tr className={`${href ? kit.clickableRow : ''} ${styles.row} ${r.state === 'removed' ? styles.removed : ''}`}
      onClick={e => {
        if (!href || (e.target as HTMLElement).closest('a, button, input')) return;
        if ((window.getSelection()?.toString() ?? '').length > 0) return;
        onOpen();
      }}>
      <td className="table-cards-title">
        <span className={styles.nameLine}>{name}<span className={styles.phonePill}>{pill}</span></span>
        {r.state === 'claimed' && href
          ? <Link href={href} className={`${kit.sub} ${kit.door} ${styles.deskOnly}`}>Open in Clubs & portals</Link>
          : <span className={kit.sub}>{`fieldlogichq.ca/${r.slug}`}</span>}
        {/* The phone card's one line for a finished row (drawing tab 2): the State column is gone there. */}
        {r.state !== 'open' && (
          <span className={`${kit.sub} ${styles.phoneOnly}`}>
            {r.state === 'claimed' ? `Claimed ${planLine}` : r.removal ? `Removed ${r.removal.date}` : 'Removed'}
          </span>
        )}
      </td>
      <td data-label="Meeting" className={r.state !== 'open' ? styles.deskOnly : undefined}>
        {r.state === 'open' ? <>{r.meeting}<span className={kit.sub}>{r.meetingWhen}</span></> : r.meetingDay}
      </td>
      <td data-label={r.state === 'removed' ? 'Removed' : 'Comes down'} className={r.state !== 'open' ? styles.deskOnly : undefined}>
        {r.removal ? <>{r.removal.date}{r.removal.left && <span className={kit.sub}>{r.removal.left}</span>}</> : 'None'}
      </td>
      <td data-label="Made by">{r.madeBy}</td>
      <td data-label="State" className={styles.stateCell}>
        {pill}
        {planLine && <span className={kit.sub}>{planLine}</span>}
        {facts?.claimant && <span className={kit.sub}>by {facts.claimant}</span>}
      </td>
      <td className={kit.rowDoor} aria-hidden>{href ? '›' : ''}</td>
    </tr>
  );
}

function CapWindow({ onClose }: { onClose: () => void }) {
  return (
    <KitDialog kind="question" title={MAKE_WORDS.capTitle} onClose={onClose}
      footer={<DialogCancel className="btn btn-primary">Close</DialogCancel>}>
      <p>{MAKE_WORDS.cap}</p>
    </KitDialog>
  );
}
