import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Registrations Route Catch:', err);
    return NextResponse.json({ 
      error: 'Exception thrown', 
      message: err?.message,
      stack: err?.stack 
    }, { status: 500 });
  }
}
