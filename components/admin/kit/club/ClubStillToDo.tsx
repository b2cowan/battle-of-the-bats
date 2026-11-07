'use client';
/**
 * STILL TO DO — the owner's setup steps on a club ADMIN's Overview (Club Tier Stage 13b, A2; Ask 11 = A; F-A1-4; hub tab 12).
 *
 * A club is set up by two people, and until now the admin's first Overview said "Nothing is waiting on you this morning" while the
 * owner worked a checklist only the owner could see. This is that checklist, READ-ONLY: the steps are the owner's (R-F-11: the
 * admin reads them, nothing here ticks or changes one), each open step is a door only where the admin can open its page, and
 * the block is gone once setup is done. The owner keeps their own "Setup: n of 5 · Continue setup" line; they never see this.
 * A step carries its ONE name, the setup page's own (`STEP_COPY`), so the same step is never called two things.
 */
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { kit } from '@/components/coaches/kit';
import { STEP_COPY, type SetupStepKey } from '@/lib/club-setup-words';
import ck from './ClubKit.module.css';
import styles from './ClubHub.module.css';

export type StillToDoChecklist = {
  doneCount: number; totalSteps: number; allDone: boolean;
  steps: { key: SetupStepKey; done: boolean; href: string }[];
};

export default function ClubStillToDo({ checklist, ownerName, canOpenStep }: {
  checklist: StillToDoChecklist;
  /** The owner by name, or null while it loads / when none has a name. */
  ownerName: string | null;
  /** Can this admin open the page a step's door goes to? A step they cannot open reads as text, not a door. */
  canOpenStep: (key: SetupStepKey) => boolean;
}) {
  if (checklist.allDone) return null;
  return (
    <section className={ck.section} aria-labelledby="hub-todo">
      <div className={ck.sectionHead}>
        <span id="hub-todo" className={kit.eye}>Still to do</span>
        <span className={ck.muted}>
          {ownerName ? `${ownerName} started this` : 'Setting up the club'} · {checklist.doneCount} of {checklist.totalSteps} done
        </span>
      </div>
      <ul className={styles.todo}>
        {checklist.steps.map(step => {
          const copy = STEP_COPY[step.key];
          const door = !step.done && canOpenStep(step.key);
          return (
            <li key={step.key} className={styles.todoStep} data-done={step.done ? 'true' : undefined}>
              {step.done ? <Check size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
              <span className={styles.todoTitle}>{copy.title}</span>
              {step.done
                ? <span className={ck.muted}>Done</span>
                : door
                  ? <Link href={step.href} className={ck.link}>{copy.button}</Link>
                  : <span className={ck.muted}>Ask the owner</span>}
            </li>
          );
        })}
      </ul>
      <p className={styles.todoHint}>The steps with a button are yours to do too.</p>
    </section>
  );
}
