'use client';

import { useRouter } from 'next/navigation';
import kit from '../console.module.css';

/**
 * The 24 hours / 7 days / 30 days view range, as a dropdown (rule D5: a one-of-several choice is never a
 * row of joined buttons). The page is a server component, so each option carries the href the old
 * segmented links went to (it keeps every applied filter and resets the page offset); choosing one
 * navigates there exactly as clicking the link did.
 */
export default function WindowSelect({
  value,
  options,
}: {
  value: string;
  options: { key: string; label: string; href: string }[];
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = options.find(o => o.key === e.target.value);
    if (next) router.push(next.href);
  }

  return (
    <select className={kit.select} aria-label="Time window" value={value} onChange={onChange}>
      {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}
