'use client';
/**
 * SETUP › SPONSORSHIP FORM (Board Ready Stage 6, Part 1; ask 8). The season sign-up form's page, given the business form:
 * its locked card is the business details the club can't remove (business name as it should appear, contact name, email,
 * invoice address — required; phone, website — asked; the logo — can come later), then the club's own questions and
 * documents, Stage 4's editor with no "for each child" groups and no Health switch.
 */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { ClubSection, PageLoading, RepChip } from '../RepKit';
import { TabActions } from '../PlaceFrame';
import SignupFormScreen from '../league/form/SignupFormScreen';
import ck from '../ClubKit.module.css';
import { FORM_WORDS } from '@/lib/club-form-words';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import css from './Sponsorships.module.css';

export default function SponsorshipFormScreen() {
  const { currentOrg, loading } = useOrg();
  if (loading || !currentOrg) return <PageLoading label={FORM_WORDS.loading} />;
  const fixedCard = (
    <ClubSection id="form-fixed" title={<>{W.formScreen.fixedTitle} <RepChip>{FORM_WORDS.fixedChip}</RepChip></>} meta={FORM_WORDS.fixedSum}>
      <ul>{W.formScreen.fixed.map(x => <li key={x}>{x}</li>)}</ul>
      <p className={ck.hint}>{W.formScreen.fixedHint}</p>
    </ClubSection>
  );
  return (
    <>
      <TabActions lede={W.formScreen.title}>
        <Link className={css.linkButton} href={`/${currentOrg.slug}/admin/sponsorships/setup`}><ChevronLeft size={14} aria-hidden />{W.setup.formBack}</Link>
      </TabActions>
      <SignupFormScreen orgSlug={currentOrg.slug} planId={currentOrg.planId}
        sponsorship={{ fixedCard, refusedTitle: W.formScreen.refused, lede: W.formScreen.lede, noQuestionsLine: W.formScreen.noQuestionsLine }} />
    </>
  );
}
