import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { searchDirectory } from '@/lib/directory';

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
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    // Log detail server-side; return a generic message so DB/schema detail never reaches the public.
    console.error('Public unified search API error:', e);
    return NextResponse.json({ error: 'Unable to search right now.' }, { status: 500 });
  }
}, { route: '/api/public/search' });
