'use client';
/**
 * SPONSORSHIPS › SETUP (Board Ready Stage 6, Part 1; round 1 tab 1's "Setup holds the sponsorship form … and the invoice
 * details. Done once, so not on the working tabs."). The tab itself was not drawn: two rows of the shipped row list, in the
 * checklist's own words — Invoice details (its record window) and Sponsorship form (a page one level down).
 */
import { useState } from 'react';
import { ClubRow, ClubRowList, ClubSection } from '../RepKit';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { useSponsorships } from './api';
import InvoiceDetailsWindow from './InvoiceDetailsWindow';
import LoadingState from '@/components/shared/LoadingState';
import css from './Sponsorships.module.css';

export default function SetupScreen() {
  const { slug, data, error, reload } = useSponsorships();
  const [open, setOpen] = useState(false);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;
  return (
    <>
      <ClubSection list>
        <ClubRowList inset>
          <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpen(true)} chevron title={W.setup.invoice} caption={W.setup.invoiceCaption} />
          <ClubRow as="link" href={`/${slug}/admin/sponsorships/setup/form`} chevron title={W.setup.form} caption={W.setup.formCaption} />
        </ClubRowList>
      </ClubSection>
      {open && <InvoiceDetailsWindow slug={slug} settings={data.settings} canChange={data.changesInvoice} onSaved={() => void reload()} onClose={() => setOpen(false)} />}
    </>
  );
}
