'use client';
import SharedUnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';

/**
 * Coach edit-screen guard — the shared UnsavedChangesGuard with the coaches portal's player copy.
 * Thin wrapper so existing coach call sites (`<UnsavedChangesGuard active={isDirty} />`) are unchanged
 * while the reusable implementation lives in components/shared.
 */
export default function UnsavedChangesGuard({ active }: { active: boolean }) {
  return (
    <SharedUnsavedChangesGuard
      active={active}
      message="You have unsaved changes on this player. Leave without saving them?"
    />
  );
}
