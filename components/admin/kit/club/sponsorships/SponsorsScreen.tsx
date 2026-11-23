'use client';
/**
 * SPONSORSHIPS › SPONSORS — THE ONE SPONSOR LIST (Board Ready Stage 6, Part 1; round 1 tab 8, asks 1 and 11). Restyled
 * from the shipped list (a logo thumbnail, the name, a caption, the Ended chip, ended rows dimmed): each caption names
 * the places and the last day; a place a deal set wears "Deal". Two bands, Showing and Not showing. The list holds 100;
 * the home strip shows 20, and the foot says how many of them are used.
 */
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, ClubSection } from '../RepKit';
import { TabActions } from '../PlaceFrame';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { formatStoredDate } from '@/lib/timezone';
import { homePlacesShowing, lastDayOf, placeShowing, SPONSOR_LIST_MAX, sponsorHasDeal, sponsorShowing, type ClubSponsor } from '@/lib/club-sponsorships';
import { useSponsorships, type PlaceTargets } from './api';
import { placeName } from './places';
import SponsorWindow from './SponsorWindow';
import LoadingState from '@/components/shared/LoadingState';
import css from './Sponsorships.module.css';

const day = (d: string) => formatStoredDate(d, { withYear: true });

function Thumb({ s }: { s: ClubSponsor }) {
  return s.logoUrl
    ? <span className={css.thumb}><img src={s.logoUrl} alt="" /></span>
    : <span className={`${css.thumb} ${css.thumbNone}`}>{W.sponsors.noLogo}</span>;
}

function caption(s: ClubSponsor, t: PlaceTargets, today: string, showing: boolean) {
  if (s.places.length === 0) return W.sponsors.shownNowhere;
  if (!showing) {
    const last = lastDayOf(s);
    return last ? W.sponsors.lastDayWas(day(last)) : W.sponsors.shownNowhere;
  }
  const live = s.places.filter(p => placeShowing(p, today));
  const names = live.map(p => placeName(p, t)).join(' · ');
  const last = lastDayOf({ places: live });
  return <><span className={css.dot} aria-hidden />{names} · {last ? W.sponsors.until(day(last)) : W.sponsors.noLastDay}</>;
}

export default function SponsorsScreen() {
  const { slug, data, error, reload } = useSponsorships();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const today = data?.today ?? '';
  const { showing, notShowing } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.sponsors ?? []).filter(s => !q || s.name.toLowerCase().includes(q));
    return { showing: list.filter(s => sponsorShowing(s, today)), notShowing: list.filter(s => !sponsorShowing(s, today)) };
  }, [data, query, today]);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const atCap = data.sponsors.length >= SPONSOR_LIST_MAX;
  const row = (s: ClubSponsor, isShowing: boolean) => (
    <ClubRow key={s.id} as="button" aria-haspopup="dialog" onClick={() => setOpen(s.id)} chevron muted={!isShowing && s.places.length > 0}
      mark={<Thumb s={s} />} markWide title={s.name} caption={caption(s, data.targets, today, isShowing)}
      trail={!isShowing && s.places.length > 0 ? <span className={ck.chip}>{W.sponsors.endedChip}</span>
        : sponsorHasDeal(s) ? <span className={`${ck.chip} ${css.dealChip}`}>{W.sponsors.dealChip}</span> : undefined} />
  );
  const openSponsor = open && open !== 'new' ? data.sponsors.find(s => s.id === open) ?? null : null;

  return (
    <>
      <TabActions>
        <input className={`${ck.input} ${css.search}`} type="search" placeholder={W.sponsors.search} aria-label={W.sponsors.search}
          value={query} onChange={e => setQuery(e.target.value)} />
        <button type="button" className="btn btn-lime" disabled={atCap} onClick={() => setOpen('new')} aria-label={W.sponsors.add}>
          <span className={css.addWord}>+ {W.sponsors.add}</span>
          <span className={css.addSquare} aria-hidden><Plus size={18} /></span>
        </button>
      </TabActions>
      {data.sponsors.length === 0 ? (
        <ClubSection><p className={ck.hint}>{W.sponsors.empty}</p></ClubSection>
      ) : showing.length + notShowing.length === 0 ? (
        <ClubSection><p className={ck.hint}>{W.sponsors.noMatch}</p></ClubSection>
      ) : (
        <ClubRowFrame>
          {showing.length > 0 && (
            <ClubRowList inset label={W.sponsors.showing}>
              <ClubRowBand count={showing.length}>{W.sponsors.showing}</ClubRowBand>
              {showing.map(s => row(s, true))}
            </ClubRowList>
          )}
          {notShowing.length > 0 && (
            <ClubRowList inset label={W.sponsors.notShowing}>
              <ClubRowBand count={notShowing.length}>{W.sponsors.notShowing}</ClubRowBand>
              {notShowing.map(s => row(s, false))}
            </ClubRowList>
          )}
        </ClubRowFrame>
      )}
      <p className={css.note}>{W.sponsors.homeCount(homePlacesShowing(data.sponsors, today))}</p>
      {atCap && <p className={css.note}>{W.sponsors.atCap}</p>}
      {open === 'new' && <SponsorWindow slug={slug} sponsor={null} targets={data.targets} onChanged={() => void reload()} onClose={() => setOpen(null)} />}
      {openSponsor && <SponsorWindow key={openSponsor.id} slug={slug} sponsor={openSponsor} targets={data.targets} deals={data.sponsorDeals?.[openSponsor.id] ?? []} onChanged={() => void reload()} onClose={() => setOpen(null)} />}
    </>
  );
}
