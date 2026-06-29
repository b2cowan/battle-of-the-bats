import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getDirectoryListings } from '@/lib/directory';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw  = parseInt(searchParams.get('limit') ?? '', 10);
    const offsetRaw = parseInt(searchParams.get('offset') ?? '', 10);

    const result = await getDirectoryListings({
      q:         searchParams.get('q') ?? undefined,
      sport:     searchParams.get('sport') ?? undefined,
      province:  searchParams.get('province') ?? undefined,
      timeframe: searchParams.get('timeframe') ?? undefined,
      dateFrom:  searchParams.get('dateFrom') ?? undefined,
      dateTo:    searchParams.get('dateTo') ?? undefined,
      limit:     Number.isFinite(limitRaw)  ? limitRaw  : undefined,
      offset:    Number.isFinite(offsetRaw) ? offsetRaw : undefined,
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    // Log detail server-side; return a generic message so DB/schema detail never reaches the public.
    console.error('Public tournaments directory API error:', e);
    return NextResponse.json({ error: 'Unable to load the tournament directory.' }, { status: 500 });
  }
}, { route: '/api/public/tournaments' });
