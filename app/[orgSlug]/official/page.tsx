import Link from 'next/link';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = { params: Promise<{ orgSlug: string }> };

interface TournamentRow {
  id: string;
  name: string;
  year: number;
  slug: string;
  status: string;
}

type AssignmentRow = {
  tournaments: TournamentRow | TournamentRow[] | null;
};

export default async function OfficialOverviewPage({ params }: Params) {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithScope();

  // Layout already guards auth — this is a defensive fallback only.
  if (!ctx) return null;

  // Resolve the member's row ID to look up tournament assignments.
  const { data: memberRow } = await supabaseAdmin
    .from('organization_members')
    .select('id')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .single();

  let tournaments: TournamentRow[] = [];

  if (memberRow) {
    const { data: assignments } = await supabaseAdmin
      .from('org_member_tournament_assignments')
      .select('tournaments(id, name, year, slug, status)')
      .eq('org_member_id', memberRow.id);

    const assigned: TournamentRow[] = ((assignments ?? []) as AssignmentRow[])
      .flatMap(assignment => {
        if (!assignment.tournaments) return [];
        return Array.isArray(assignment.tournaments) ? assignment.tournaments : [assignment.tournaments];
      });

    if (assigned.length > 0) {
      tournaments = assigned;
    } else {
      // No specific assignments — show all active tournaments for the org.
      const { data: activeTourneys } = await supabaseAdmin
        .from('tournaments')
        .select('id, name, year, slug, status')
        .eq('organization_id', ctx.org.id)
        .eq('status', 'active')
        .order('year', { ascending: false });

      tournaments = activeTourneys ?? [];
    }
  }

  const headerStyle: React.CSSProperties = {
    fontFamily: 'var(--font-data)',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(148,163,184,0.5)',
    marginBottom: '0.75rem',
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid rgba(30,58,138,0.4)',
    background: '#111827',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  };

  const tournamentNameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-data)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: '#F1F5F9',
  };

  const tournamentMetaStyle: React.CSSProperties = {
    fontFamily: 'var(--font-data)',
    fontSize: '0.72rem',
    color: '#94A3B8',
    marginTop: '0.2rem',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };

  const scorekeeperBtnStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: 'var(--font-data)',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#D9F99D',
    border: '1px solid #D9F99D',
    padding: '0.45rem 1rem',
    textDecoration: 'none',
    borderRadius: '4px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'var(--font-data)', fontSize: '1.25rem', fontWeight: 900, color: '#F1F5F9', marginBottom: '0.25rem' }}>
          {ctx.org.name}
        </div>
        <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: '#94A3B8' }}>
          Field Official — Scorekeeper Access
        </div>
      </div>

      <div style={headerStyle}>Assigned Tournaments</div>

      {tournaments.length === 0 ? (
        <div style={{
          border: '1px solid rgba(30,58,138,0.3)',
          background: '#111827',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font-data)',
          fontSize: '0.82rem',
          color: '#94A3B8',
          lineHeight: 1.6,
        }}>
          No active tournaments assigned yet.
          <br />
          Contact your organization admin to get assigned.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tournaments.map(t => (
            <div key={t.id} style={cardStyle}>
              <div>
                <div style={tournamentNameStyle}>{t.name}</div>
                <div style={tournamentMetaStyle}>{t.year}</div>
              </div>
              <Link href={`/${orgSlug}/official/score`} style={scorekeeperBtnStyle}>
                Open Scorekeeper →
              </Link>
            </div>
          ))}
        </div>
      )}

      <p style={{
        marginTop: '2rem',
        fontFamily: 'var(--font-data)',
        fontSize: '0.72rem',
        color: 'rgba(148,163,184,0.4)',
        lineHeight: 1.6,
      }}>
        The scorekeeper app will show games scheduled today from your assigned tournament access.
        Contact your org admin if you need access to a specific tournament.
      </p>
    </div>
  );
}
