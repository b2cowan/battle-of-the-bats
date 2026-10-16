'use client';
/**
 * THE TEAMS, EACH ONE'S STANDING WITH THE CLUB (Club Tier Stage 3b, Ask 4e — moved WHOLE to Accounting › Teams by Club
 * Accounting · Teams, Ask 1, owner 2026-10-16; the Overview keeps a card with two counts and a door).
 *
 *   desk  — group bands, Allocated · Collected · Outstanding (the overdue / sent caption; a closed year's line under it,
 *           Ask 8) · Requests (the amber count; a red "holding up a payout") · CASH ON HAND · HELD BY THE TEAM — the
 *           column the screen reads but doesn't own (standard §3.5): a lock and the owner's name in its heading, blank in
 *           the closing row. The NAME is the link; the row is the shortcut.
 *   phone — one framed row per team: the name and the amber count, the red overdue (or "Holding up a payout"), what is
 *           owed, a closed year's line, and "Held by the team …" on every row.
 * The year's figures (the year rule) — an earlier year's money rides under Outstanding as its own line, never added in.
 * The figures are the server's (`buildBoardSummary`); this file formats and adds the shown rows' totals in cents.
 */
import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowList, repKit } from '@/components/admin/kit/club/RepKit';
import { WaitingCount, money, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { sumMoney } from '@/lib/club-money-figures';
import { HELD_BY_THE_TEAM_WORD, TEAMS_WORDS, teamCashClosedWord } from '@/lib/club-money-words';
import { pluralize } from '@/lib/utils';
import type { SummaryTeamRow } from '@/lib/club-budget-report';
import { teamsByGroup } from '@/lib/club-team-needs';

/** An earlier year's line: its two halves, each whole ("+ $600.00 overdue" · "from 2025–26"). */
function EarlierYear({ line: e, className }: { line: SummaryTeamRow['earlier'][number]; className: string }) {
  const w = TEAMS_WORDS.earlierYear(e.amount, e.yearName, e.late);
  return <span className={className}><span className={moneyKit.nowrap}>{w.owed}</span> <span className={moneyKit.nowrap}>{w.from}</span></span>;
}

export default function TeamsTable({ teams, hrefOf, isPhone }: {
  teams: readonly SummaryTeamRow[];
  hrefOf: (teamId: string) => string;
  isPhone: boolean;
}) {
  const router = useRouter();
  const groups = teamsByGroup(teams);
  const banded = groups.length > 1 || groups[0]?.group != null;

  if (isPhone) {
    return (
      <ClubRowList label="The teams">
        {groups.map(g => (
          <Fragment key={g.group ?? 'none'}>
            {banded && <ClubRowBand>{TEAMS_WORDS.band(g.group, g.teams.length)}</ClubRowBand>}
            {g.teams.map(t => (
              <ClubRow
                key={t.teamId}
                as="link"
                href={hrefOf(t.teamId)}
                title={<>{t.teamName} {t.requestsWaiting.count > 0 && <WaitingCount n={t.requestsWaiting.count} />}</>}
                caption={(
                  <>
                    {t.overdue.amount > 0.005 ? <span className={moneyKit.holdingInline}>{money(t.overdue.amount)} overdue</span>
                      : t.holdingPayout ? <span className={moneyKit.holdingInline}>{TEAMS_WORDS.holding}</span> : null}
                    {/* The dot stays with the words before it (a no-break space), so a wrapped line never starts "·". */}
                    {(t.overdue.amount > 0.005 || t.holdingPayout) && '\u00a0· '}
                    {money(t.outstanding)} owed
                    {t.earlier.map(e => (
                      <Fragment key={e.yearKey}>
                        {'\u00a0· '}
                        <EarlierYear line={e} className={e.late ? `${moneyKit.holdingInline} ${moneyKit.nowrap}` : moneyKit.nowrap} />
                      </Fragment>
                    ))}
                    {t.cash.cash != null && (
                      <span className={cr.heldCaption}>
                        <Lock size={11} aria-hidden /> {HELD_BY_THE_TEAM_WORD} <span className={t.cash.cash < -0.005 ? cr.negative : undefined}>{fmtSigned(t.cash.cash)}</span>
                        {t.cash.season && !t.cash.season.live && <> · {teamCashClosedWord(t.cash.season.closedOn)}</>}
                      </span>
                    )}
                  </>
                )}
                chevron
              />
            ))}
          </Fragment>
        ))}
      </ClubRowList>
    );
  }

  const total = (pick: (t: SummaryTeamRow) => number) => sumMoney(teams.map(t => ({ amount: pick(t) })));
  const waiting = teams.reduce((n, t) => n + t.requestsWaiting.count, 0);
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col" className={repKit.num}>Allocated</th>
            <th scope="col" className={repKit.num}>Collected</th>
            <th scope="col" className={repKit.num}>Outstanding</th>
            <th scope="col" className={repKit.num}>Requests</th>
            <th scope="col" className={`${repKit.num} ${cr.heldHead}`}><Lock size={12} aria-hidden />Cash on hand · {HELD_BY_THE_TEAM_WORD.toLowerCase()}</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.group ?? 'none'}>
              {banded && (
                <tr className={repKit.band}>
                  <td colSpan={7}>{TEAMS_WORDS.band(g.group, g.teams.length)}</td>
                </tr>
              )}
              {g.teams.map(t => {
                const href = hrefOf(t.teamId);
                return (
                  <tr key={t.teamId} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                    <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{t.teamName}</Link></td>
                    <td className={repKit.num}>{money(t.allocated)}</td>
                    <td className={repKit.num}>{money(t.collected)}</td>
                    <td className={repKit.num}>
                      {money(t.outstanding)}
                      {t.overdue.amount > 0.005 && <span className={cr.lateCaption}>{money(t.overdue.amount)} overdue</span>}
                      {t.overdue.amount <= 0.005 && t.sent.amount > 0.005 && <span className={cr.sentCaption}>{money(t.sent.amount)} sent, waiting for you</span>}
                      {t.earlier.map(e => (
                        <EarlierYear key={e.yearKey} line={e} className={`${e.late ? cr.lateCaption : cr.sentCaption} ${cr.wraps}`} />
                      ))}
                    </td>
                    <td className={repKit.num}>
                      {t.requestsWaiting.count > 0 && <WaitingCount n={t.requestsWaiting.count} />}
                      {t.holdingPayout && <span className={cr.lateCaption}>holding up a payout</span>}
                    </td>
                    <td className={repKit.num}>
                      {t.cash.cash == null ? '' : <span className={t.cash.cash < -0.005 ? cr.negative : undefined}>{fmtSigned(t.cash.cash)}</span>}
                      {t.cash.cash != null && t.cash.season && !t.cash.season.live && <span className={cr.heldCaption}>{teamCashClosedWord(t.cash.season.closedOn)}</span>}
                    </td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          {/* The closing row: the club's own totals of the teams shown — BLANK under the cash it doesn't own (Ask 4e). */}
          <tr className={moneyKit.closeRow}>
            <td>{pluralize(teams.length, 'team')}</td>
            <td className={repKit.num}>{money(total(t => t.allocated))}</td>
            <td className={repKit.num}>{money(total(t => t.collected))}</td>
            <td className={repKit.num}>{money(total(t => t.outstanding))}</td>
            <td className={repKit.num}>{waiting > 0 ? waiting : ''}</td>
            <td className={repKit.num} />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
