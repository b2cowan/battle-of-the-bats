'use client';
/**
 * PUT ALL BACK (House League 9e-2, 9e·13): the one question and the one call, worn by the Rainout window's held result and
 * by the banner at the top of Changes to send. What each does after it lands is its own.
 */
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { RAIN_WORDS as W, type RainVerb } from '@/lib/league-rainout';

/** A held rainout's action (`back` = Put all back, `send` = Send the changes): the answer's body, or its refusal words. */
export async function rainoutAction<T>(api: string, orgQuery: string, rainoutId: string, action: 'back' | 'send'):
  Promise<{ ok: true; data: T } | { ok: false; status: number | null; error: string }> {
  const res = await fetch(`${api}/rainout/${rainoutId}${orgQuery}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (res?.ok && data) return { ok: true, data: data as T };
  return { ok: false, status: res?.status ?? null, error: (data as { error?: string } | null)?.error ?? W.backRefused };
}

/** "Put all 12 games back?" — over the window that asked it. */
export function PutBackQuestion({ games, verb, busy, onYes, onClose }: {
  games: number; verb: RainVerb; busy: boolean; onYes: () => void; onClose: () => void;
}) {
  return (
    <KitDialog kind="question" title={W.backTitle(games)} onClose={onClose} busy={busy}
      footer={(
        <>
          <DialogCancel>{W.backKeep(verb)}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy} onClick={onYes}>{W.back(games)}</button>
        </>
      )}>
      <p className={ck.hint}>{W.backBody}</p>
    </KitDialog>
  );
}
