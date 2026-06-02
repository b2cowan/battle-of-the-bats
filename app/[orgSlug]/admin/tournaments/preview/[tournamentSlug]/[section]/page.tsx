import { notFound } from 'next/navigation';
import { Calendar, Megaphone, Star, Trophy, Users, BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download, ExternalLink, UserPlus, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getDivisions,
  getAnnouncements,
  getVenues,
  getGames,
  getResources,
  getRules,
  getStandings,
  getTeams,
  getOrganizationBySlug,
  getTournamentsByOrg,
} from '@/lib/db';
import { getTournamentPreviewContext } from '@/lib/tournament-preview';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import type { Division, Game, Resource, RuleSection, Team } from '@/lib/types';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import LocationLink from '@/components/LocationLink';
import { formatTime } from '@/lib/utils';
import ScheduleContent from '@/components/public/ScheduleContent';
import StandingsContent from '@/components/public/StandingsContent';
import TeamsContent from '@/components/public/TeamsContent';
import newsStyles from '@/app/[orgSlug]/news/news.module.css';
import rulesStyles from '@/app/[orgSlug]/rules/rules.module.css';
import scheduleStyles from '@/app/[orgSlug]/schedule/schedule.module.css';
import registerStyles from '@/app/[orgSlug]/register/register.module.css';

export const dynamic = 'force-dynamic';

