import type { ScoreSubmissionSource } from './types';

export function scoreSubmissionSourceLabel(source?: ScoreSubmissionSource | null) {
  if (source === 'scorekeeper') return 'Scorekeeper';
  if (source === 'admin_results') return 'Results & Scoring';
  if (source === 'system') return 'System';
  return 'Unknown source';
}

export function formatScoreSubmittedAt(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function scoreSubmissionSummary({
  source,
  email,
  submittedAt,
}: {
  source?: ScoreSubmissionSource | null;
  email?: string | null;
  submittedAt?: string | null;
}) {
  const parts = [scoreSubmissionSourceLabel(source)];
  if (email) parts.push(email);
  const formattedAt = formatScoreSubmittedAt(submittedAt);
  if (formattedAt) parts.push(formattedAt);
  return parts.join(' - ');
}
