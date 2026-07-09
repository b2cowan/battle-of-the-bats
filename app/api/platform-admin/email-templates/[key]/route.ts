import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getMarketingEmailDefault } from '@/lib/marketing-email-defaults';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ key: string }> };

// GET /api/platform-admin/email-templates/[key]
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { response } = await requirePlatformAreaApi('email_templates', 'view');
  if (response) return response;

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
  const { user, response } = await requirePlatformAreaApi('email_templates', 'write');
  if (response) return response;

  const { key } = await params;
  const body = await req.json().catch(() => ({}));

  const subject   = typeof body.subject   === 'string' ? body.subject.trim()   : null;
  const heading   = typeof body.heading   === 'string' ? body.heading.trim()   : null;
  const bodyText  = typeof body.body      === 'string' ? body.body.trim()      : null;
  const ctaLabel  = typeof body.cta_label === 'string' ? body.cta_label.trim() || null : null;

  if (!subject || !heading || !bodyText) {
    return Response.json({ error: 'subject, heading, and body are required.' }, { status: 400 });
  }

  // "Customised" means the saved copy actually DIFFERS from the built-in original. For a
  // marketing campaign we can compare against its canonical default, so saving content
  // identical to the default (e.g. right after a reset) correctly stays "Default" rather
  // than flipping back to "Customised". Transactional templates have no markup default to
  // compare here, so any save marks them customised (unchanged behavior).
  const def = getMarketingEmailDefault(key);
  const matchesDefault = !!def
    && subject === def.subject.trim()
    && heading === def.heading.trim()
    && bodyText === def.body.trim()
    && ctaLabel === null;

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .update({
      subject,
      heading,
      body: bodyText,
      cta_label: ctaLabel,
      is_customised: !matchesDefault,
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
  const { user, response } = await requirePlatformAreaApi('email_templates', 'write');
  if (response) return response;

  const { key } = await params;

  // Reset semantics:
  //  • MARKETING campaigns render FROM this row, so "reset" must genuinely restore the
  //    original copy — otherwise the operator's edited text would keep sending under a
  //    "Default" badge. Restore subject/heading/body/variables from the canonical default.
  //  • TRANSACTIONAL/system templates still send from the hardcoded lib/email.ts builders
  //    (until each is wired), so clearing the customised flag is enough for them.
  const marketingDefault = getMarketingEmailDefault(key);
  const resetPatch = marketingDefault
    ? {
        subject: marketingDefault.subject,
        heading: marketingDefault.heading,
        body: marketingDefault.body,
        cta_label: null,
        cta_url_pattern: null,
        variables: marketingDefault.variables,
        is_customised: false,
        updated_at: new Date().toISOString(),
        updated_by: user.email ?? user.id,
      }
    : {
        is_customised: false,
        updated_at: new Date().toISOString(),
        updated_by: user.email ?? user.id,
      };

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .update(resetPatch)
    .eq('key', key)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data, reset: true });
}, { route: '/api/platform-admin/email-templates/[key]' });
