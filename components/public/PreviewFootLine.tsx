import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';

/**
 * A preview club's footer line (Club Website Track P, Session P2; drawing tab 5): the band's words and the removal route,
 * with the address as a mail link so a phone gets a real tap target (/design). The words are `previewFootText`.
 */
export default function PreviewFootLine({ text, className, linkClassName }: { text: string; className?: string; linkClassName?: string }) {
  const at = text.indexOf(FIELDLOGICHQ_CONTACT_EMAIL);
  if (at < 0) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      {text.slice(0, at)}
      <a href={`mailto:${FIELDLOGICHQ_CONTACT_EMAIL}`} className={linkClassName}>{FIELDLOGICHQ_CONTACT_EMAIL}</a>
      {text.slice(at + FIELDLOGICHQ_CONTACT_EMAIL.length)}
    </p>
  );
}
