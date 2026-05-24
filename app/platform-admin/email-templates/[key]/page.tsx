import EmailTemplateEditor from './EmailTemplateEditor';

export default async function EmailTemplateEditorPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <EmailTemplateEditor templateKey={key} />;
}
