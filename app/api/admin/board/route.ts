import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { boardNames } from '@/lib/member-names';

// ---------------------------------------------------------------------------
// The board by name (Club Tier Stage 13a: Ask 6 + ALSO row R1, owner 2026-11-06)
// GET /api/admin/board?orgSlug=<slug> → { people: { name, role }[] }
//   — who sits on the club's board, so a screen can say "Morgan Ellis (owner) can give a treasurer access" or "Jules
//     Moreau (league admin) creates the season". ⚖ NAMES ONLY: no email, phone or id leaves this route (lib/member-names.ts
//     `boardNames`). Any active member of the club may read it; it collects nothing new. READ-ONLY.
// ---------------------------------------------------------------------------
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  const people = await boardNames(ctx.org.id);
  return NextResponse.json({ people: people.map(p => ({ name: p.name, role: p.role })) });
}, { route: '/api/admin/board' });
