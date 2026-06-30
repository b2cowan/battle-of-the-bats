'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import ReleaseDot from './ReleaseDot';
import styles from './whats-new.module.css';

/**
 * "What's New" affordance surfaced inside the Help center (the admin help hub and
 * the per-guide help pages). Opens the full release notes and carries the unread
 * dot until they've been viewed. This is the in-app home for release notes now
 * that the header sparkle is gone.
 */
export default function WhatsNewHelpLink({ className }: { className?: string }) {
  return (
    <Link
      href="/changelog"
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.helpLink}${className ? ` ${className}` : ''}`}
    >
      <Sparkles size={13} aria-hidden />
      What’s New
      <ReleaseDot />
    </Link>
  );
}
