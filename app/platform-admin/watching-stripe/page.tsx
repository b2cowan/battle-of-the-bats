import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { readReplayedToday, readWatchingStripe, type ReplayedLine } from '@/lib/watching-stripe';
import { REPLAY_WINDOW } from '@/lib/billing-event-replay';
import { FindUpdate, ReplayDoor } from './ReplayDoors';
import {
  WS, checkIsStale, figureBand, needsALook, settingChip, settingPassWords, shownError,
  type DriftRead, type FeedRead, type SettingRow,
} from '@/lib/watching-stripe-words';
import { stripeDashboardBase } from '@/lib/stripe-mode';
import { consoleWhen } from '@/lib/console-dates';
import kit from '../console.module.css';
import styles from './watching-stripe.module.css';

export const metadata: Metadata = { title: 'Stripe — Support console' };
export const dynamic = 'force-dynamic';

/**
 * HEALTH › STRIPE (Plans & pricing Stage 2 Part 3; drawings tab 10; owner go 2026-11-07). Super admin, Billing, Support and
 * Product read it. ⚠ The page's ONE write is Part 5's replay (Session 2; `ReplayDoors.tsx`), drawn for Super admin only (the
 * `replay_events` power): the word "Replay" on each line of "What failed in Plan billing" and the "Replay an update by its id"
 * card. Every other role reads the page as before, and the server refuses them. A replay never asks Stripe to change anything.
 * Family payments are never replayed (ruling 5): their failing lines carry no door. A part that could not be read says so; it
 * never reads as "nothing to see".
 */

const TONE = { ok: kit.chipOk, warn: kit.chipWarn, bad: kit.chipBad };

const Tile = ({ label, value, warn, small }: { label: string; value: ReactNode; warn?: boolean; small?: boolean }) => (
  <div className={`${kit.bandCell} ${warn ? kit.bandWarn : ''}`}>
    <span className={kit.bandLabel}>{label}</span>
    <strong className={`${kit.bandValue} ${small ? kit.bandValueSm : ''}`}>{value}</strong>
  </div>
);

const FeedRow = ({ feed }: { feed: FeedRead }) => (
  <tr>
    <td>{WS.feeds.name[feed.key]}</td>
    <td>{feed.lastReceived ? consoleWhen(feed.lastReceived) : WS.feeds.never}</td>
    <td>
      {feed.failing > 0 ? <span className={`${kit.chip} ${kit.chipBad}`}>{feed.failing}</span> : WS.feeds.none}
      {feed.stuck ? <div className={kit.caption}>{WS.feeds.stuck(feed.stuck)}</div> : null}
    </td>
    <td>{feed.ignored ? WS.feeds.ignoredWords(feed.ignored) : WS.feeds.notRecorded}</td>
    <td>
      {feed.ignored
        ? (feed.ignored.wrongMode > 0 ? <span className={`${kit.chip} ${kit.chipWarn}`}>{feed.ignored.wrongMode}</span> : WS.feeds.none)
        : WS.feeds.notRecorded}
    </td>
  </tr>
);

