'use client';
import { useRouter } from 'next/navigation';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import ConfirmButton from '../../_parts/ConfirmButton';

/** "Leave {child}'s team" — asks once in /legal draft (e)'s words (the page chose the first- or second-parent variant). */
export default function LeaveButton({ childId, childName, body }: { childId: string; childName: string; body: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label={W.manage.leave(childName)}
      title={W.leave.title(childName)}
      body={body}
      confirmLabel={W.leave.confirm}
      cancelLabel={W.leave.cancel}
      busyLabel={W.manage.leaving}
      failedText={W.manage.leaveFailed}
      onConfirm={async () => {
        const res = await fetch(`/api/family/children/${childId}/leave`, { method: 'POST' });
        if (!res.ok) return false;
        router.replace('/family');
        router.refresh();
        return true;
      }}
    />
  );
}
