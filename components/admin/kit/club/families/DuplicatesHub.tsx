'use client';
/**
 * FAMILIES › DUPLICATES — two halves of one tab: records that may be one PARENT (Stage 5b) and records that may be one CHILD
 * (Stage 14 S6, Ask 11). The kit's ViewSwitch ("Parents · N | Children · N", the 6c rule: a switch for up to three views),
 * each half with its own count from the club brief. The tab's pill and the rail's Families row wear the SUM. The half with
 * something waiting opens first when the other has nothing.
 */
import { useState } from 'react';
import { ViewSwitch } from '@/components/coaches/kit';
import { useClubBrief } from '../ClubBriefProvider';
import { CHILD_JOIN_WORDS as W } from '@/lib/child-join-words';
import DuplicatesTab from './DuplicatesTab';
import ChildrenDuplicates from './ChildrenDuplicates';
import fam from './Families.module.css';

type View = 'parents' | 'children';

export default function DuplicatesHub() {
  const { brief } = useClubBrief();
  const parents = brief?.counts.familyDuplicates ?? 0;
  const children = brief?.counts.familyChildDuplicates ?? 0;
  const [picked, setPicked] = useState<View | null>(null);
  // The opening view is chosen ONCE, when the counts first arrive: resolving the last pair of one half must not flip the screen.
  const [opening, setOpening] = useState<View | null>(null);
  if (brief && opening === null) setOpening(parents === 0 && children > 0 ? 'children' : 'parents');
  const view: View = picked ?? opening ?? 'parents';

  return (
    <>
      <div className={fam.hubSwitch}>
        <ViewSwitch<View>
          label={W.switchLabel}
          value={view}
          onChange={setPicked}
          views={[{ id: 'parents', label: W.parents(parents) }, { id: 'children', label: W.children(children) }]}
        />
      </div>
      {view === 'parents' ? <DuplicatesTab /> : <ChildrenDuplicates />}
    </>
  );
}
