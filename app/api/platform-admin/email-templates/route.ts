import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

// GET /api/platform-admin/email-templates — list all templates
export const GET = withObservability(async () => {
  const user = await getPlatformAuthContext();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('*')
    .order('category')
    .order('label');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates: data });
}, { route: '/api/platform-admin/email-templates' });
