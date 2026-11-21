'use client';

import { useState } from 'react';
import kit from '@/components/marketing/MarketingKit.module.css';
import fp from '@/components/marketing/ForPage.module.css';

/**
 * "Copy a link for your club" (on-sale pages S3b, W71). Copies ONE address to the clipboard and nothing else: no pre-filled
 * email, no reward, nothing sent by us — the coach shares it themselves, which keeps it clear of the anti-spam rules.
 * When the browser refuses the clipboard, the address is shown so it can be copied by hand.
 */
export default function CopyLinkButton({ url, label, done }: { url: string; label: string; done: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  return (
    <>
      <button type="button" onClick={copy} className={`${kit.link} ${kit.linkBlock} ${fp.linkButton}`}>
        {label}
      </button>
      <p className={`${kit.small} ${fp.copyNote}`} aria-live="polite">
        {state === 'copied' && done}
        {state === 'failed' && <>Copy this address: <span className={fp.copyUrl}>{url}</span></>}
      </p>
    </>
  );
}
