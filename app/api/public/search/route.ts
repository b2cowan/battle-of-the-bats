import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { searchDirectory } from '@/lib/directory';
import { writePlatformEvent } from '@/lib/platform-events';

export const dynamic = 'force-dynamic';

// Unified public/anonymous search for the Home search bar: Tournaments + Organizations + Teams
// on one lifecycle. No auth, no PII. force-dynamic + no-store so it never serves staler data
// than the tournament pages a result links to (the SW already blanket-no-caches /api/*).
export const GET = withObservability(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = await searchDirectory({
      q: searchParams.get('q') ?? '',
      types: searchParams.get('types') ?? undefined,
    });
    // §6 search-usage metric — anonymous by design (public route; actor not resolved to keep the
    // path fast). AWAITED (not after()) so it reliably records on the serverless host: Amplify Lambda
    // wires no after()/waitUntil bridge, so an after() write could be silently dropped once the
    // response is sent. throw-proof by contract; the cost is one cheap insert on a path already
    // doing DB work.
    const hadResults =
      result.tournaments.total > 0 || result.organizations.total > 0 || result.teams.total > 0;
    // Bound the client-supplied `types` before it lands in metadata — only a short, known-shape value.
    const types = (searchParams.get('types') ?? 'all').slice(0, 40);
    await writePlatformEvent({
      eventType: 'directory_search',
      source: 'app',
      metadata: { hadResults, types },
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    // Log detail server-side; return a generic message so DB/schema detail never reaches the public.
    console.error('Public unified search API error:', e);
    return NextResponse.json({ error: 'Unable to search right now.' }, { status: 500 });
  }
}, { route: '/api/public/search' });
