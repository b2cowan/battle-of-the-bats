'use client';

import { Fragment, type ReactNode } from 'react';
import type { NoteControl, ReportNote } from '@/lib/coach-money-report-notes';

/**
 * The screen half of a money report's footnotes — the files are the other half.
 *
 * `lib/coach-money-report-notes.ts` owns every sentence and every ruling about its wording; this
 * turns one of those into JSX. Splitting them that way is the whole point: the export layer reads
 * the same array, so a note cannot be changed on screen and left stale in the spreadsheet a board
 * receives (which is exactly what happened to this report three times before the sentences had one
 * home — see that module's header).
 *
 * ⚠ THE PER-NOTE CLASS COMES FROM THE CALLER, and that is not indecision. The Statement gives each
 * of its three notes a class of its own (`varianceKey`, `duesNote`, `undatedNote`) while the month
 * grid paints all of its with one — so a single class baked in here would have quietly restyled one
 * of the two screens on adoption.
 *
 * ⚠ A `control` RUN RENDERS THROUGH THE CALLER TOO, because the two screens draw them differently:
 * one is a `<button>` that flips a reading, another is a `<Link>` to the dues screen. Handing back
 * a `ReactNode` keeps that decision where the handler already lives, and keeps the notes module
 * pure. A control with no renderer supplied draws nothing — the sentence still reads, it simply
 * loses its door, which is the right failure for a bridge link.
 */
export default function ReportNotes({ notes, noteClassName, controls }: {
  notes: ReportNote[];
  /** The class this note's `<p>` wears. Given the note so a caller can vary it by `id`. */
  noteClassName: (note: ReportNote) => string;
  /** How to draw each bridge link this stack can contain. */
  controls?: Partial<Record<NoteControl, (text: string) => ReactNode>>;
}) {
  return (
    <>
      {notes.map(note => (
        <p key={note.id} className={noteClassName(note)}>
          <NoteText note={note} controls={controls} />
        </p>
      ))}
    </>
  );
}

/**
 * One note's runs, with no element of its own.
 *
 * Separate from the stack above because the ONE `alert` note is not a `<p>` in a list of notes: it
 * is a banded callout with an icon beside it, and it sits outside the notes block on both screens
 * that draw it. Same rendering either way, so the band cannot bold a different phrase from its
 * quieter neighbours.
 */
export function NoteText({ note, controls }: {
  note: ReportNote;
  controls?: Partial<Record<NoteControl, (text: string) => ReactNode>>;
}) {
  return (
    <>
      {note.segments.map((seg, i) => {
        if (seg.control) {
          const render = controls?.[seg.control];
          return render ? <Fragment key={i}>{render(seg.text)}</Fragment> : null;
        }
        /* `<strong>`, never `<b>` — one of these notes shipped with `<b>` and the two are a
           distinction without a difference on screen but not in an accessibility tree. */
        return seg.bold
          ? <strong key={i}>{seg.text}</strong>
          : <Fragment key={i}>{seg.text}</Fragment>;
      })}
    </>
  );
}
