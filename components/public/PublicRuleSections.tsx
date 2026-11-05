'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, FileText } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { RuleIcon } from '@/lib/rule-icons';
import PublicDisclosure from './PublicDisclosure';
import { PublicLinkList } from './PublicDoorRow';
import styles from './PublicRules.module.css';

type Section = { anchor: string; title: string; icon: string | null; items: string[] };
const DOWNLOADS_ANCHOR = 'rule-downloads-and-resources';

function RuleLink({ anchor, title, shareAllDivisions }: { anchor: string; title: string; shareAllDivisions: boolean }) {
  const { copied, copy } = useCopyToClipboard();
  return <>
    <button type="button" className={styles.copy} aria-label={`Copy a link to ${title}`} title={copied ? 'Link copied' : 'Copy link'} onClick={() => {
      const url = new URL(window.location.href);
      url.hash = anchor;
      // A recipient's saved division must never hide the section being shared with them.
      if (shareAllDivisions) url.searchParams.set('view', 'all');
      void copy(url.toString());
    }}>{copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}</button>
    <span className="sr-only" role="status">{copied ? 'Link copied' : ''}</span>
  </>;
}

/** Rules' private interactive list; only public titles, text and resource links cross this client boundary. ONE framed
 *  list of link rows (Public page layout standard A8, R5): each rule is an item of it and still opens its window on a
 *  desk; on a phone it drops open inside the list. */
export default function PublicRuleSections({ sections, resources, isPreview, shareAllDivisions }: {
  sections: Section[]; resources: { label: string; url: string }[]; isPreview: boolean; shareAllDivisions: boolean;
}) {
  const [openAnchor, setOpenAnchor] = useState<string | null>(null);
  // Reserve a separate anchor even when an organizer named a rules section "Downloads and resources".
  let downloadsAnchor = DOWNLOADS_ANCHOR;
  while (sections.some(section => section.anchor === downloadsAnchor)) downloadsAnchor += '-downloads';

  useEffect(() => {
    let frame = 0;
    function revealHash() {
      let anchor: string;
      try { anchor = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!sections.some(section => section.anchor === anchor) && !(resources.length && anchor === downloadsAnchor)) return;
      setOpenAnchor(anchor);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    }
    revealHash();
    window.addEventListener('hashchange', revealHash);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', revealHash); };
  }, [sections, resources.length, downloadsAnchor]);

  const changeOpen = (anchor: string, open: boolean) => setOpenAnchor(current => open ? anchor : current === anchor ? null : current);
  return <>
    <PublicLinkList>
      {sections.map(section =>
        <PublicDisclosure key={section.anchor} id={section.anchor} joined title={section.title} modalOnDesktop open={openAnchor === section.anchor}
          icon={<RuleIcon name={section.icon} size={20} aria-hidden />}
          action={isPreview ? undefined : <RuleLink anchor={section.anchor} title={section.title} shareAllDivisions={shareAllDivisions} />}
          onOpenChange={open => changeOpen(section.anchor, open)}>
          <div className={styles.body}>
            <ul className={styles.items}>{section.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>
        </PublicDisclosure>)}
      {resources.length > 0 &&
        <PublicDisclosure id={downloadsAnchor} joined title="Downloads & Resources" sub={`${resources.length} ${resources.length === 1 ? 'file' : 'files'}`}
          icon={<FileText size={20} aria-hidden />} modalOnDesktop open={openAnchor === downloadsAnchor} onOpenChange={open => changeOpen(downloadsAnchor, open)}>
          <div className={styles.body}><div className={styles.resources}>
            {resources.map((resource, index) => isPreview
              ? <span key={index} className={styles.resource}>{resource.label}</span>
              : <a key={index} className={styles.resource} href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={18} aria-hidden />{resource.label}</a>)}
          </div></div>
        </PublicDisclosure>}
    </PublicLinkList>
  </>;
}
