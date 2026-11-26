import fp from '@/components/marketing/ForPage.module.css';
import inks from '@/components/marketing/SlideDrawings.module.css';
import SlideDrawing, { type DrawingId } from '@/components/marketing/SlideDrawings';

/**
 * THE ON-SALE PAGES' PICTURES — a drawing on each of /for-clubs' four cards and /for-leagues' four steps (S3b, W67).
 *
 * ⚖ Owner ruling 2026-11-21, which REPLACED the 2026-11-20 one ("A, the product's own screens"): the pictures are
 * "old way → answer" drawings in the pitch slides' house style, not screenshots. He was shown three options at true size
 * and made four calls (docs/projects/active/ON_SALE_CARD_DRAWINGS_MOCKUP.html): these drawings · a paper-coloured panel
 * with no outline · the "product's own screens" caption gone · no quarterly re-shoot. The drawings themselves, and the
 * rules they follow, live in `SlideDrawings.tsx`; this file only says which card gets which and what a screen reader hears.
 *
 * ⚠ THERE IS NO LINE UNDER THE CARDS, AND THAT IS DELIBERATE. The owner picked "Walk the real screens in the demo."
 * subject to the `/marketing` and `/legal` reads, and both found it untrue: the public demos were a tournament and a
 * coach's season, so no visitor could walk a house league or the club's books. Both public demos were retired
 * (owner ruling 2026-11-25), so there is no demo line to add here.
 *
 * A drawing quotes no figure, no name and no plan: the alt text below follows the same rule.
 */
export const ON_SALE_DRAWINGS = {
  'clubs-01-tournaments': { drawing: 'paper-bracket', alt: 'A paper bracket with one result missing becomes a live bracket that fills in as scores are entered.' },
  'clubs-02-house-league': { drawing: 'one-season', alt: 'A form, a spreadsheet and an unanswered message become one season: registration, draft, games and standings.' },
  'clubs-03-rep-teams': { drawing: 'every-team', alt: 'Messages asking each coach for a roster and for payment become one list of every team.' },
  'clubs-04-accounting': { drawing: 'one-ledger', alt: 'Three spreadsheets that do not agree become one ledger, checked against the bank statement.' },
  'leagues-01-registration': { drawing: 'registration-inbox', alt: 'A pile of forwarded emails becomes one list to approve, waitlist or decline from.' },
  'leagues-02-draft': { drawing: 'draft-list', alt: 'A marked-up printed list becomes three teams filling in, one pick at a time.' },
  'leagues-03-standings': { drawing: 'standings-by-hand', alt: 'A tally sheet and a calculator become standings that follow from each score entered.' },
  'leagues-04-notifications': { drawing: 'families-message', alt: 'A pasted address list and a reply-all chain become one message sent from one screen.' },
} as const satisfies Record<string, { drawing: DrawingId; alt: string }>;

export type OnSaleDrawingId = keyof typeof ON_SALE_DRAWINGS;

/** The paper panel (D2) holding one drawing, with the drawing's inks pointed at the warm page's own (`inks.onPaper`). */
export function OnSaleDrawing({ id }: { id: OnSaleDrawingId }) {
  const { drawing, alt } = ON_SALE_DRAWINGS[id];
  return (
    <div className={`${fp.drawing} ${inks.onPaper}`}>
      <SlideDrawing id={drawing} alt={alt} />
    </div>
  );
}
