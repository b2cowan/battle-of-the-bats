'use client';
/**
 * SETTINGS & ACCESS › WEB ADDRESS (navigation Phase 2 Part B, P1, owner 2026-11-10; drawings tab 15). A Tournament-plan
 * organization's web address — the first part of every link (fieldlogichq.ca/<address>/…) — got its own tab when Settings &
 * access became a place with tabs (E3): its only door had been a card on the page that became those tabs. One card: the
 * address today, and for the owner "Change the address", which opens the same window as before (`WebAddressWindow`); anyone
 * else who reaches the place reads it, with "Owner only". The page's "?" is Settings & access's guide, last on its top row
 * (E11). A club keeps its web address in the organization's Settings (`openClubHome`).
 */
import { useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import HelpButton from '@/components/help/HelpButton';
import WebAddressWindow from '../WebAddressWindow';
import { SETTINGS_ACCESS_HELP } from '../settings-access-help';
import styles from '../settings-access.module.css';

export default function WebAddressTab() {
  const { currentOrg, userRole } = useOrg();
  const { currentTournament } = useTournament();
  usePageTitle(WA.name);
  const [open, setOpen] = useState(false);
  const isOwner = userRole === 'owner';
  const slug = currentOrg?.slug ?? '';

  return (
    <>
      <TabPageHeader inlineActions title={WA.name} actions={<HelpButton help={SETTINGS_ACCESS_HELP} label={WA.name} iconOnly />} />
      <section className={styles.addressCard} aria-labelledby="web-address-name">
        <div className={styles.addressFacts}>
          <h2 id="web-address-name" className={styles.addressCaption}>{WA.name}</h2>
          <p className={styles.addressNow}>fieldlogichq.ca/{slug}</p>
          <p className={styles.addressLine}>{WA.hint}</p>
        </div>
        {isOwner
          ? <button type="button" className="btn btn-lime" onClick={() => setOpen(true)} aria-haspopup="dialog">{WA.doorAction}</button>
          : <span className={styles.addressOwnerOnly}>{WA.ownerOnly}</span>}
      </section>
      {open && isOwner && currentOrg && (
        <WebAddressWindow
          orgName={currentOrg.name}
          current={currentOrg.slug}
          eventSlug={currentTournament?.slug}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
