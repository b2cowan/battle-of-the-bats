'use client';
/**
 * SPONSORSHIPS › DEALS (Board Ready Stage 6, Part 1; round 1 tab 1). Before any package exists the tab is three steps —
 * the shipped row list, not a wizard: Your invoice details · Make your first package · Your sponsorship form, each opening
 * its window or page, the first with a green "Done". It goes away for good once a package exists. The sponsors the club
 * already had on its website arrive on the Sponsors tab untouched, and the callout says so. Offering a deal, and the list of
 * deals by state, are Part 2.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ClubRow, ClubRowList, ClubSection } from '../RepKit';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { invoiceDetailsDone } from '@/lib/club-sponsorships';
import { useSponsorships } from './api';
import InvoiceDetailsWindow from './InvoiceDetailsWindow';
import PackageWindow from './PackageWindow';
import LoadingState from '@/components/shared/LoadingState';
import css from './Sponsorships.module.css';

export default function DealsScreen() {
  const { slug, data, error, reload } = useSponsorships();
  const [open, setOpen] = useState<'invoice' | 'package' | null>(null);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const hasPackage = data.packages.length > 0;
  if (hasPackage) {
    return <ClubSection><p className={ck.hint}>{W.noDeals}</p></ClubSection>;
  }
  const steps = [invoiceDetailsDone(data.settings), false, data.formQuestions > 0];
  const done = steps.filter(Boolean).length;
  const doneChip = <> <span className={`${ck.chip} ${ck.chipGood}`}>{W.ready.doneChip}</span></>;
  const sp = `/${slug}/admin/sponsorships`;

  return (
    <>
      <ClubSection title={W.ready.title} meta={<span className={css.deskOnly}>{W.ready.done(done)}</span>} list>
        <ClubRowList inset>
          <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpen('invoice')} chevron
            title={<>{W.ready.invoice}{steps[0] && doneChip}</>}
            caption={<span className={css.deskOnly}>{W.ready.invoiceCaption}</span>} />
          <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpen('package')} chevron
            title={W.ready.firstPackage}
            caption={<span className={css.deskOnly}>{W.ready.firstPackageCaption}</span>} />
          <ClubRow as="link" href={`${sp}/setup/form`} chevron
            title={<>{W.ready.form}{steps[2] && doneChip}</>}
            caption={<><span className={css.deskOnly}>{W.ready.formCaption}</span><span className={css.phoneOnly}>{W.ready.formCaptionPhone}</span></>} />
        </ClubRowList>
      </ClubSection>
      <p className={`${css.after} ${css.deskOnly}`}>{W.ready.after}</p>
      {data.sponsors.length > 0 && (
        <div className={css.callout}>
          <div className={css.calloutBody}>
            <strong>{W.ready.already(data.sponsors.length)}</strong>
            <span><span className={css.deskOnly}>{W.ready.alreadyBody}</span><span className={css.phoneOnly}>{W.ready.alreadyBodyPhone}</span></span>
          </div>
          <Link className={css.calloutDoor} href={`${sp}/sponsors`}>{W.ready.alreadyDoor}<ChevronRight size={14} aria-hidden /></Link>
        </div>
      )}
      {open === 'invoice' && (
        <InvoiceDetailsWindow slug={slug} settings={data.settings} canChange={data.changesInvoice}
          onSaved={() => void reload()} onClose={() => setOpen(null)} />
      )}
      {open === 'package' && (
        <PackageWindow slug={slug} pkg={null} onChanged={() => void reload()} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
