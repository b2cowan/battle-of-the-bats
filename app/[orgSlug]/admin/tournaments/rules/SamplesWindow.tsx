'use client';
/**
 * START FROM A SAMPLE — Tournament admin redesign Stage 5 (E6; hub v45, ruled as drawn 2026-10-10). Browse Samples
 * became the last row of Rules: a door to the same samples, now in the kit's window instead of a side drawer with its
 * own stylesheet. Each sample adds as today (a section with its points, or a placeholder link); one that fails says so
 * here, never in a browser alert. Your own rules are never touched.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { ClubRow, ClubRowList, RowAction } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { RULES_WORDS as W } from '@/lib/tournament-settings-words';
import { SAMPLE_RESOURCES, SAMPLE_RULE_SECTIONS, type SampleResource, type SampleSection } from './rules-samples';

const points = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

export default function SamplesWindow({ onAddSection, onAddResource, onClose }: {
  /** Adds the sample; throws when it couldn't. */
  onAddSection: (sample: SampleSection) => Promise<void>;
  onAddResource: (sample: SampleResource) => Promise<void>;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  async function add(key: string, run: () => Promise<void>) {
    if (adding) return;
    setAdding(key);
    setError('');
    try {
      await run();
      setAdded(a => new Set(a).add(key));
    } catch {
      setError(W.addFailed);
    } finally {
      setAdding(null);
    }
  }

  const action = (key: string, run: () => Promise<void>, name: string) => (
    <RowAction onClick={() => void add(key, run)} disabled={adding !== null || added.has(key)} aria-label={`${added.has(key) ? W.added : W.add} ${name}`}>
      {adding === key ? W.adding : added.has(key) ? W.added : W.add}
    </RowAction>
  );

  return (
    <KitDialog kind="form" title={W.samplesTitle} identity={W.samplesIdentity} onClose={() => { if (!adding) onClose(); }} busy={adding !== null}>
      <FormError>{error}</FormError>
      <RecordSection title={W.sampleSections}>
        <ClubRowList inset label={W.sampleSections}>
          {SAMPLE_RULE_SECTIONS.map((s, i) => (
            <ClubRow key={s.title} title={s.title} caption={`${points(s.items.length)} · ${s.items[0]}`}
              beside={action(`section-${i}`, () => onAddSection(s), s.title)} />
          ))}
        </ClubRowList>
      </RecordSection>
      <RecordSection title={W.sampleResources}>
        <p className={screenParts.recordText}>{W.sampleResourcesNote}</p>
        <ClubRowList inset label={W.sampleResources}>
          {SAMPLE_RESOURCES.map((r, i) => (
            <ClubRow key={r.label} title={r.label} beside={action(`resource-${i}`, () => onAddResource(r), r.label)} />
          ))}
        </ClubRowList>
      </RecordSection>
    </KitDialog>
  );
}
