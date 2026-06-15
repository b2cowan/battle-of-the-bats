import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import styles from './email-templates.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  auth:        'Authentication',
  billing:     'Billing',
  tournament:  'Tournament',
  rep_teams:   'Rep Teams',
  house_league: 'House League',
  system:      'System',
};

const CATEGORY_ORDER = ['auth', 'billing', 'tournament', 'rep_teams', 'house_league', 'system'];

type Template = {
  key: string;
  label: string;
  description: string;
  category: string;
  is_customised: boolean;
  updated_at: string;
  updated_by: string | null;
};

export default async function EmailTemplatesPage() {
  await requirePlatformAreaView('email_templates');
  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .select('key, label, description, category, is_customised, updated_at, updated_by')
    .order('category')
    .order('label');

  const templates: Template[] = data ?? [];

  // Group by category
  const grouped: Record<string, Template[]> = {};
  for (const t of templates) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  const categories = CATEGORY_ORDER.filter(c => grouped[c]);

  const customisedCount = templates.filter(t => t.is_customised).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Billing &amp; Product</div>
        <h1 className={styles.title}>Email Templates</h1>
      </header>

      <p className={styles.desc}>
        View and customise the content of all platform-level transactional emails. Editing a template
        overrides the hardcoded default — the FieldLogicHQ brand envelope (header, footer) is always
        applied automatically. Use &ldquo;Reset to default&rdquo; to go back to the built-in copy.
        {customisedCount > 0 && (
          <> &nbsp;<strong style={{ color: '#D9F99D' }}>{customisedCount} customised</strong> of {templates.length} templates.</>
        )}
      </p>

      {error && (
        <p className={styles.errorMsg}>
          Failed to load templates: {error.message}. Run migration 083 if the table does not exist yet.
        </p>
      )}

      {categories.map(cat => (
        <div key={cat} className={styles.categoryGroup}>
          <div className={styles.categoryHeading}>{CATEGORY_LABELS[cat] ?? cat}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Template</th>
                <th>Key</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(grouped[cat] ?? []).map(t => (
                <tr key={t.key}>
                  <td>
                    <div className={styles.templateLabel}>{t.label}</div>
                    <div className={styles.templateDesc}>{t.description}</div>
                  </td>
                  <td>
                    <span className={styles.keyChip}>{t.key}</span>
                  </td>
                  <td>
                    {t.is_customised ? (
                      <span className={styles.badgeCustomised}>Customised</span>
                    ) : (
                      <span className={styles.badgeDefault}>Default</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/platform-admin/email-templates/${t.key}`} className={styles.editBtn}>
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
