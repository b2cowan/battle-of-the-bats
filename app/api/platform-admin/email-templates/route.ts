import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/platform-admin/email-templates — list all templates
export async function GET() {
  const user = await getPlatformAuthContext();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('*')
    .order('category')
    .order('label');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates: data });
}
