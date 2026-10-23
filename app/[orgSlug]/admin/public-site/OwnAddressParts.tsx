'use client';
/**
 * The small pieces of the Web address row (Club Tier Stage 4e, Part 3): a Copy button that says "Copied" for a moment,
 * and one record card (what it is for, Type / Name / Value with a Copy on each, why, and what we see).
 */
import type { ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { OWN_ADDRESS_WORDS as W } from '@/lib/own-address-screen-words';
import type { SightingChip } from '@/lib/own-address-view';
import s from './own-address.module.css';

/** A desk keeps the word; a phone shows the symbol alone with its own accessible name (the 2026-10-20 rule). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button type="button" className={`btn btn-outline btn-data ${s.copyButton}`} onClick={() => void copy(text)} aria-label={copied ? W.copied : label}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span className={s.copyWord}>{copied ? W.copied : W.copy}</span>
    </button>
  );
}

function Item({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className={s.recordItem}>
      <div className={s.recordItemText}>
        <span className={s.recordLabel}>{label}</span>
        <p className={s.recordValue}>{value}</p>
      </div>
      <CopyButton text={value} label={copyLabel} />
    </div>
  );
}

export function RecordCard({ n, title, record, chip, why, sees }: {
  n: 1 | 2;
  title: string;
  record: { type: string; name: string; value: string };
  chip: SightingChip;
  why: string;
  /** Amber line naming what www points at today, when it points elsewhere. */
  sees?: ReactNode;
}) {
  return (
    <section className={s.card} aria-label={`Record ${n}: ${title}`}>
      <div className={s.cardHead}>
        <span className={s.cardNumber} aria-hidden>{n}</span>
        <h3 className={s.cardTitle}>{title}</h3>
        <RepChip tone={chip.tone}>{chip.label}</RepChip>
      </div>
      <div className={s.recordGrid}>
        <div className={s.recordItemText}>
          <span className={s.recordLabel}>{W.typeLabel}</span>
          <p className={s.recordValue}>{record.type}</p>
        </div>
        <Item label={W.nameLabel} value={record.name} copyLabel={W.copyName(n)} />
        <Item label={W.valueLabel} value={record.value} copyLabel={W.copyValue(n)} />
      </div>
      <p className={s.why}>{why}</p>
      {sees && <p className={s.sees}>{sees}</p>}
    </section>
  );
}
