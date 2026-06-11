import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ key: string }> };

// GET /api/platform-admin/email-templates/[key]
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const user = await getPlatformAuthContext();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('*')
    .eq('key', key)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ template: data });
}, { route: '/api/platform-admin/email-templates/[key]' });

// PUT /api/platform-admin/email-templates/[key] — save customised content
export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const user = await getPlatformAuthContext();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const body = await req.json().catch(() => ({}));

  const subject   = typeof body.subject   === 'string' ? body.subject.trim()   : null;
  const heading   = typeof body.heading   === 'string' ? body.heading.trim()   : null;
  const bodyText  = typeof body.body      === 'string' ? body.body.trim()      : null;
  const ctaLabel  = typeof body.cta_label === 'string' ? body.cta_label.trim() || null : null;

  if (!subject || !heading || !bodyText) {
    return Response.json({ error: 'subject, heading, and body are required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .update({
      subject,
      heading,
      body: bodyText,
      cta_label: ctaLabel,
      is_customised: true,
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? user.id,
    })
    .eq('key', key)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data });
}, { route: '/api/platform-admin/email-templates/[key]' });

// DELETE /api/platform-admin/email-templates/[key] — reset to hardcoded default
export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const user = await getPlatformAuthContext();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;

  // Fetch the seeded defaults by temporarily clearing the customised flag and
  // noting updated_by. We simply set is_customised=false; the app will then
  // use the hardcoded lib/email.ts template at render time.
  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .update({
      is_customised: false,
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? user.id,
    })
    .eq('key', key)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data, reset: true });
}, { route: '/api/platform-admin/email-templates/[key]' });
