'use client';
import SharedUnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';

/**
 * Coach edit-screen guard — the shared UnsavedChangesGuard, saying what the coach would lose.
 * ⚠ THE WORDS ARE THE CALLER'S, AND REQUIRED (/review, One Window 2d): this wrapper used to say "unsaved changes on
 * this player" for every screen that mounted it, practices, lineups, templates and events included. Name the thing.
 */
export default function UnsavedChangesGuard({ active, message }: { active: boolean; message: string }) {
  return <SharedUnsavedChangesGuard active={active} message={message} />;
}