function Feeds({ billing, connect, canReplay, replayed }: {
  billing: FeedRead | null; connect: FeedRead | null; canReplay: boolean; replayed: ReplayedLine[] | null;
}) {
  // A replayed update leaves the failing list; its line stays for the rest of the day (unless it is failing again).
  const failingIds = new Set(billing?.failures.map(f => f.id) ?? []);
  const replayedLines = (replayed ?? []).filter(r => !failingIds.has(r.eventId));
  const hasLines = (f: FeedRead) => f.failures.length > 0 || (f.key === 'plan_billing' && replayedLines.length > 0);
  const withFailures = [billing, connect].filter((f): f is FeedRead => !!f && hasLines(f));
  return (
    <>
      <h2 className={kit.sectionTitle}>{WS.feeds.title}</h2>
      <div className={kit.card}>
      <div className={`${kit.cardPad} ${styles.notes} ${billing || connect ? styles.notesAboveTable : ''}`}>
        <p className={kit.caption}>{WS.feeds.lede}</p>
        {!billing && <p className={kit.caption} role="alert">{WS.feeds.name.plan_billing}: {WS.readFailed}</p>}
        {!connect && <p className={kit.caption} role="alert">{WS.feeds.name.family_payments}: {WS.readFailed}</p>}
      </div>
      {(billing || connect) && (
        <div className={kit.tableWrap}>
          <table className={kit.comfortable}>
            <thead>
              <tr>
                <th>{WS.feeds.col.feed}</th><th>{WS.feeds.col.last}</th><th>{WS.feeds.col.failing}</th>
                <th>{WS.feeds.col.ignored}</th><th>{WS.feeds.col.wrongMode}</th>
              </tr>
            </thead>
            <tbody>
              {billing && <FeedRow feed={billing} />}
              {connect && <FeedRow feed={connect} />}
            </tbody>
          </table>
        </div>
      )}
      {withFailures.map(feed => (
        <div key={feed.key} className={`${kit.cardPad} ${styles.failures}`}>
          <h3 className={kit.label}>{WS.feeds.failuresTitle(WS.feeds.name[feed.key])}</h3>
          <ul className={styles.failureList}>
            {feed.failures.map(f => (
              <li key={f.id} className={styles.failureLine}>
                <span><span className={kit.code}>{f.type}</span> · {consoleWhen(f.receivedAt)} · {shownError(f.error)}</span>
                {canReplay && feed.key === 'plan_billing' && <ReplayDoor eventId={f.id} eventType={f.type} />}
              </li>
            ))}
            {feed.key === 'plan_billing' && replayedLines.map(r => (
              <li key={`replayed:${r.eventId}`} className={styles.failureLine}>
                <span>
                  <span className={kit.code}>{r.type}</span> ·{' '}
                  <span className={`${kit.chip} ${kit.chipOk} ${styles.replayedChip}`}>{REPLAY_WINDOW.replayed}</span>
                  {REPLAY_WINDOW.replayedBy(consoleWhen(r.at), r.who)}
                </span>
              </li>
            ))}
          </ul>
          {feed.failing > feed.failures.length && <p className={kit.caption}>{WS.feeds.more(feed.failing - feed.failures.length)}</p>}
        </div>
      ))}
      </div>
      {/* Said once, here, so it shows even when the plan-billing list above is empty (a failed read is never "no replays today"). */}
      {replayed === null && <p className={kit.caption} role="alert">{REPLAY_WINDOW.replayedUnread}</p>}
      {canReplay && <FindUpdate />}
    </>
  );
}

