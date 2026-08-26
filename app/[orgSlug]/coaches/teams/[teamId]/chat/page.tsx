'use client';
import { use } from 'react';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import CoachChatView from '@/components/chat/CoachChatView';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from './chat.module.css';

export default function TeamChatPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { assignments, closedAssignments, loading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);
  // M1 (2026-08-16): between seasons this coach is still on the team — the bare check told a
  // current member "you are not assigned", which was false. Chat stays a live-season instrument
  // (rooms ride the live staff assignment), so the in-between state gets the true sentence.
  const closed = resolveClosedAssignment(assignments, closedAssignments, params.teamId);

  if (loading) {
    return <CoachLoading label="Loading the room…" />;
  }
  if (!assignment && closed) {
    return (
      <p style={{ padding: '1rem', color: 'var(--white-40)' }}>
        The season has finished, so the team’s chat is closed for now. It reopens with the next season.
      </p>
    );
  }
  if (!assignment) {
    return <p style={{ padding: '1rem', color: 'var(--white-40)' }}>You are not assigned to this team.</p>;
  }

  // Full-screen chat — the conversation header carries the room name + room switcher, so the heavy
  // breadcrumb/header chrome is dropped here. The wrapper cancels the shared <main> padding + sets
  // the height vars this portal lacks (see chat.module.css) so the conversation truly fills the area.
  // `data-chat-fullbleed` locks the page scroll so the conversation owns the dynamic viewport and only
  // its message list scrolls — without it, the page body (min-height:100vh + the root <main>'s mobile
  // bottom gutter) can scroll and lift the composer off the bottom nav. NOT `data-chat-contained`: this
  // portal keeps its deliberate desktop full-bleed.
  return (
    <div className={styles.chatWrap} data-chat-fullbleed>
      <CoachChatView />
    </div>
  );
}
