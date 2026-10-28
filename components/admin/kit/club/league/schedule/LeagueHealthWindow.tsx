'use client';
/**
 * A HOUSE-LEAGUE SEASON'S SCHEDULE HEALTH WINDOW (Stage 9d-2a step 6, frames d2–d4; ruling 9d2·4: the tournament's button
 * and window, a league's rules). The shape is the tournament's, part for part — its frame (`HealthWindowFrame`), its tiles
 * (`Metric`), its issue rows (`IssueRow`), its team detail and its foot — so the two cannot drift; what it says is
 * lib/league-schedule-health.ts's.
 *
 * Every door does something in the schedule: "Show them" / "Show it" close the window on the booking's day (the page's
 * `onShow`), "Give it a new date" opens the postponed game (`onOpenGame`), and a team's count opens Team detail here.
 *
 * ⚖ The foot SAYS the rules; it has no "Adjust the rules" door (owner 2026-10-27): nothing can hold a season's rules until
 * 9d-2b's migrations.
 */
import { useEffect, useRef, useState } from 'react';
import { HealthWindowFrame } from '@/app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthWindow';
import { IssueRow, Metric } from '@/app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthPanel';
import ts from '@/app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { SCHEDULE_DAY_WORDS } from '@/lib/schedule-words';
import {
  LEAGUE_HEALTH_WORDS as H, leagueIssueWords, primeTimeCell, type LeagueHealthIssue, type LeagueScheduleHealth,
} from '@/lib/league-schedule-health';
import s from './SeasonSchedule.module.css';

/** The phone's window shows two issues, then "{n} more. Show all" (d4). */
const PHONE_ISSUES = 2;

