import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { sendEmail } from '@/lib/email';
import { renderPlatformEmailHtml } from '@/lib/platform-email-templates';
import { fillSubjectTokens } from '@/lib/email-markup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ key: string }> };

// POST /api/platform-admin/email-templates/[key]/test-send
// Sends a preview of the template (with placeholder variable values) to the
// logged-in platform admin's email address.
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { user, response } = await requirePlatformAreaApi('email_templates', 'write');
  if (response) return response;
  if (!user.email) return Response.json({ error: 'No email address on platform user account.' }, { status: 400 });

  const { key } = await params;
  const body = await req.json().catch(() => ({}));

  // Accept an optional preview payload (subject / heading / body / cta_label) so
  // the admin can preview unsaved edits before saving.
  const previewSubject  = typeof body.subject   === 'string' ? body.subject   : null;
  const previewHeading  = typeof body.heading   === 'string' ? body.heading   : null;
  const previewBody     = typeof body.body      === 'string' ? body.body      : null;
  const previewCtaLabel = typeof body.cta_label === 'string' ? body.cta_label : null;

  const { data: tmpl, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('*')
    .eq('key', key)
    .single();

  if (error) return Response.json({ error: 'Template not found.' }, { status: 404 });

  const subject  = previewSubject  ?? tmpl.subject;
  const heading  = previewHeading  ?? tmpl.heading;
  const bodyText = previewBody     ?? tmpl.body;
  const ctaLabel = previewCtaLabel ?? tmpl.cta_label;

  // Placeholder values so {{tokens}} render as readable [name] markers without real data.
  const vars: Record<string, string> = {};
  if (Array.isArray(tmpl.variables)) {
    for (const v of tmpl.variables as string[]) vars[v] = `[${v}]`;
  }

  // A dedicated cta_label (transactional templates) becomes an inline ::button so the
  // shared renderer handles it; marketing campaigns carry CTAs inline already.
  const bodyMarkup = ctaLabel ? `${bodyText}\n\n::button ${ctaLabel} | #` : bodyText;
  const testNote =
    `<p style="margin:2rem 0 0;font-size:0.72rem;color:rgba(241,245,249,0.3);letter-spacing:0.04em;">` +
    `Test email sent from Platform Admin · Template key: ${key}</p>`;

  // Render through the SAME pipeline as send/preview so the test matches production.
  const html = renderPlatformEmailHtml({ heading, body: bodyMarkup, vars, footerHtml: testNote });
  const filledSubject = fillSubjectTokens(subject, vars);

  await sendEmail(user.email, `[TEST] ${filledSubject}`, html);

  return Response.json({ ok: true, sentTo: user.email });
}, { route: '/api/platform-admin/email-templates/[key]/test-send' });
