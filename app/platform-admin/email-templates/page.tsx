import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import EmailTemplatesList, { type TemplateRow } from './EmailTemplatesList';
import kit from '../console.module.css';

export default async function EmailTemplatesPage() {
  await requirePlatformAreaView('email_templates');
  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('key, label, description, category, is_customised')
    .order('category')
    .order('label');

  const templates: TemplateRow[] = data ?? [];
  const customisedCount = templates.filter(t => t.is_customised).length;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Email templates" />

      <p className={kit.caption}>
        View and customise the content of platform emails — the transactional/system emails and the
        founding-season <strong>Marketing / Campaign</strong> emails. Editing a template overrides the
        default; the FieldLogicHQ brand envelope (header, footer) is always applied automatically. Use
        &ldquo;Reset to default&rdquo; to go back to the built-in copy.
        {customisedCount > 0 && (
          <> &nbsp;<strong>{customisedCount} customised</strong> of {templates.length} templates.</>
        )}
      </p>

      {error && (
        <p className={`${kit.notice} ${kit.noticeBad}`}>
          Failed to load templates: {error.message}. Run migration 083 if the table does not exist yet.
        </p>
      )}

      <EmailTemplatesList templates={templates} />
    </div>
  );
}