export default function LeagueHealthWindow({ health, eyebrow, team, label, place, divisionName, phone, canRun, onShow, onOpenGame, onClose }: {
  health: LeagueScheduleHealth;
  /** The season's name, over the title. */
  eyebrow: string;
  team: (id: string) => string;
  /** A booking by the page's key ("league_game:{id}"), said: "Tigers vs Braves", "Tigers practice". */
  label: (key: string) => string;
  place: (venueId: string, facilityId: string | null) => string;
  divisionName: (id: string) => string;
  phone: boolean;
  /** Whoever runs the season: a postponed game's door is "Give it a new date"; a reader's is "Show it". */
  canRun: boolean;
  /** Close on the issue's bookings in the schedule. */
  onShow: (issue: LeagueHealthIssue) => void;
  /** Open the postponed (or undated) game's window. */
  onOpenGame: (gameId: string) => void;
  onClose: () => void;
}) {
  const scored = health.timedGames > 0;
  const caption = scored
    ? [GAME_DAY_WORDS.healthCaption(health.tone, health.issues.length), SCHEDULE_DAY_WORDS.healthScope(health.divisions)].filter(Boolean).join(' · ')
    : H.nothingToScore;
  const [allIssues, setAllIssues] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const teamsRef = useRef<HTMLDetailsElement>(null);
  // Opened from an issue's door, Team detail sits under the issues: bring it into view.
  const [scrollTeams, setScrollTeams] = useState(0);
  useEffect(() => { if (scrollTeams) teamsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [scrollTeams]);

  const said = health.issues.map(issue => ({ issue, ...leagueIssueWords(issue, { team, label, place, division: divisionName }) }));
  const shownIssues = phone && !allIssues ? said.slice(0, PHONE_ISSUES) : said;
  const doorOf = (x: (typeof said)[number]) => {
    switch (x.door) {
      case 'date': {
        const id = x.issue.kind === 'postponed' ? x.issue.gameId : null;
        return id ? { label: canRun ? H.giveDate : H.showIt, onClick: () => onOpenGame(id) } : null;
      }
      case 'teams': return { label: H.show, onClick: () => { setTeamsOpen(true); setScrollTeams(n => n + 1); } };
      case 'show': return { label: H.show, onClick: () => onShow(x.issue) };
      case 'showIt': return { label: H.showIt, onClick: () => onShow(x.issue) };
      case 'none': return null;
    }
  };

  const t = health.tiles;
  const plans = health.plans;
  const samePlan = plans.every(p => p.games === plans[0]?.games);
  return (
    <HealthWindowFrame eyebrow={eyebrow} score={scored ? health.score : null} tone={health.tone} caption={caption} onClose={onClose}>
      {scored && (
        <>
          <div className={ts.healthKpiGrid}>
            <Metric label={H.games} value={H.gamesValue(t.games.onPlan, t.games.teams)} detail={H.gamesDetail}
              tone={t.games.onPlan < t.games.teams ? 'warning' : 'good'} />
            <Metric label={H.homeAway} value={H.homeAwayValue(t.homeAway.off)} detail={H.homeAwayDetail(health.rules.homeAwayTolerance)}
              tone={t.homeAway.off ? 'warning' : 'good'} />
            <Metric label={H.byes} value={t.byes.backToBack ? String(t.byes.backToBack) : H.byesSpread}
              detail={t.byes.backToBack ? H.byesDetail : H.byesNone} tone={t.byes.backToBack ? 'warning' : 'good'} />
            <Metric label={H.clashes} value={String(t.clashes.pairs)} detail={t.clashes.notChecked ? H.notChecked(t.clashes.notChecked) : H.allChecked}
              tone={t.clashes.pairs ? 'danger' : t.clashes.notChecked ? 'neutral' : 'good'} />
          </div>

          <div className={ts.healthIssues}>
            {said.length === 0 && <IssueRow issue={{ severity: 'info', title: '', detail: H.noIssues }} action={null} />}
            {shownIssues.map((x, i) => (
              <IssueRow key={i} issue={{ severity: x.tone, title: '', detail: x.text }} action={doorOf(x)} />
            ))}
            {shownIssues.length < said.length && (
              <p className={s.healthMore}>
                {H.more(said.length - shownIssues.length)}{' '}
                <button type="button" className={ts.healthIssueDoor} onClick={() => setAllIssues(true)}>{H.showAll}</button>
              </p>
            )}
          </div>

          {health.teams.length > 0 && (
            <details ref={teamsRef} className={ts.healthDetails} open={teamsOpen} onToggle={e => setTeamsOpen(e.currentTarget.open)}>
              <summary className={ts.healthDetailsSummary}>{H.teamDetail}</summary>
              <div className={ts.healthTeamTableWrap}>
                <table className={ts.healthTeamTable}>
                  <thead>
                    <tr>
                      <th>{H.columns.team}</th><th>{H.columns.games}</th><th>{H.columns.homeAway}</th>
                      <th>{H.columns.byes}</th><th>{H.columns.primeTime}</th><th>{H.columns.places}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.teams.map(row => (
                      <tr key={row.teamId}>
                        <td>{row.name}</td>
                        <td>{H.gamesCell(row.have, row.plan, row.postponed)}</td>
                        <td>{row.home}–{row.away}</td>
                        <td>{row.byes}</td>
                        <td>{primeTimeCell(row.primeTime)}</td>
                        <td>{row.places}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {/* The rules the score uses, said (no door until 9d-2b can save them). */}
      <div className={`${ts.healthRulesFoot} ${s.healthRules}`}>
        <span>{H.rulesNote}</span>
        <dl className={s.healthRuleList}>
          {plans.length > 0 && (
            <div>
              <dt>{H.gamesPerTeam}</dt>
              <dd>{samePlan ? plans[0].games : plans.map(p => `${divisionName(p.divisionId)} ${p.games}`).join(' · ')}</dd>
            </div>
          )}
          <div><dt>{H.twice}</dt><dd>{health.rules.twiceInADayAllowed ? H.yes : H.no}</dd></div>
          <div><dt>{H.homeAwayRule}</dt><dd>{H.homeAwayRuleValue(health.rules.homeAwayTolerance)}</dd></div>
        </dl>
        {plans.length > 0 && <span className={s.healthRuleHint}>{H.gamesPerTeamHint}</span>}
      </div>
    </HealthWindowFrame>
  );
}
