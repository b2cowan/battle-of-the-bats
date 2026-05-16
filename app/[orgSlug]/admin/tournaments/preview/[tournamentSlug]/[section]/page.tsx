import { notFound } from 'next/navigation';
import { Calendar, Clock, Megaphone, Star, Trophy, Users, BookOpen, FileText, Download, ExternalLink, UserPlus, AlertCircle, ChevronDown } from 'lucide-react';
import {
  getAgeGroups,
  getAnnouncements,
  getDiamonds,
  getGames,
  getResources,
  getRules,
  getStandings,
  getTeams,
} from '@/lib/db';
import { getTournamentPreviewContext } from '@/lib/tournament-preview';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import type { AgeGroup, Game, Resource, RuleSection, Team } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatPoolName, formatTime } from '@/lib/utils';
import newsStyles from '@/app/[orgSlug]/news/news.module.css';
import rulesStyles from '@/app/[orgSlug]/rules/rules.module.css';
import scheduleStyles from '@/app/[orgSlug]/schedule/schedule.module.css';
import standingsStyles from '@/app/[orgSlug]/standings/standings.module.css';
import teamsStyles from '@/app/[orgSlug]/teams/teams.module.css';
import registerStyles from '@/app/[orgSlug]/register/register.module.css';

export const dynamic = 'force-dynamic';

const VALID_SECTIONS = new Set(['news', 'schedule', 'standings', 'teams', 'rules', 'register']);
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export default async function TournamentPreviewSectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; section: string }>;
}) {
  const { orgSlug, tournamentSlug, section } = await params;
  if (!VALID_SECTIONS.has(section)) notFound();

  const { org, tournament } = await getTournamentPreviewContext(orgSlug, tournamentSlug);
  const readOptions = { admin: true };
  if (!isPublicPageEnabled(tournament, section as PublicPageKey)) notFound();

  if (section === 'news') {
    const announcements = await getAnnouncements(tournament.id, readOptions);
    return <PreviewNews announcements={announcements} />;
  }

  if (section === 'schedule') {
    const [games, teams, ageGroups, diamonds] = await Promise.all([
      getGames(tournament.id, readOptions),
      getTeams(tournament.id, readOptions),
      getAgeGroups(tournament.id, readOptions),
      getDiamonds(tournament.id, readOptions),
    ]);
    return <PreviewSchedule games={games} teams={teams} ageGroups={ageGroups} diamonds={diamonds} />;
  }

  if (section === 'standings') {
    const ageGroups = await getAgeGroups(tournament.id, readOptions);
    const rowsByGroup = await Promise.all(
      ageGroups.map(async group => ({
        group,
        standings: await getStandings(group.id, group.playoffConfig, readOptions),
      }))
    );
    return <PreviewStandings rowsByGroup={rowsByGroup} />;
  }

  if (section === 'teams') {
    const [teams, ageGroups] = await Promise.all([
      getTeams(tournament.id, readOptions),
      getAgeGroups(tournament.id, readOptions),
    ]);
    return <PreviewTeams teams={teams.filter(t => t.status === 'accepted')} ageGroups={ageGroups} />;
  }

  if (section === 'rules') {
    const [rules, resources] = await Promise.all([
      getRules(tournament.id, readOptions),
      getResources(tournament.id, readOptions),
    ]);
    return <PreviewRules rules={rules} resources={resources} contactEmail={tournament.contactEmail ?? org.contactEmail ?? null} />;
  }

  const [teams, ageGroups] = await Promise.all([
    getTeams(tournament.id, readOptions),
    getAgeGroups(tournament.id, readOptions),
  ]);
  return (
    <PreviewRegister
      tournamentName={tournament.name}
      contactEmail={tournament.contactEmail ?? org.contactEmail ?? null}
      ageGroups={ageGroups}
      teams={teams}
    />
  );
}

function PageHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className={scheduleStyles.pageHeader}>
      <div className="container">
        <span className="eyebrow">{icon} {eyebrow}</span>
        <h1 className="display-lg">{title}</h1>
        <p className="text-muted">{description}</p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'TBD';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  return new Date(datePart + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function PreviewNews({
  announcements,
}: {
  announcements: Awaited<ReturnType<typeof getAnnouncements>>;
}) {
  const pinned = announcements.filter(a => a.pinned);
  const regular = announcements.filter(a => !a.pinned);

  return (
    <div className="page-content">
      <PageHeader
        icon={<Megaphone size={12} />}
        eyebrow="News"
        title="News & Announcements"
        description="Stay up to date with the latest tournament news, schedule changes, and announcements."
      />
      <div className="section">
        <div className="container">
          {announcements.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={48} />
              <p>No announcements yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className={newsStyles.pinnedSection}>
                  <div className={newsStyles.sectionLabel}>
                    <Star size={13} fill="currentColor" /> Pinned Announcements
                  </div>
                  <div className={newsStyles.annList}>
                    {pinned.map(ann => <AnnouncementCard key={ann.id} ann={ann} pinned />)}
                  </div>
                </div>
              )}
              {regular.length > 0 && (
                <div>
                  {pinned.length > 0 && <div className={newsStyles.sectionLabel}><Calendar size={13} /> Recent Announcements</div>}
                  <div className={newsStyles.annList}>
                    {regular.map(ann => <AnnouncementCard key={ann.id} ann={ann} pinned={false} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AnnouncementCard({
  ann,
  pinned,
}: {
  ann: Awaited<ReturnType<typeof getAnnouncements>>[number];
  pinned: boolean;
}) {
  return (
    <div className={`card ${newsStyles.annCard} ${pinned ? newsStyles.pinnedCard : ''}`}>
      <div className={newsStyles.annHeader}>
        <div className={newsStyles.annMeta}>
          {pinned && <span className="badge badge-primary"><Star size={9} fill="currentColor" />&nbsp;Pinned</span>}
          <span className={newsStyles.annDate}>{formatDate(ann.date)}</span>
        </div>
      </div>
      <h2 className={newsStyles.annTitle}>{ann.title}</h2>
      <p className={newsStyles.annBody}>{ann.body}</p>
    </div>
  );
}

function PreviewSchedule({
  games,
  teams,
  ageGroups,
  diamonds,
}: {
  games: Game[];
  teams: Team[];
  ageGroups: AgeGroup[];
  diamonds: Awaited<ReturnType<typeof getDiamonds>>;
}) {
  const sortedGroups = [...ageGroups].sort((a, b) => a.order - b.order);
  const teamName = (id?: string, placeholder?: string) => {
    if (id && id !== NIL_UUID) return teams.find(t => t.id === id)?.name ?? 'TBD';
    return placeholder || 'TBD';
  };
  const diamond = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  return (
    <div className="page-content">
      <PageHeader
        icon={<Calendar size={12} />}
        eyebrow="Schedule"
        title="Tournament Schedule"
        description="View games by division. All times are local."
      />
      <div className="section">
        <div className="container">
          {games.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>No games scheduled yet. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {sortedGroups.map(group => {
                const groupGames = games
                  .filter(game => game.ageGroupId === group.id)
                  .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
                if (groupGames.length === 0) return null;

                const byDate = groupGames.reduce<Record<string, Game[]>>((acc, game) => {
                  const key = game.date || 'TBD';
                  acc[key] = [...(acc[key] ?? []), game];
                  return acc;
                }, {});

                return (
                  <div key={group.id}>
                    <h2 className="display-sm" style={{ marginBottom: '1rem', color: 'var(--primary-light)' }}>{group.name}</h2>
                    {Object.entries(byDate).map(([date, dateGames]) => (
                      <div key={date} className={scheduleStyles.dateGroup}>
                        <div className={scheduleStyles.dateLabel}>
                          <Calendar size={14} />
                          {date === 'TBD' ? 'Date TBD' : formatDate(date)}
                        </div>
                        <div className={scheduleStyles.gamesList}>
                          {dateGames.map(game => (
                            <div key={game.id} className={`card ${scheduleStyles.gameRow} ${game.isPlayoff ? scheduleStyles.playoffRow : ''}`}>
                              <div className={scheduleStyles.gameTime}><Clock size={13} />{formatTime(game.time)}</div>
                              <div className={scheduleStyles.teams}>
                                <span className={scheduleStyles.teamA}>{teamName(game.homeTeamId, game.homePlaceholder)}</span>
                                {game.status === 'cancelled' ? (
                                  <span className={`badge ${scheduleStyles.badgeCancelled}`}>Cancelled</span>
                                ) : (
                                  <span className={scheduleStyles.vsChip}>VS</span>
                                )}
                                <span className={scheduleStyles.teamB}>{teamName(game.awayTeamId, game.awayPlaceholder)}</span>
                              </div>
                              <div className={scheduleStyles.gameMeta}>
                                {game.isPlayoff && <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>}
                                <LocationLink location={game.location} diamond={diamond(game.diamondId)} size="sm" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewStandings({
  rowsByGroup,
}: {
  rowsByGroup: Array<{ group: AgeGroup; standings: Awaited<ReturnType<typeof getStandings>> }>;
}) {
  const hasStandings = rowsByGroup.some(({ standings }) => standings.length > 0);

  return (
    <div className="page-content">
      <PageHeader
        icon={<Trophy size={12} />}
        eyebrow="Standings"
        title="Pool Standings"
        description="Current standings by pool and division."
      />
      <div className="section">
        <div className="container">
          {!hasStandings ? (
            <div className="empty-state">
              <Trophy size={48} />
              <p>No standings available yet. Check back once games are underway.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {rowsByGroup.map(({ group, standings }) => {
                if (standings.length === 0) return null;
                const pools = group.pools?.length ? group.pools : [{ id: 'default', name: 'All Teams' }];
                return pools.map(pool => {
                  const poolStandings = pool.id === 'default' ? standings : standings.filter(row => row.poolId === pool.id);
                  if (poolStandings.length === 0) return null;
                  return (
                    <div key={`${group.id}-${pool.id}`} className={standingsStyles.summarySection} style={{ margin: 0 }}>
                      <div className={standingsStyles.summaryHeader}>
                        <div className="flex gap-2">
                          <Trophy size={18} style={{ color: 'var(--primary-light)' }} />
                          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            {group.name}{pool.id !== 'default' ? ` - ${formatPoolName(pool.name)}` : ''}
                          </h2>
                        </div>
                      </div>
                      <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                        <table className={standingsStyles.standingsTable}>
                          <thead>
                            <tr>
                              <th className={standingsStyles.stickyCol}>Team</th>
                              <th style={{ textAlign: 'center' }}>W</th>
                              <th style={{ textAlign: 'center' }}>L</th>
                              <th style={{ textAlign: 'center' }}>T</th>
                              <th style={{ textAlign: 'center' }}>RF</th>
                              <th style={{ textAlign: 'center' }}>RA</th>
                              <th style={{ textAlign: 'center' }}>RD</th>
                              <th style={{ textAlign: 'center' }}>PTS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poolStandings.map(row => (
                              <tr key={row.teamId}>
                                <td className={standingsStyles.stickyCol}>{row.teamName}</td>
                                <td style={{ textAlign: 'center' }}>{row.w}</td>
                                <td style={{ textAlign: 'center' }}>{row.l}</td>
                                <td style={{ textAlign: 'center' }}>{row.t}</td>
                                <td style={{ textAlign: 'center' }}>{row.rf}</td>
                                <td style={{ textAlign: 'center' }}>{row.ra}</td>
                                <td style={{ textAlign: 'center' }}>{row.rd > 0 ? `+${row.rd}` : row.rd}</td>
                                <td style={{ textAlign: 'center' }}><span className="badge badge-primary">{row.pts}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewTeams({ teams, ageGroups }: { teams: Team[]; ageGroups: AgeGroup[] }) {
  return (
    <div className="page-content">
      <PageHeader
        icon={<Users size={12} />}
        eyebrow="Teams"
        title="Registered Teams"
        description="Browse participating teams by age division."
      />
      <div className="section">
        <div className="container">
          {teams.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>No teams registered yet.</p>
            </div>
          ) : (
            <div className={teamsStyles.divisionLayout}>
              {ageGroups.map(group => {
                const groupTeams = teams.filter(team => team.ageGroupId === group.id);
                if (groupTeams.length === 0) return null;
                return (
                  <div key={group.id} className={teamsStyles.groupSection}>
                    <h2 className={teamsStyles.groupTitle}>{group.name}</h2>
                    <div className={teamsStyles.poolGrid}>
                      <div className={teamsStyles.poolCard}>
                        <div className={teamsStyles.teamList}>
                          {groupTeams.map(team => (
                            <div key={team.id} className={teamsStyles.teamRow}>
                              <div className={teamsStyles.teamMain}>
                                <div>
                                  <h4 className={teamsStyles.teamName}>{team.name.replace(/\s*\(.*?\)\s*/g, '').trim()}</h4>
                                  {team.coach && <span className={teamsStyles.coach}>Coach: {team.coach}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRules({
  rules,
  resources,
  contactEmail,
}: {
  rules: RuleSection[];
  resources: Resource[];
  contactEmail: string | null;
}) {
  const displayRules = rules.length > 0
    ? rules
    : [{ id: 'fallback', tournamentId: '', title: 'Rules Coming Soon', icon: 'BookOpen', order: 0, ageGroupIds: null, items: [{ id: 'fallback-item', ruleId: 'fallback', content: 'The organizer has not published tournament rules yet.', order: 0 }] }];

  return (
    <div className="page-content">
      <PageHeader
        icon={<BookOpen size={12} />}
        eyebrow="Rules & Resources"
        title="Tournament Rules"
        description="Official rules, conduct guidelines, and resources for the tournament."
      />
      <div className="section">
        <div className="container">
          <div className={rulesStyles.rulesGrid}>
            {displayRules.map(section => (
              <div key={section.id} className={`card ${rulesStyles.ruleCard}`}>
                <div className={rulesStyles.ruleCardHeader}>
                  <div className={rulesStyles.ruleIcon}><BookOpen size={20} /></div>
                  <h2 className={rulesStyles.ruleTitle}>{section.title}</h2>
                </div>
                <ul className={rulesStyles.ruleList}>
                  {section.items.map(item => (
                    <li key={item.id} className={rulesStyles.ruleItem}>
                      <span className={rulesStyles.ruleBullet} />
                      {item.content}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {resources.length > 0 && (
            <div className={`card ${rulesStyles.resourcesCard}`}>
              <div className={rulesStyles.ruleCardHeader}>
                <div className={rulesStyles.ruleIcon}><FileText size={20} /></div>
                <h2 className={rulesStyles.ruleTitle}>Downloads & Resources</h2>
              </div>
              <div className={rulesStyles.resourcesList} style={{ marginTop: '1.5rem' }}>
                {resources.map(resource => {
                  const isSupabase = resource.url.includes('supabase.co');
                  const isExternal = !isSupabase && resource.url.startsWith('http');
                  return (
                    <a
                      key={resource.id}
                      href={isSupabase ? `${resource.url}?download=` : resource.url}
                      download={isSupabase ? resource.label : undefined}
                      target={isExternal ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className={rulesStyles.resourceItem}
                    >
                      {isExternal ? <ExternalLink size={14} /> : <Download size={14} />}
                      {resource.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`card ${rulesStyles.disclaimerCard}`}>
            <p>
              <strong>Note:</strong> These rules are subject to change at the discretion of the tournament director.
              {contactEmail && <> For questions or clarifications, contact the tournament office at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRegister({
  tournamentName,
  contactEmail,
  ageGroups,
  teams,
}: {
  tournamentName: string;
  contactEmail: string | null;
  ageGroups: AgeGroup[];
  teams: Team[];
}) {
  const stats = Object.fromEntries(ageGroups.map(group => [
    group.id,
    teams.filter(team => team.ageGroupId === group.id).length,
  ]));

  return (
    <div className="page-content">
      <PageHeader
        icon={<UserPlus size={12} />}
        eyebrow="Register"
        title="Team Registration"
        description={`Register your team for ${tournamentName}. A confirmation email will be sent once your registration is reviewed.`}
      />
      <div className="section">
        <div className="container">
          <div className={registerStyles.formWrap}>
            {ageGroups.length === 0 ? (
              <div className={`card ${registerStyles.closedCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
                <h3>Registration Not Open</h3>
                <p>
                  Tournament registration is not accepting submissions right now.
                  {contactEmail ? <> Questions? Contact the organizer at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : <> Check back soon or contact the organizer directly.</>}
                </p>
              </div>
            ) : (
              <div className={`card ${registerStyles.formCard}`}>
                <div className={registerStyles.formHeader}>
                  <div className={registerStyles.formIcon}><UserPlus size={20} /></div>
                  <div>
                    <h2 className={registerStyles.formTitle}>Register Your Team</h2>
                    <p className={registerStyles.formSub}>{tournamentName}</p>
                  </div>
                </div>
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Team Name *</label>
                    <input className="form-input" placeholder="e.g. Milton Thunder" disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Coach / Contact Name *</label>
                    <input className="form-input" placeholder="Full name" disabled />
                  </div>
                </div>
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Email *</label>
                    <input className="form-input" type="email" placeholder="coach@example.com" disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Division *</label>
                    <div className="select-wrapper">
                      <select className="form-input" disabled defaultValue="">
                        <option value="">Select a division</option>
                        {ageGroups.map(group => {
                          const filled = stats[group.id] || 0;
                          const remaining = group.capacity ? Math.max(0, group.capacity - filled) : null;
                          const label = group.isClosed
                            ? ' - CLOSED'
                            : remaining !== null
                              ? ` (${remaining} left)`
                              : '';
                          return <option key={group.id}>{group.name}{label}</option>;
                        })}
                      </select>
                      <ChevronDown size={16} className="select-icon" />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-primary" disabled style={{ width: '100%', padding: '0.875rem' }}>
                  Submit Registration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
