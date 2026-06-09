'use client';

import { useSyncExternalStore } from 'react';

type Props = {
  value: string;
  fallback?: string;
};

function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function subscribeLocalDateTime() {
  return () => {};
}

export default function LocalDateTime({ value, fallback = 'Upcoming' }: Props) {
  const label = useSyncExternalStore(
    subscribeLocalDateTime,
    () => formatLocalDateTime(value) || fallback,
    () => fallback,
  );

  return (
    <time dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}