function Drift({ drift, now }: { drift: DriftRead | null; now: Date }) {
  const showsTable = !!drift && drift.state === 'read' && drift.outcome === 'differs';
  return (
    <>
      <h2 className={kit.sectionTitle}>{WS.drift.title}</h2>
      <div className={kit.card}>
      <div className={`${kit.cardPad} ${styles.notes} ${showsTable ? styles.notesAboveTable : ''}`}>
        <p className={kit.caption}>{WS.drift.lede}</p>
        {!drift ? (
          <p className={kit.caption} role="alert">{WS.readFailed}</p>
        ) : drift.state === 'none' ? (
          <p className={kit.callout}>{WS.drift.none}</p>
        ) : (
          <>
            <p className={kit.caption}>{WS.drift.checkedAt(consoleWhen(drift.checkedAt))}</p>
            {checkIsStale(drift.checkedAt, now) && (
              <p className={`${kit.callout} ${kit.calloutWarn}`} role="status">{WS.drift.stale(consoleWhen(drift.checkedAt))}</p>
            )}
            {drift.outcome === 'could_not_compare' ? (
              <p className={`${kit.callout} ${kit.calloutWarn}`} role="status">{WS.drift.couldNot(drift.error)}</p>
            ) : drift.outcome === 'equal' ? (
              <p className={kit.caption}>{WS.drift.equal(drift.recordsCompared)}</p>
            ) : (
              <p className={kit.caption}>{WS.drift.counted(drift.differenceCount, drift.recordsCompared)}</p>
            )}
          </>
        )}
      </div>
      {drift && drift.state === 'read' && drift.outcome === 'differs' && (
        <>
          <div className={kit.tableWrap}>
            <table className={kit.comfortable}>
              <thead><tr><th>{WS.drift.col.club}</th><th>{WS.drift.col.what}</th></tr></thead>
              <tbody>
                {drift.lines.map((l, i) => (
                  <tr key={`${l.subscriptionId}:${l.kind}:${i}`}>
                    <td>
                      {l.orgId
                        ? <Link href={`/platform-admin/orgs/${l.orgId}?tab=money`}>{l.name || WS.drift.aClub}</Link>
                        : <a href={`${stripeDashboardBase()}/subscriptions/${l.subscriptionId}`} target="_blank" rel="noreferrer">{WS.drift.unknownClub}</a>}
                    </td>
                    <td>{l.words}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {drift.differenceCount > drift.lines.length && (
            <div className={kit.cardPad}>
              <p className={kit.caption}>{WS.drift.more(drift.differenceCount - drift.lines.length)}</p>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}

function Settings({ settings }: { settings: SettingRow[] | null }) {
  const F = WS.settings.failedTry;
  const stripeLink = `${stripeDashboardBase()}/settings/billing/automatic`;
  return (
    <>
      <h2 className={kit.sectionTitle}>{WS.settings.title}</h2>
      <div className={kit.card}>
      <div className={`${kit.cardPad} ${styles.notes} ${styles.notesAboveTable}`}>
        <p className={kit.caption}>{WS.settings.lede}</p>
        {!settings && <p className={kit.caption} role="alert">{WS.settings.unreadable}. {WS.readFailed}</p>}
      </div>
      <div className={kit.tableWrap}>
        <table className={`${kit.comfortable} ${styles.settingsTable}`}>
          <colgroup><col className={styles.colSetting} /><col className={styles.colStatus} /><col /></colgroup>
          <thead>
            <tr><th>{WS.settings.col.setting}</th><th>{WS.settings.col.status}</th><th>{WS.settings.col.detail}</th></tr>
          </thead>
          <tbody>
            {(settings ?? []).map(s => {
              const chip = settingChip(s.status);
              return (
                <tr key={s.key}>
                  <td>{WS.settings.label[s.key] ?? s.key}</td>
                  <td><span className={`${kit.chip} ${TONE[chip.tone]}`}>{chip.text}</span></td>
                  <td>{s.status === 'PASS' ? settingPassWords(s.key) : s.detail}</td>
                </tr>
              );
            })}
            {/* The failed-try outcome is never a pass or a fail: Stripe does not let the product read it. */}
            <tr>
              <td>{F.label}</td>
              <td><span className={`${kit.chip} ${kit.chipInfo}`}>{F.state}</span></td>
              <td>
                {F.body}{' '}
                <a className={kit.door} href={stripeLink} target="_blank" rel="noreferrer">{F.link}</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

export default async function WatchingStripePage() {
  const auth = await requirePlatformAreaView('watching_stripe');
  const canReplay = hasPlatformPower(auth.role, 'replay_events');
  const [read, replayed] = await Promise.all([readWatchingStripe(), readReplayedToday().catch(() => null)]);
  const now = new Date();
  const need = needsALook(read, now);
  const fig = figureBand(read);
  const dash = WS.tiles.dash;

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title={WS.title}
        titleChips={<span className={`${kit.chip} ${need === 0 ? kit.chipOk : kit.chipWarn}`}>{WS.chip(need)}</span>}
      />
      <p className={`${kit.caption} ${kit.captionTight}`}>{WS.intro} {WS.mode[read.mode]}.</p>

      <section className={kit.band} aria-label={WS.tiles.glanceLabel}>
        <Tile small label={WS.tiles.lastUpdate} value={fig.lastUpdate ? consoleWhen(fig.lastUpdate) : fig.feedsUnknown ? WS.tiles.unknown : WS.tiles.never} />
        <Tile label={WS.tiles.stillFailing} value={fig.failing ?? dash} warn={(fig.failing ?? 0) > 0} />
        <Tile label={WS.tiles.disagree} value={fig.disagree ?? dash} warn={(fig.disagree ?? 0) > 0} />
        <Tile label={WS.tiles.settings} value={fig.settingsToCheck ?? dash} warn={(fig.settingsToCheck ?? 0) > 0} />
      </section>

      <section className={styles.section}><Feeds billing={read.billing} connect={read.connect} canReplay={canReplay} replayed={replayed} /></section>
      <section className={styles.section}><Drift drift={read.drift} now={now} /></section>
      <section className={styles.section}><Settings settings={read.settings} /></section>
    </div>
  );
}
