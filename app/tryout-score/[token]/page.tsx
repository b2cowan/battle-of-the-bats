'use client';
import { use } from 'react';
import TryoutScorerSurface from '@/components/rep-teams/TryoutScorerSurface';

/** The volunteer evaluator's door: the URL token is the only credential. The surface itself is
 *  shared with the coach's signed-in door (Chunk E, WI-1) — one scorer, two doors. */
export default function TryoutScorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <TryoutScorerSurface apiBase={`/api/tryout-score/${token}`} />;
}
