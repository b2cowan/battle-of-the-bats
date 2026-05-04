'use server';

import { updateGame } from '@/lib/db';

export async function finalizeGame(gameId: string, homeScore: number, awayScore: number): Promise<void> {
  await updateGame(gameId, { homeScore, awayScore, status: 'completed' });
}
