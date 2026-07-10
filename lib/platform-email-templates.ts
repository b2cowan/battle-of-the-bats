/**
 * lib/platform-email-templates.ts
 *
 * The bridge between the operator-editable `platform_email_templates` rows and the
 * actual email that goes out. This is the "resolver" the migration-083 comment
 * referenced but which was never built — until now, editing a template saved to the
 * DB but never changed a single sent email.
 *
 * Two consumption modes:
 *
 *  1. TRANSACTIONAL (builder-native default): the hardcoded lib/email.ts builder stays
 *     the source of truth for the DEFAULT. The stored template is applied ONLY when an
 *     operator has explicitly customised it (`is_customised = true`). Safety property:
 *     a non-customised transactional email is byte-for-byte what it is today.
 *
 *  2. MARKETING (markup-native): the founding-season campaigns live entirely as markup
 *     rows (seeded in migration 179). Both the default AND any customisation are the
 *     row's markup, so send == preview == default. `alwaysRenderFromTemplate: true`
 *     selects this mode. The `fallback` is a belt-and-suspenders default used only if
 *     the row is missing (e.g. migration not yet applied in some environment).
 *
 * Either way, ANY DB error falls back to the provided default — the send never breaks
 * because a template lookup failed.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { wrap, sendEmail, type SendEmailResult } from '@/lib/email';
import {
  renderHeadingAndBody,
  fillSubjectTokens,
  type EmailVars,
  type TokenMode,
} from '@/lib/email-markup';

/**
 * Render a full platform email (heading + body markup) inside the shared FieldLogicHQ
 * brand envelope. Used by the send path and the server-side preview so both render
 * through the exact same pipeline. `footerHtml` is appended inside the envelope (e.g. a
 * sample unsubscribe block for previews); real marketing sends get their unsubscribe
 * footer injected downstream by lib/email-sender.ts, so send callers pass none.
 */
export function renderPlatformEmailHtml(p: {
  heading: string;
  body: string;
  vars?: EmailVars;
  footerHtml?: string;
  mode?: TokenMode;
}): string {
  const inner = renderHeadingAndBody({ heading: p.heading, body: p.body, vars: p.vars, mode: p.mode });
  return wrap(`${inner}\n${p.footerHtml ?? ''}`);
}

export type PlatformEmailTemplate = {
  key: string;
  label: string;
  description: string;
  subject: string;
  heading: string;
  body: string;
  cta_label: string | null;
  cta_url_pattern: string | null;
  variables: string[];
  category: string;
  is_customised: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type ResolvedEmail = {
  subject: string;
  html: string;
  /** Which source produced this render — useful for logging / debugging. */
  source: 'customised' | 'template' | 'default';
};

/** Fetch a single template row (or null if missing / on error). */
export async function resolvePlatformTemplate(
  key: string,
): Promise<PlatformEmailTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;
  return data as PlatformEmailTemplate;
}

/**
 * If the CTA is expressed via the dedicated cta_label / cta_url_pattern columns (as the
 * transactional templates are), append it to the body markup as a `::button` so the one
 * renderer handles it. Marketing campaigns carry their CTAs inline in the body and leave
 * these columns null, so this is a no-op for them.
 */
function bodyWithCta(row: PlatformEmailTemplate): string {
  if (!row.cta_label) return row.body;
  const url = row.cta_url_pattern ?? '#';
  return `${row.body}\n\n::button ${row.cta_label} | ${url}`;
}

/**
 * Render subject + branded HTML from an ALREADY-FETCHED template row + variable values.
 * Used by the marketing send path (which fetches the row once, then renders per
 * recipient) and by the preview endpoint. Whether the row is a default seed or an
 * operator customisation, the render is identical — so send == preview == default.
 */
export function renderTemplateEmail(
  row: PlatformEmailTemplate,
  vars: EmailVars,
  opts?: { footerHtml?: string },
): { subject: string; html: string } {
  const html = renderPlatformEmailHtml({
    heading: row.heading,
    body: bodyWithCta(row),
    vars,
    footerHtml: opts?.footerHtml,
  });
  return { subject: fillSubjectTokens(row.subject, vars), html };
}

/**
 * Resolve the subject + branded HTML for a platform email.
 *
 * @param key                    the platform_email_templates key
 * @param vars                   variable values to fill into subject/body tokens
 * @param fallback               the hardcoded default { subject, html } (built by the caller)
 * @param alwaysRenderFromTemplate  true for markup-native marketing campaigns
 */
export async function renderResolvedEmail(opts: {
  key: string;
  vars: EmailVars;
  fallback: { subject: string; html: string };
  alwaysRenderFromTemplate?: boolean;
}): Promise<ResolvedEmail> {
  const { key, vars, fallback, alwaysRenderFromTemplate = false } = opts;

  let row: PlatformEmailTemplate | null = null;
  try {
    row = await resolvePlatformTemplate(key);
  } catch {
    row = null;
  }

  const useTemplate = !!row && (row.is_customised || alwaysRenderFromTemplate);
  if (!row || !useTemplate) {
    return { subject: fallback.subject, html: fallback.html, source: 'default' };
  }

  const html = renderPlatformEmailHtml({
    heading: row.heading,
    body: bodyWithCta(row),
    vars,
  });
  const subject = fillSubjectTokens(row.subject, vars);
  return { subject, html, source: row.is_customised ? 'customised' : 'template' };
}

/**
 * Drop-in replacement for a transactional `sendEmail(to, subject, defaultHtml)` call that
 * applies the operator's saved override when the template is customised, and otherwise
 * sends the caller's default (the hardcoded lib/email.ts builder output) BYTE-FOR-BYTE.
 *
 * At a send site:
 *   await sendEmail(to, subject, someBuilderHtml(p));
 * becomes:
 *   await sendTransactionalEmail({ key, to, vars, defaultSubject: subject, defaultHtml: someBuilderHtml(p) });
 *
 * `vars` must use the template's declared token names (see the migration-083 seed's
 * `variables` array), which occasionally differ from the builder's param names.
 */
export async function sendTransactionalEmail(opts: {
  key: string;
  to: string;
  vars: EmailVars;
  defaultSubject: string;
  defaultHtml: string;
}): Promise<SendEmailResult> {
  const { subject, html } = await renderResolvedEmail({
    key: opts.key,
    vars: opts.vars,
    fallback: { subject: opts.defaultSubject, html: opts.defaultHtml },
  });
  return sendEmail(opts.to, subject, html);
}
