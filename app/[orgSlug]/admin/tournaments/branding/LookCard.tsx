'use client';
/**
 * A TOURNAMENT'S LOOK CARD — the Branding page under the public pages' new frame (Public tournament pages Stage 1a Part 3;
 * the drawing's tab 3, ruled 2026-11-02 — every ask A). Theme, Font, Card style, Dark/Light and the Hero banner become this
 * one card: colours, type, and a preview of the real band.
 *
 *   A · a club's tournament, the default, nothing saved   "The club's look" chosen first; "Type: Serif, the club's"; the
 *                                                         follow line (its "Public site" a link for those who may open
 *                                                         the editor). The FieldLogicHQ swatch is NOT shown as chosen.
 *   B · the default, its own look                         the swatch double-ringed, the readability line, the three type
 *                                                         looks starting on the club's. The pill goes back: it writes the
 *                                                         theme and the type null.
 *   C · the club's *Always*                               a plain lock line; "Change the club's look" for those who may
 *                                                         edit it (absent, not greyed, for a coach); the preview.
 *   D · Tournament Plus                                   no pill; FieldLogicHQ chosen when nothing is saved, with the
 *                                                         plain-look line; the type looks (Classic when nothing saved).
 *   (E · free / Premium coach is the page's single lock line, not this card.)
 *
 * WHAT IS SHOWN comes from the ONE rule, lib/tournament-look.ts, applied to the draft — the same function the band
 * families see reads — so the preview and the card cannot disagree with the page. The card reports changes; the page
 * holds the draft and saves it (the theme and the type only once touched).
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import { LookPill, LookSwatches, LookTypeTiles } from '@/components/admin/kit/club/LookControls';
import PhoneWindow from '@/components/admin/kit/club/PhoneWindow';
import TournamentBand from '@/components/public/TournamentBand';
import clubFrameStyles from '@/components/public/ClubFrame.module.css';
import frameStyles from '@/components/public/TournamentFrame.module.css';
import { PRESETS, resolveTheme } from '@/lib/themes';
import { lookWords } from '@/lib/colour-words';
import { clubLookOf } from '@/lib/public-site-builder';
import { PUBLIC_SITE_WORDS as SITE_WORDS } from '@/lib/public-site-words';
import { PUBLIC_SITE_WORDS as W } from '@/lib/tournament-settings-words';
import { LOOK_PREVIEW_WORDS, PLAIN_LOOK_LINE, lookNounOf, tournamentLookCardWords } from '@/lib/tournament-look-words';
import { hasClubTournamentLook, resolveTournamentLook, type TournamentFace } from '@/lib/tournament-look';
import { publicFrameAttr, publicFrameBand, publicFrameRoleCss } from '@/lib/public-frame';
import { hasRoundRobin } from '@/lib/tournament-phase';
import { tournamentToday } from '@/lib/timezone';
import type { FrameTabContent } from '@/lib/tournament-page-tabs';
import { withInviteOnlyPages, type PublicPageKey } from '@/lib/public-pages';
import type { Organization, Tournament } from '@/lib/types';
import { lookOfDraft, type LookDraft } from './look-draft';
import css from './LookCard.module.css';


/** What the band reads from the event's records, sent by the Branding read (lib/public-frame-server.ts). */
export type LookBandFacts = { registrationOpen: boolean; frameContent: FrameTabContent };

const FONT_OF: Record<TournamentFace, string> = { warm: 'system', 'dm-serif': 'dm-serif', inter: 'inter' };

