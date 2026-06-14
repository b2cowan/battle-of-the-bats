import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { sendEmail } from '@/lib/email';
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

  // Replace any {{variable}} tokens with placeholder text so the preview email
  // renders sensibly without real data.
  const vars: Record<string, string> = {};
  if (Array.isArray(tmpl.variables)) {
    for (const v of tmpl.variables as string[]) {
      vars[v] = `[${v}]`;
    }
  }

  function fill(template: string): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
  }

  const filledSubject  = fill(subject);
  const filledHeading  = fill(heading);
  const filledBody     = fill(bodyText);
  const filledCtaLabel = ctaLabel ? fill(ctaLabel) : null;

  // Build HTML using the shared platform wrap style
  const ctaHtml = filledCtaLabel
    ? `<a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;margin-top:1rem;">${filledCtaLabel}</a>`
    : '';

  const bodyLines = filledBody
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      // Convert simple markdown bold (**text**) to <strong>
      const converted = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 0.85rem;line-height:1.65;color:rgba(241,245,249,0.85);">${converted}</p>`;
    })
    .join('');

  const html = `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
    <span style="display:inline-block;margin-left:0.75rem;font-size:0.65rem;font-weight:600;color:rgba(245,158,11,0.9);letter-spacing:0.12em;text-transform:uppercase;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:0.15rem 0.4rem;border-radius:2px;">TEST EMAIL</span>
  </div>
  <h2 style="color:#fff;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">${filledHeading}</h2>
  ${bodyLines}
  ${ctaHtml}
  <p style="margin:2rem 0 0;font-size:0.72rem;color:rgba(241,245,249,0.3);letter-spacing:0.04em;">Preview sent from Platform Admin · Template key: ${key}</p>
</div>`;

  await sendEmail(user.email, `[TEST] ${filledSubject}`, html);

  return Response.json({ ok: true, sentTo: user.email });
}, { route: '/api/platform-admin/email-templates/[key]/test-send' });
