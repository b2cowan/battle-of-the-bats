import { requirePlatformAreaView } from '@/lib/platform-auth';
import EmailTemplateEditor from './EmailTemplateEditor';

export default async function EmailTemplateEditorPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  // Matrix guard: only roles that can view the email_templates area reach the editor.
  // (The list page already guards; this closes the direct-URL hole.)
  await requirePlatformAreaView('email_templates');
  const { key } = await params;
  return <EmailTemplateEditor templateKey={key} />;
}