export default function LookCard({ org, tournament, draft: d, logoUrl, facts, inviteOnly, editorHref, mayChangeClubLook, onChange }: {
  org: Organization;
  tournament: Tournament;
  draft: LookDraft;
  /** The tournament's own logo, as the Logo card holds it now. */
  logoUrl: string | null;
  facts: LookBandFacts | null;
  inviteOnly: boolean;
  /** The club's Public site editor, for those who may open it; null for anyone else. */
  editorHref: string | null;
  /** May edit the club's look (the owner or an admin who may open the editor) — "Change the club's look". */
  mayChangeClubLook: boolean;
  onChange: (patch: Partial<LookDraft>, later?: boolean) => void;
}) {
  const pathname = usePathname() ?? '';
  // Custom's two pickers, opened to look before anything is chosen: nothing changes until a colour does.
  const [ownOpen, setOwnOpen] = useState(false);
  const [seed, setSeed] = useState({ primary: d.customPrimary, accent: d.customAccent });

  const clubLayer = hasClubTournamentLook(org);
  const words = tournamentLookCardWords(lookNounOf(org.planId));
  const custom = d.presetKey === 'custom';
  const ownCustom = d.own && custom;

  const asSaved = lookOfDraft(d, logoUrl);
  const look = resolveTournamentLook(org, asSaved);
  const always = look.policy === 'always_club';
  const font = FONT_OF[look.face];
  const colour = lookWords({ preset: look.preset, primary: look.primary, accent: look.accent, font });
  const typeName = SITE_WORDS.typeLooks[clubLookOf(font)];
  const follows = look.source === 'club';
  const colourName = d.own ? (custom ? W.custom : PRESETS[d.presetKey]?.name ?? W.custom) : PRESETS.platform.name;
  const meta = follows ? words.pill : `${colourName} · ${typeName}`;

  // The band as families will see it: the real component, from the draft (lib/public-frame.ts).
  const band = publicFrameBand(org, { ...tournament, ...asSaved }, tournamentToday(), facts?.registrationOpen ?? false);
  const withRegister = withInviteOnlyPages({ publicHiddenPages: d.publicHiddenPages }, inviteOnly).publicHiddenPages;
  const hiddenPages: PublicPageKey[] = hasRoundRobin(tournament) || withRegister.includes('standings')
    ? withRegister : [...withRegister, 'standings'];

  const club = resolveTheme(org.themePreset ?? null, org.themePrimary ?? null, org.themeAccent ?? null);
  const shownColours = resolveTheme(look.preset, look.primary, look.accent);
  const own = ownCustom ? { primary: d.customPrimary, accent: d.customAccent } : seed;

  const preview = (
    <div className={css.preview}>
      <h3 className={css.partTitle}>{LOOK_PREVIEW_WORDS.heading}</h3>
      <PhoneWindow title={LOOK_PREVIEW_WORDS.label}>
        <style dangerouslySetInnerHTML={{ __html: publicFrameRoleCss(band.roles) }} />
        {/* The live frame's own token element and marker (the admin preview layout's), so the band wears exactly its
            live rules. Inside the window, whose document is its own, the marker reaches nothing on this page. */}
        <div className={`${clubFrameStyles.tokens} ${frameStyles.frame}`} data-club-face={band.face} {...publicFrameAttr}>
          <TournamentBand
            orgSlug={org.slug}
            tournamentSlug={tournament.slug}
            name={tournament.name}
            logoUrl={band.logoUrl}
            initials={band.initials}
            dates={band.dates}
            status={band.status}
            hiddenPages={hiddenPages}
            hasBracket={false}
            frameContent={facts?.frameContent}
            // This page's own address: the band reads as on the Overview (its tab chosen). Its links go nowhere — the
            // window is inert.
            basePath={pathname}
          />
        </div>
      </PhoneWindow>
      <p className={css.line}>{LOOK_PREVIEW_WORDS.caption}</p>
    </div>
  );

  return (
    <CollapsibleCard title={W.look} sectionId="look" defaultOpen={false} meta={meta}>
      <div className={css.grid}>
        {always ? (
          <div className={css.controls}>
            <p className={css.lock}><Lock size={14} aria-hidden className={css.lockIcon} /><span>{words.lock}</span></p>
            {mayChangeClubLook && editorHref && <Link href={editorHref} className={css.door}>{words.change}</Link>}
          </div>
        ) : (
          <div className={css.controls}>
            <div className={css.part}>
              <h3 className={css.partTitle} id="t-look-colours">{words.coloursPart}</h3>
              <LookSwatches labelledBy="t-look-colours" idPrefix="t-look" hex
                before={clubLayer && (
                  <LookPill primary={club.primary} accent={club.accent} label={words.pill} on={follows}
                    onClick={() => { setOwnOpen(false); if (d.own || d.typeKey !== null) onChange({ own: false, typeKey: null }); }} />
                )}
                chosenPreset={d.own && !custom ? d.presetKey : look.source === 'plain' ? 'platform' : null}
                ownChosen={ownCustom}
                ownOpen={ownOpen || ownCustom}
                onPreset={key => { setOwnOpen(false); onChange({ own: true, presetKey: key }); }}
                onOwnToggle={() => {
                  if (ownCustom) return;
                  // Custom starts from the colours on show, so opening it to look changes nothing families see.
                  if (!ownOpen) setSeed({ primary: shownColours.primary.toUpperCase(), accent: shownColours.accent.toUpperCase() });
                  setOwnOpen(o => !o);
                }}
                own={own}
                onOwnChange={next => onChange({ own: true, presetKey: 'custom', customPrimary: next.primary, customAccent: next.accent }, true)} />
              {follows ? (
                <p className={css.line}>{words.typeLine.lead}<strong>{typeName}</strong>{words.typeLine.tail}</p>
              ) : look.source === 'plain' ? (
                <p className={css.line}>{PLAIN_LOOK_LINE}</p>
              ) : (
                <>
                  <p className={css.line}>{colour.readable}</p>
                  {colour.darkened && <p className={css.line}>{colour.darkened}</p>}
                </>
              )}
            </div>
            {!follows && (
              <div className={css.part}>
                <h3 className={css.partTitle} id="t-look-type">{words.typePart}</h3>
                <LookTypeTiles labelledBy="t-look-type" name={tournament.name} chosen={clubLookOf(font)}
                  onPick={l => { if (l.font !== d.typeKey) onChange({ typeKey: l.font }); }} />
              </div>
            )}
            {follows && (
              <p className={css.line}>
                {words.follow.lead}
                {editorHref ? <Link href={editorHref} className={css.inlineDoor}>{words.follow.door}</Link> : words.follow.door}
                {words.follow.tail}
              </p>
            )}
          </div>
        )}
        {preview}
      </div>
    </CollapsibleCard>
  );
}

