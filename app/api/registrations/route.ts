import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        *,
        age_groups ( name ),
        tournaments ( name )
      `)
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Flatten names for the frontend
    const flattened = data?.map((r: any) => ({
      ...r,
      age_group_name: r.age_groups?.name || 'Unknown Division',
      tournament_name: r.tournaments?.name || 'Unknown Tournament'
    }));

    return NextResponse.json(flattened);
  } catch (err: any) {
    console.error('Registrations Route Catch:', err);
    return NextResponse.json({ 
      error: 'Exception thrown', 
      message: err?.message,
      stack: err?.stack 
    }, { status: 500 });
  }
}
