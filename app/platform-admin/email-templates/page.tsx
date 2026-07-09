import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import EmailTemplatesList, { type TemplateRow } from './EmailTemplatesList';
import styles from './email-templates.module.css';

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
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Billing &amp; Product</div>
        <h1 className={styles.title}>Email Templates</h1>
      </header>

      <p className={styles.desc}>
        View and customise the content of platform emails — the transactional/system emails and the
        founding-season <strong>Marketing / Campaign</strong> emails. Editing a template overrides the
        default; the FieldLogicHQ brand envelope (header, footer) is always applied automatically. Use
        &ldquo;Reset to default&rdquo; to go back to the built-in copy.
        {customisedCount > 0 && (
          <> &nbsp;<strong style={{ color: '#D9F99D' }}>{customisedCount} customised</strong> of {templates.length} templates.</>
        )}
      </p>

      {error && (
        <p className={styles.errorMsg}>
          Failed to load templates: {error.message}. Run migration 083 if the table does not exist yet.
        </p>
      )}

      <EmailTemplatesList templates={templates} />
    </div>
  );
}
