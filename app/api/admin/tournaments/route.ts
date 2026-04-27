import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: "Environment variables missing on server." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const { action, id, data } = await req.json();

    if (action === 'set-active' && id) {
      // 1. Deactivate ALL (except maybe the dummy one if it exists)
      await supabase.from('tournaments').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Activate specific one
      const { error } = await supabase.from('tournaments').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    }

    else if (action === 'update' && id) {
      // If setting to active, deactivate others first
      if (data.isActive) {
        await supabase.from('tournaments').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await supabase.from('tournaments').update({
        year: data.year,
        name: data.name,
        is_active: data.isActive,
        start_date: data.startDate,
        end_date: data.endDate
      }).eq('id', id);
      if (error) throw error;
    }

    else if (action === 'delete' && id) {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Admin Tournaments API Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Unknown server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
