import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('age_group_id, status');

    if (error) {
      console.error('Stats query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count non-rejected registrations per age group
    const counts: Record<string, number> = {};
    for (const reg of data || []) {
      if (reg.status !== 'rejected') {
        counts[reg.age_group_id] = (counts[reg.age_group_id] || 0) + 1;
      }
    }

    return NextResponse.json(counts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
