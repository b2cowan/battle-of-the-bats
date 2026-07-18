'use client';
/**
 * components/public/UnfollowConfirmSheet.tsx
 * Shared "are you sure?" step before a follow is cleared — every unfollow
 * surface (My Team card star, Teams tab, game-day dock) renders this instead
 * of unfollowing on the first tap, so a mis-tap never silently drops a team.
 */
import BottomSheet from '@/components/admin/BottomSheet';
import styles from './UnfollowConfirmSheet.module.css';

interface Props {
  open: boolean;
  teamName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function UnfollowConfirmSheet({ open, teamName, onCancel, onConfirm }: Props) {
  return (
    <BottomSheet open={open} onClose={onCancel} title="Unfollow team?" ariaLabel={`Unfollow ${teamName}?`}>
      <div className={styles.wrap}>
        <p className={styles.message}>
          Stop following <strong>{teamName}</strong>? You&apos;ll lose their pinned score, schedule, and
          alerts here — you can follow them again anytime.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>Unfollow</button>
        </div>
      </div>
    </BottomSheet>
  );
}
