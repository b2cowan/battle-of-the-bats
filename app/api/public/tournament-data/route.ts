import { NextResponse } from 'next/server';
import {
  getPublicTournamentPageData,
  type PublicTournamentSection,
} from '@/lib/public-tournament-data';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

const VALID_SECTIONS = new Set<PublicTournamentSection>([
  'context',
  'schedule',
  'standings',
  'teams',
  'rules',
  'register',
]);

export const GET = withObservability(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get('orgSlug')?.trim();
    const tournamentSlug = searchParams.get('tournamentSlug')?.trim() ?? null;
    const sectionParam = searchParams.get('section')?.trim() ?? 'context';

    if (!orgSlug) {
      return NextResponse.json({ error: 'Missing organization.' }, { status: 400 });
    }
    if (!VALID_SECTIONS.has(sectionParam as PublicTournamentSection)) {
      return NextResponse.json({ error: 'Invalid public page section.' }, { status: 400 });
    }

    const data = await getPublicTournamentPageData(
      orgSlug,
      tournamentSlug,
      sectionParam as PublicTournamentSection,
    );

    if (!data) {
      return NextResponse.json({ error: 'Public tournament not found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Public tournament data API error:', error);
    return NextResponse.json({ error: 'Unable to load public tournament data.' }, { status: 500 });
  }
}, { route: '/api/public/tournament-data' });
