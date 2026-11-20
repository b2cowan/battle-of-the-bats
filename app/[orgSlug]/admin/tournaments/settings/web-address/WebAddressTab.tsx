'use client';
/**
 * SETTINGS & ACCESS › NAME & ADDRESS (navigation Phase 2 Part B, P1, owner 2026-11-10; drawings tab 15 — renamed and grown
 * by Settings in both workspaces Session 2, owner rulings A1, A3, A9, 2026-11-20; drawing tab 4). A Tournament-plan
 * organization's name and its web address — the first part of every link (fieldlogichq.ca/<address>/…). One card, two
 * rows: the Name (Rename opens the Name window) and the Web address (Change the address opens the same window as before,
 * `WebAddressWindow`). Two equal actions, so both are the white button (A9). Anyone who reaches the place reads both; only
 * the owner changes them, others read "Owner only" (A3). The address stays `/settings/web-address` (fewer moving parts;
 * the tab's name is what people read). A club keeps both in the organization's Settings (`openClubHome`).
 */
import { useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import { NAME_AND_ADDRESS_WORDS as NA } from '@/lib/workspace-identity-words';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import NameWindow from '@/components/admin/kit/club/NameWindow';
import WebAddressWindow from '../WebAddressWindow';
import styles from '../settings-access.module.css';

export default function WebAddressTab() {
  const { currentOrg, userRole, refresh } = useOrg();
  const { currentTournament } = useTournament();
  usePageTitle(NA.tab);
  const [open, setOpen] = useState<'name' | 'address' | null>(null);
  const isOwner = userRole === 'owner';
  const slug = currentOrg?.slug ?? '';

  async function saveName(name: string): Promise<string | null> {
    if (!currentOrg) return NA.window.failed;
    try {
      const res = await fetch(`/api/admin/org-settings?orgSlug=${encodeURIComponent(currentOrg.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        return res.status === 400 && data.error ? data.error : NA.window.failed;
      }
      await refresh();
      setOpen(null);
      return null;
    } catch {
      return NA.window.failed;
    }
  }

  return (
    <>
      <TabPageHeader inlineActions title={NA.tab} />
      <section className={styles.identityCard} aria-label={NA.tab}>
        <div className={styles.identityRow}>
          <div className={styles.addressFacts}>
            <h2 className={styles.addressCaption}>{NA.name}</h2>
            <p className={styles.addressNow}>{currentOrg?.name ?? ''}</p>
            <p className={styles.addressLine}>{NA.nameLine}</p>
          </div>
          {isOwner
            ? <button type="button" className="btn btn-outline" onClick={() => setOpen('name')} aria-haspopup="dialog">{NA.rename}</button>
            : <span className={styles.addressOwnerOnly}>{NA.ownerOnly}</span>}
        </div>
        <div className={styles.identityRow}>
          <div className={styles.addressFacts}>
            <h2 className={styles.addressCaption}>{WA.name}</h2>
            <p className={styles.addressNow}>fieldlogichq.ca/{slug}</p>
            <p className={styles.addressLine}>{WA.hint}</p>
          </div>
          {isOwner
            ? <button type="button" className="btn btn-outline" onClick={() => setOpen('address')} aria-haspopup="dialog">{WA.doorAction}</button>
            : <span className={styles.addressOwnerOnly}>{WA.ownerOnly}</span>}
        </div>
      </section>
      {open === 'name' && isOwner && currentOrg && (
        <NameWindow
          title={NA.window.title}
          identity={NA.window.identity(currentOrg.name)}
          field={NA.window.field}
          hint={NA.window.hint}
          saveLabel={NA.window.save}
          cancelLabel={NA.window.cancel}
          current={currentOrg.name}
          save={saveName}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'address' && isOwner && currentOrg && (
        <WebAddressWindow
          orgName={currentOrg.name}
          current={currentOrg.slug}
          eventSlug={currentTournament?.slug}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
