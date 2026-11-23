'use client';
/**
 * SETUP › SPONSORSHIP FORM (Board Ready Stage 6, Part 1; ask 8). The season sign-up form's page, given the business form:
 * its locked card is the business details the club can't remove (business name as it should appear, contact name, email,
 * business address — required when the deal charges GST/HST; phone, website — asked; the logo — can come later), then the club's own questions and
 * documents, Stage 4's editor with no "for each child" groups and no Health switch.
 *
 * The bar names this page ("← Setup │ Sponsorship form", `clubPlaceAt`), as it names the season's sign-up form; the page
 * draws neither the title nor the way back again (owner 2026-11-23).
 */
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { ClubSection, PageLoading, RepChip } from '../RepKit';
import SignupFormScreen from '../league/form/SignupFormScreen';
import ck from '../ClubKit.module.css';
import { FORM_WORDS } from '@/lib/club-form-words';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import css from './Sponsorships.module.css';

export default function SponsorshipFormScreen() {
  const { currentOrg, loading } = useOrg();
  usePageTitle(`${W.formScreen.title} · ${W.place}`);
  if (loading || !currentOrg) return <PageLoading label={FORM_WORDS.loading} />;
  const fixedCard = (
    <ClubSection id="form-fixed" title={<>{W.formScreen.fixedTitle} <RepChip>{FORM_WORDS.fixedChip}</RepChip></>} meta={FORM_WORDS.fixedSum}>
      <ul className={css.fixedList}>{W.formScreen.fixed.map(x => <li key={x}>{x}</li>)}</ul>
      <p className={ck.hint}>{W.formScreen.fixedHint}</p>
    </ClubSection>
  );
  return (
    <SignupFormScreen orgSlug={currentOrg.slug} planId={currentOrg.planId}
      sponsorship={{ fixedCard, refusedTitle: W.formScreen.refused, lede: W.formScreen.lede, noQuestionsLine: W.formScreen.noQuestionsLine }} />
  );
}