const VALID_SECTIONS = new Set(['news', 'schedule', 'standings', 'teams', 'rules', 'register']);
const ICON_MAP: Record<string, LucideIcon> = {
  Shield, BookOpen, AlertCircle, CheckCircle,
};

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

  // ── Schedule ──────────────────────────────────────────────────────────────
  if (section === 'schedule') {
    const [games, teams, divisions, venues] = await Promise.all([
      getGames(tournament.id, readOptions),
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
      getVenues(tournament.id, readOptions),
    ]);
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues,
      games,
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted'),
      registrationFields: [],
      standingsByDivision: {},
    };
    return (
      <ScheduleContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
      />
    );
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  if (section === 'standings') {
    const divisions = await getDivisions(tournament.id, readOptions);
    const standingsEntries = await Promise.all(
      divisions.map(async group => [
        group.id,
        await getStandings(group.id, group.playoffConfig, readOptions),
      ] as const),
    );
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues: [],
      games: [],
      resources: [],
      rules: [],
      teams: [],
      registrationFields: [],
      standingsByDivision: Object.fromEntries(standingsEntries),
    };
    return (
      <StandingsContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
      />
    );
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  if (section === 'teams') {
    const [teams, divisions] = await Promise.all([
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
    ]);
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues: [],
      games: [],
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted'),
      registrationFields: [],
      standingsByDivision: {},
    };
    return (
      <TeamsContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
      />
    );
  }

  // ── News ──────────────────────────────────────────────────────────────────
  if (section === 'news') {
    const announcements = await getAnnouncements(tournament.id, readOptions);
    const pinned = announcements.filter(a => a.pinned);
    const regular = announcements.filter(a => !a.pinned);

    return (
      <div className="page-content">
        <div className={newsStyles.pageHeader}>
          <div className="container">
            <span className="eyebrow"><Megaphone size={12} /> News</span>
            <h1 className="display-lg">News &amp; Announcements</h1>
            <p className="text-muted">Stay up to date with the latest tournament news, schedule changes, and announcements.</p>
          </div>
        </div>
        <div className="section">
          <div className="container">
            {announcements.length === 0 ? (
              <div className="empty-state"><Megaphone size={48} /><p>No announcements yet. Check back soon!</p></div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div className={newsStyles.pinnedSection}>
                    <div className={newsStyles.sectionLabel}><Star size={13} fill="currentColor" /> Pinned Announcements</div>
                    <div className={newsStyles.annList}>
                      {pinned.map(ann => (
                        <div key={ann.id} className={`card ${newsStyles.annCard} ${newsStyles.pinnedCard}`}>
                          <div className={newsStyles.annHeader}>
                            <div className={newsStyles.annMeta}>
                              <span className="badge badge-primary"><Star size={9} fill="currentColor" />&nbsp;Pinned</span>
                              <span className={newsStyles.annDate}>{new Date(ann.date).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                          </div>
                          <h2 className={newsStyles.annTitle}>{ann.title}</h2>
                          <p className={newsStyles.annBody}>{ann.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {regular.length > 0 && (
                  <div>
                    {pinned.length > 0 && <div className={newsStyles.sectionLabel}><Calendar size={13} /> Recent Announcements</div>}
                    <div className={newsStyles.annList}>
                      {regular.map(ann => (
                        <div key={ann.id} className={`card ${newsStyles.annCard}`}>
                          <div className={newsStyles.annHeader}>
                            <div className={newsStyles.annMeta}>
                              <span className={newsStyles.annDate}>{new Date(ann.date).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                          </div>
                          <h2 className={newsStyles.annTitle}>{ann.title}</h2>
                          <p className={newsStyles.annBody}>{ann.body}</p>
                        </div>
                      ))}
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

  // ── Rules ─────────────────────────────────────────────────────────────────
  if (section === 'rules') {
    const [rules, resources] = await Promise.all([
      getRules(tournament.id, readOptions),
      getResources(tournament.id, readOptions),
    ]);
    const hasRules = rules.length > 0;
    const hasResources = resources.length > 0;
    const hasContent = hasRules || hasResources;
    const contactEmail = tournament.contactEmail ?? org.contactEmail ?? null;
    const rulesLayout = tournament.settings?.rulesLayout ?? 'columns';
    const resourcesLayout = tournament.settings?.resourcesLayout ?? 'list';

    return (
      <div className="page-content">
        <div className={rulesStyles.pageHeader}>
          <div className="container">
            <span className="eyebrow"><BookOpen size={12} /> Rules &amp; Resources</span>
            <h1 className="display-lg">Tournament Rules</h1>
            <p className="text-muted">Official rules, conduct guidelines, and resources for the tournament.</p>
          </div>
        </div>
        <div className="section">
          <div className="container">
            {!hasContent && (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <BookOpen size={32} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                <p className="text-muted">Rules and resources for this tournament haven&apos;t been published yet.</p>
              </div>
            )}
            {hasRules && (
              <div className={`${rulesStyles.rulesGrid}${rulesLayout === 'single' ? ` ${rulesStyles.rulesGridSingle}` : ''}`}>
                {rules.map(section => {
                  const Icon = ICON_MAP[section.icon || 'Shield'] || Shield;
                  return (
                    <div key={section.id} className={`card ${rulesStyles.ruleCard}`}>
                      <div className={rulesStyles.ruleCardHeader}>
                        <div className={rulesStyles.ruleIcon}><Icon size={20} /></div>
                        <h2 className={rulesStyles.ruleTitle}>{section.title}</h2>
                      </div>
                      <ul className={rulesStyles.ruleList}>
                        {section.items.map((item, i) => (
                          <li key={i} className={rulesStyles.ruleItem}>
                            <span className={rulesStyles.ruleBullet} />
                            {item.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            {hasResources && (
              <div className={`card ${rulesStyles.resourcesCard}`}>
                <div className={rulesStyles.ruleCardHeader}>
                  <div className={rulesStyles.ruleIcon}><FileText size={20} /></div>
                  <h2 className={rulesStyles.ruleTitle}>Downloads &amp; Resources</h2>
                </div>
                <div className={`${rulesStyles.resourcesList}${resourcesLayout === 'grid' ? ` ${rulesStyles.resourcesGrid}` : ''}`} style={{ marginTop: '1.5rem' }}>
                  {resources.map(r => {
                    const isSupabase = r.url.includes('supabase.co');
                    const isExternal = !isSupabase && r.url.startsWith('http');
                    return (
                      <a key={r.label} href={isSupabase ? `${r.url}?download=` : r.url}
                        download={isSupabase ? r.label : undefined}
                        target={isExternal ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className={rulesStyles.resourceItem}
                      >
                        {isExternal ? <ExternalLink size={14} /> : <Download size={14} />}
                        {r.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            {hasContent && (
              <div className={`card ${rulesStyles.disclaimerCard}`}>
                <p>
                  <strong>Note:</strong> These rules are subject to change at the discretion of the tournament director.
                  {contactEmail && <> For questions, contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Register (preview — form is disabled) ─────────────────────────────────
  const [teams, divisions] = await Promise.all([
    getTeams(tournament.id, readOptions),
    getDivisions(tournament.id, readOptions),
  ]);
  const stats = Object.fromEntries(divisions.map(g => [g.id, teams.filter(t => t.divisionId === g.id).length]));
  const contactEmail = tournament.contactEmail ?? org.contactEmail ?? null;

  return (
    <div className="page-content">
      <div className={registerStyles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><UserPlus size={12} /> Register</span>
          <h1 className="display-lg">Team Registration</h1>
          <p className="text-muted">Register your team for {tournament.name}. This is a preview — registration is disabled.</p>
        </div>
      </div>
      <div className="section">
        <div className="container">
          <div className={registerStyles.formWrap}>
            {divisions.length === 0 ? (
              <div className={`card ${registerStyles.closedCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
                <h3>No Divisions Published</h3>
                <p>Add and publish divisions to enable registration.{contactEmail && <> Contact: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></>}</p>
              </div>
            ) : (
              <div className={`card ${registerStyles.formCard}`}>
                <div className={registerStyles.formHeader}>
                  <div className={registerStyles.formIcon}><UserPlus size={20} /></div>
                  <div>
                    <h2 className={registerStyles.formTitle}>Register Your Team</h2>
                    <p className={registerStyles.formSub}>{tournament.name}</p>
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
                        {divisions.map(g => {
                          const filled = stats[g.id] || 0;
                          const remaining = g.capacity ? Math.max(0, g.capacity - filled) : null;
                          const label = g.isClosed ? ' - CLOSED' : remaining !== null ? ` (${remaining} left)` : '';
                          return <option key={g.id}>{g.name}{label}</option>;
                        })}
                      </select>
                      <ChevronDown size={16} className="select-icon" />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-lime" disabled style={{ width: '100%', padding: '0.875rem' }}>
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
