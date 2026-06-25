'use client';
import { use } from 'react';
import { useCoaches } from '@/lib/coaches-context';
import CoachChatView from '@/components/chat/CoachChatView';
import styles from './chat.module.css';

export default function TeamChatPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { assignments, loading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);

  if (loading) {
    return <p style={{ padding: '1rem', color: 'var(--white-40)' }}>Loading…</p>;
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
