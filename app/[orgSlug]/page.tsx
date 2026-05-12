import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, ChevronRight, Star, Globe, Mail, ExternalLink, Archive } from 'lucide-react';
import {
  getOrganizationBySlug, getTournamentsByOrg,
  getOrgPublicSiteContent, getArchivesByOrg,
  getLeagueSeasons, getAgeGroups,
} from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import styles from './Home.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);

  const allTournaments   = org ? await getTournamentsByOrg(org.id) : [];
  const activeTournaments = allTournaments.filter(t => t.status === 'active');

  // ── Public Site module branch ──────────────────────────────────────────────
  if (org && hasModuleEntitlement(org, 'module_public_site')) {
    const [siteContent, archives, leagueSeasons] = await Promise.all([
      getOrgPublicSiteContent(org.id),
      getArchivesByOrg(org.id),
      hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
    ]);

    const publicLeagueSeasons = leagueSeasons.filter(s => s.status !== 'draft');
    const activeLeagueSeason  = publicLeagueSeasons.find(s => ['registration_open', 'registration_closed', 'active'].includes(s.status));
    const showLeague          = publicLeagueSeasons.length > 0;

    const heroBanner  = org.heroBannerUrl ?? null;
    const showArchives = siteContent?.showArchivesLink !== false && archives.length > 0;

    // Per-tournament age range helper
    async function tournamentAgeRange(tId: string) {
      const groups = await getAgeGroups(tId);
      const sorted = [...groups].sort((a, b) => a.order - b.order);
      if (sorted.length === 0) return null;
      return sorted.length === 1 ? sorted[0].name : `${sorted[0].name} – ${sorted[sorted.length - 1].name}`;
    }

    const tournamentDetails = await Promise.all(
      activeTournaments.map(async t => ({
        tournament: t,
        ageRange: await tournamentAgeRange(t.id),
      }))
    );

    function formatDateRange(start?: string, end?: string) {
      if (!start) return null;
      const s = new Date(start + 'T12:00:00');
      const e = end ? new Date(end + 'T12:00:00') : null;
      const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
      if (!e) return s.toLocaleDateString('en-CA', opts);
      if (s.getFullYear() === e.getFullYear()) {
        return `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', opts)}, ${e.getFullYear()}`;
      }
      return `${s.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })}`;
    }

    const socialLinks = [
      siteContent?.socialInstagram && { href: siteContent.socialInstagram, label: 'Instagram' },
      siteContent?.socialFacebook  && { href: siteContent.socialFacebook,  label: 'Facebook'  },
      siteContent?.socialX         && { href: siteContent.socialX,         label: 'X'         },
      siteContent?.socialWebsite   && { href: siteContent.socialWebsite,   label: 'Website'   },
    ].filter(Boolean) as { href: string; label: string }[];

    return (
      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          {heroBanner ? (
            <>
              <div className={styles.heroBanner} style={{ backgroundImage: `url(${heroBanner})` }} />
              <div className={styles.heroBannerOverlay} />
            </>
          ) : (
            <div className={styles.heroBg}>
              <div className={styles.heroOrb1} />
              <div className={styles.heroOrb2} />
              <div className={styles.heroGrid} />
            </div>
          )}

          <div className={`container ${styles.heroContent}`}>
            {org.logoUrl && (
              <img src={org.logoUrl} alt={org.name} className={styles.orgLogo} />
            )}
            <h1 className={`display-xl ${styles.heroTitle}`} style={{ textTransform: 'uppercase' }}>
              {org.name}
            </h1>
            {siteContent?.tagline && (
              <p className={styles.heroBadge} style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {siteContent.tagline}
              </p>
            )}
            {siteContent?.description && (
              <p className={styles.heroSub}>{siteContent.description}</p>
            )}

            {/* Social + contact row */}
            {(socialLinks.length > 0 || siteContent?.contactEmail) && (
              <div className={styles.socialRow}>
                {socialLinks.map(({ href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <ExternalLink size={13} />
                    {label}
                  </a>
                ))}
                {siteContent?.contactEmail && (
                  <a href={`mailto:${siteContent.contactEmail}`} className={styles.socialLink}>
                    <Mail size={13} />
                    {siteContent.contactEmail}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Active tournaments */}
        {siteContent?.showUpcomingTournaments !== false && (
          <section id="tournaments" className="section">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow"><Calendar size={12} /> Tournaments</span>
                <h2 className="display-md">Upcoming Events</h2>
              </div>

              {tournamentDetails.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={40} />
                  <p>No active tournaments right now — check back soon!</p>
                </div>
              ) : (
                <div className={styles.tournamentCards}>
                  {tournamentDetails.map(({ tournament: t, ageRange }) => (
                    <Link key={t.id} href={`/${orgSlug}/${t.slug}`} className={`card ${styles.tournamentCard}`}>
                      <div className={styles.tournamentCardHeader}>
                        <span className="badge badge-primary">
                          <Star size={10} fill="currentColor" /> Live
                        </span>
                        {formatDateRange(t.startDate, t.endDate) && (
                          <span className={styles.tournamentCardDate}>
                            {formatDateRange(t.startDate, t.endDate)}
                          </span>
                        )}
                      </div>
                      <h3 className={styles.tournamentCardName}>{t.name}</h3>
                      {ageRange && <p className={styles.tournamentCardMeta}>{ageRange}</p>}
                      <span className={styles.tournamentCardCta}>
                        View Schedule <ChevronRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* House League CTA */}
        {showLeague && (
          <section className="section">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">House League</span>
                <h2 className="display-md">League Play</h2>
              </div>
              <Link href={`/${orgSlug}/league`} className={`card ${styles.archivesCta}`}>
                <div>
                  <div className={styles.archivesCtaTitle}>
                    {activeLeagueSeason ? activeLeagueSeason.name : 'House League'}
                  </div>
                  <div className={styles.archivesCtaSub}>
                    {activeLeagueSeason
                      ? activeLeagueSeason.status === 'registration_open'
                        ? 'Registration is open — sign up now'
                        : activeLeagueSeason.status === 'active'
                          ? 'Season in progress — view standings and schedule'
                          : 'Registration closed — season starting soon'
                      : 'View past seasons and results'}
                  </div>
                </div>
                <ChevronRight size={18} className={styles.archivesCtaChevron} />
              </Link>
            </div>
          </section>
        )}

        {/* Archives CTA */}
        {showArchives && (
          <section className="section">
            <div className="container">
              <Link href={`/${orgSlug}/archives`} className={`card ${styles.archivesCta}`}>
                <Archive size={24} className={styles.archivesCtaIcon} />
                <div>
                  <div className={styles.archivesCtaTitle}>Past Tournaments</div>
                  <div className={styles.archivesCtaSub}>Browse sealed records and past champions</div>
                </div>
                <ChevronRight size={18} className={styles.archivesCtaChevron} />
              </Link>
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Default branch (module not enabled) ───────────────────────────────────
  // Single active tournament → go straight to its home page
  if (activeTournaments.length === 1) {
    redirect(`/${orgSlug}/${activeTournaments[0].slug}`);
  }

  const heroBanner = org?.heroBannerUrl ?? null;

  function formatDateRange(start?: string | null, end?: string | null) {
    if (!start) return null;
    const s = new Date(start + 'T12:00:00');
    const e = end ? new Date(end + 'T12:00:00') : null;
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    if (!e) return s.toLocaleDateString('en-CA', opts);
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', opts)}, ${e.getFullYear()}`;
    }
    return `${s.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })}`;
  }

  // No active tournaments — FieldLogicHQ-branded placeholder
  if (activeTournaments.length === 0) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          {heroBanner ? (
            <>
              <div className={styles.heroBanner} style={{ backgroundImage: `url(${heroBanner})` }} />
              <div className={styles.heroBannerOverlay} />
            </>
          ) : (
            <div className={styles.heroBg}>
              <div className={styles.heroOrb1} />
              <div className={styles.heroOrb2} />
              <div className={styles.heroGrid} />
            </div>
          )}
          <div className={`container ${styles.heroContent}`}>
            <div className={styles.heroBadge}>FieldLogicHQ</div>
            <h1 className={`display-xl ${styles.heroTitle}`} style={{ textTransform: 'uppercase' }}>
              {org?.name ?? orgSlug}
            </h1>
            <p className={styles.heroSub}>
              This organization hasn&apos;t set up their public site yet.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // 2+ active tournaments — tournament selector
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        {heroBanner ? (
          <>
            <div className={styles.heroBanner} style={{ backgroundImage: `url(${heroBanner})` }} />
            <div className={styles.heroBannerOverlay} />
          </>
        ) : (
          <div className={styles.heroBg}>
            <div className={styles.heroOrb1} />
            <div className={styles.heroOrb2} />
            <div className={styles.heroGrid} />
          </div>
        )}
        <div className={`container ${styles.heroContent}`}>
          {org?.logoUrl && (
            <img src={org.logoUrl} alt={org.name} className={styles.orgLogo} />
          )}
          <div className={styles.heroBadge}>FieldLogicHQ</div>
          <h1 className={`display-xl ${styles.heroTitle}`} style={{ textTransform: 'uppercase' }}>
            {org?.name ?? orgSlug}
          </h1>
          <p className={styles.heroSub}>Select a tournament below to get started.</p>
        </div>
      </section>

      <section id="tournaments" className="section">
        <div className="container">
          <div className="section-header">
            <span className="eyebrow"><Calendar size={12} /> Tournaments</span>
            <h2 className="display-md">Active Tournaments</h2>
          </div>
          <div className={styles.tournamentCards}>
            {activeTournaments.map(t => (
              <Link key={t.id} href={`/${orgSlug}/${t.slug}`} className={`card ${styles.tournamentCard}`}>
                <div className={styles.tournamentCardHeader}>
                  <span className="badge badge-primary">
                    <Star size={10} fill="currentColor" /> Live
                  </span>
                  {formatDateRange(t.startDate, t.endDate) && (
                    <span className={styles.tournamentCardDate}>
                      {formatDateRange(t.startDate, t.endDate)}
                    </span>
                  )}
                </div>
                <h3 className={styles.tournamentCardName}>{t.name}</h3>
                <span className={styles.tournamentCardCta}>
                  View Schedule <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
