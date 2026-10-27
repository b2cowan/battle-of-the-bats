import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { findClubs } from '@/lib/platform-people-lookup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalAddress } from '@/lib/lead-numbers';
import { readStaffAddresses } from '@/lib/lead-book';
import { consoleDay } from '@/lib/console-dates';

/**
 * The lead page's club picker (Support console Stage 7 Part 4, drawing C): searches by name like Find. Demo clubs are
 * left out by the search itself; a club a staff address owns is left out here. A failed read says so, never "none".
 */
export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ clubs: [] });
  try {
    const { rows } = await findClubs(q);
    const staff = await readStaffAddresses();
    const kept = rows.filter(r => !(r.ownerEmail && staff.has(normalAddress(r.ownerEmail))));
    const { data: dates, error } = kept.length
      ? await supabaseAdmin.from('organizations').select('id, created_at').in('id', kept.map(r => r.id))
      : { data: [], error: null };
    if (error) throw error;
    const createdAt = new Map(((dates ?? []) as { id: string; created_at: string }[]).map(d => [d.id, d.created_at]));
    return NextResponse.json({
      clubs: kept.map(r => ({ id: r.id, name: r.name, planId: r.planId, status: r.subscriptionStatus ?? null, joined: createdAt.has(r.id) ? consoleDay(createdAt.get(r.id)) : null })),
    });
  } catch {
    return NextResponse.json({ error: 'The clubs could not be searched just now.' }, { status: 503 });
  }
}, { route: '/api/platform-admin/early-access/clubs' });
