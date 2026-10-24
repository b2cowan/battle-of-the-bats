/**
 * "How families see it" — the tryout blurb's preview, beside the "From the club" box (drawn and ruled 2026-10-22,
 * TRYOUT_BLURB_PREVIEW_MOCKUP.html). It is the PUBLIC tryout page itself (`TryoutLandingView`, preview form: no way back),
 * at a phone's width, wearing the club's own colours and face, fed the words as they are typed — before the autosave — and
 * the state the page really stands in. Nothing in it can be pressed.
 *
 * The state it draws is lib/tryout-blurb-preview.ts's. The tryout days and the club's contact line are left out on purpose (days are
 * entered in the tryout setup; the contact line is the club's, not its words).
 */
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import frameStyles from '@/components/public/ClubFrame.module.css';
import ck from './ClubKit.module.css';
import styles from './TryoutBlurbPreview.module.css';
import { previewNote } from '@/lib/tryout-blurb-preview';
import type { TryoutState } from '@/lib/tryout-season';

/** What the preview needs of the team and its season (the page hands it in; the state and the words are the editor's). */
export interface BlurbPreviewFacts {
  teamName: string;
  sport: string | null;
  season: { year: number | null; name: string };
  /** "born 2012–2013" (`bornFactsOf(…).meta`), or null when the season has none. */
  born: string | null;
  /** The club's chosen face (`clubFace`). */
  face: 'warm' | 'dm-serif' | 'inter';
}

export default function TryoutBlurbPreview({ state, text, teamName, sport, season, born, face }: BlurbPreviewFacts & {
  state: TryoutState;
  /** The box's words, as typed. */
  text: string;
}) {
  const note = previewNote(state, text);
  return (
    <div className={styles.pv}>
      <div className={styles.head}>
        <span className={ck.label}>How families see it</span>
        <span className={styles.live}>Updates as you type</span>
      </div>
      <div className={`${frameStyles.tokens} ${styles.frame}`} data-club-face={face} inert aria-hidden="true">
        <div className={styles.scaled}>
          <TryoutLandingView
            preview
            orgSlug=""
            teamSlug=""
            team={{ name: teamName, sport }}
            state={state}
            season={{ year: season.year, name: season.name, tryoutDescription: text }}
            born={born}
            upcoming={[]}
            lastDay={null}
            today=""
            contactEmail={null}
            registerHref="#"
          />
        </div>
      </div>
      {note && <p className={`${styles.note}${note.warn ? ` ${styles.noteWarn}` : ''}`}>{note.words}</p>}
    </div>
  );
}
