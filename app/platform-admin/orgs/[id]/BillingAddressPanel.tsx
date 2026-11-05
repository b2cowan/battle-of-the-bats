'use client';

import { useEffect, useState } from 'react';
import {
  BILLING_LOCATION_CONSOLE_WORDS as W, reviewConsequence, countryInfo, formatBillingAddress, type ConsoleBillingLocation,
} from '@/lib/billing-location';
import { consoleDate } from '@/lib/console-dates';
import { sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import moneyStyles from './money.module.css';

export type BillingAddressRead = ConsoleBillingLocation | 'failed' | null;

/** The one read of the billing address, taken by the club record (not the panel) so the Money tab's top strip and its tab dot
 *  can show a "Needs review" without anyone scrolling to the panel. Ours, so it is read whenever the role may read it. */
export function useBillingAddress(orgId: string, enabled: boolean): BillingAddressRead {
  const [answer, setAnswer] = useState<BillingAddressRead>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money/billing-address`, 'GET').then(({ ok, data }) => {
      if (live) setAnswer(ok ? (data as unknown as ConsoleBillingLocation) : 'failed');
    });
    return () => { live = false; };
  }, [orgId, enabled]);
  return enabled ? answer : null;
}

/** The flag, when there is one: what the tab dot and the top strip both read. */
export function reviewOf(answer: BillingAddressRead) {
  return answer && answer !== 'failed' && answer.buyer !== 'none' ? answer.review : null;
}

/** The review sentence staff read, the same words wherever it shows: the top strip and the row in the address block. */
export function ReviewText({ review }: { review: NonNullable<ReturnType<typeof reviewOf>> }) {
  return <>{review.note}{review.setAt ? ` (${consoleDate(review.setAt)})` : ''} {reviewConsequence(review.country)}</>;
}

export const BILLING_ADDRESS_ANCHOR = 'billing-address';

/**
 * THE MONEY TAB'S BILLING-ADDRESS BLOCK (GST/HST Stage 1 Part 3): where this organization's buyer is billed (a Coaches
 * Portal's is the coach's own home address), the US declaration with its wording version, and an amber "Needs review" with
 * the staff sentence and what it means for tax. Read only: Stage 1 has no edit or resolve here, by ruling.
 */
export default function BillingAddressPanel({ answer }: { answer: BillingAddressRead }) {
  if (!answer) return null;
  return (
    <>
      <h2 id={BILLING_ADDRESS_ANCHOR} className={kit.sectionTitle}>{W.heading}</h2>
      {answer === 'failed' ? (
        <p className={kit.caption}>{W.readFailed}</p>
      ) : answer.buyer === 'none' ? (
        <p className={kit.caption}>{W.noOwner}</p>
      ) : (
        <>
          <p className={kit.caption}>{answer.buyer === 'club' ? W.club : W.person}</p>
          {!answer.location ? (
            <p className={kit.caption}>{W.none}</p>
          ) : (
            <div className={kit.card}>
              <div className={kit.tableWrap}>
                <table className={kit.comfortable}>
                  <tbody>
                    <tr><th scope="row" className={`${kit.eye} ${moneyStyles.rowHead}`}>{W.address}</th><td>{formatBillingAddress(answer.location)}</td></tr>
                    <tr><th scope="row" className={`${kit.eye} ${moneyStyles.rowHead}`}>{W.country}</th><td>{countryInfo(answer.location.country)?.name ?? answer.location.country}</td></tr>
                    {answer.location.country === 'US' && (
                      <tr>
                        <th scope="row" className={`${kit.eye} ${moneyStyles.rowHead}`}>{W.declaration}</th>
                        <td>{W.declared(consoleDate(answer.location.usDeclarationAt), answer.location.usDeclarationVersion ?? '—')}</td>
                      </tr>
                    )}
                    {answer.review && (
                      <tr>
                        <th scope="row" className={`${kit.eye} ${moneyStyles.rowHead}`}>{W.review}</th>
                        <td>
                          <span className={`${kit.chip} ${kit.chipWarn}`}>{W.needsReview}</span>{' '}
                          <ReviewText review={answer.review} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
