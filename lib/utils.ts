import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CloneCopiedCounts } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const content = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell);
      // Escape commas and quotes
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function formatPoolName(name: string): string {
  const bare = name
    .replace(/^Pool\s+/i, '')
    .replace(/\s+Pool$/i, '')
    .trim();
  return `${bare} Pool`;
}

export function copiedSummary(copied?: CloneCopiedCounts | null): string[] {
  if (!copied) return ['Setup copied with safe defaults.'];
  const rows = [
    copied.divisions ? `${copied.divisions} division${copied.divisions === 1 ? '' : 's'}` : '',
    copied.pools ? `${copied.pools} pool${copied.pools === 1 ? '' : 's'}` : '',
    copied.slots ? `${copied.slots} empty schedule slot${copied.slots === 1 ? '' : 's'}` : '',
    copied.venues ? `${copied.venues} venue${copied.venues === 1 ? '' : 's'}` : '',
    copied.registrationFields ? `${copied.registrationFields} registration question${copied.registrationFields === 1 ? '' : 's'}` : '',
    copied.rules ? `${copied.rules} rule section${copied.rules === 1 ? '' : 's'}` : '',
    copied.resources ? `${copied.resources} resource${copied.resources === 1 ? '' : 's'}` : '',
    copied.welcome ? 'Welcome content' : '',
  ].filter(Boolean) as string[];
  return rows.length ? rows : ['Draft created with safe tournament defaults.'];
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  // Handle formats like "18:00", "18:00:00", or "6:00 PM" (if already formatted)
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h}:${m} ${ampm}`;
}

/** "Today" / "Tomorrow" / short date (e.g. "Jul 16"), relative to a given
 *  YYYY-MM-DD reference date — the "next game" day label used across the
 *  fan-facing followed-team surfaces. */
export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
