'use client';

import { useEffect, useState } from 'react';
import {
  BILLING_LOCATION_CONSOLE_WORDS as W, REVIEW_CONSEQUENCE, countryInfo, formatBillingAddress, type ConsoleBillingLocation,
} from '@/lib/billing-location';
import { consoleDate } from '@/lib/console-dates';
import { sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import moneyStyles from './money.module.css';

/**
 * THE MONEY TAB'S BILLING-ADDRESS BLOCK (GST/HST Stage 1 Part 3): where this organization's buyer is billed (a Coaches
 * Portal's is the coach's own home address), the US declaration with its wording version, and an amber "Needs review" with
 * the staff sentence and what it means for tax. Read only: Stage 1 has no edit or resolve here, by ruling.
 */
export default function BillingAddressPanel({ orgId }: { orgId: string }) {
  const [answer, setAnswer] = useState<ConsoleBillingLocation | 'failed' | null>(null);
  useEffect(() => {
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money/billing-address`, 'GET').then(({ ok, data }) => {
      if (live) setAnswer(ok ? (data as unknown as ConsoleBillingLocation) : 'failed');
    });
    return () => { live = false; };
  }, [orgId]);

  if (!answer) return null;
  return (
    <>
      <h2 className={kit.sectionTitle}>{W.heading}</h2>
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
                          {answer.review.note}{answer.review.setAt ? ` (${consoleDate(answer.review.setAt)})` : ''} {REVIEW_CONSEQUENCE}
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
