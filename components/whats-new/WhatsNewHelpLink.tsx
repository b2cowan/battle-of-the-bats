'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import styles from './whats-new.module.css';

/**
 * "What's New" affordance surfaced inside the Help center (the admin help hub and
 * the per-guide help pages). Opens the full release notes. It carries no unread dot
 * (owner 2026-11-07): the account menu's What's new row and the Overview note are
 * the signals now, and only for releases the owner chose to announce.
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
      What’s new
    </Link>
  );
}
