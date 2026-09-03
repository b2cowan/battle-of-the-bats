/**
 * ⚠⚠ THE SANDBOX SAYING NO IS THE DEMO WORKING, NOT BREAKING — and a money screen once showed a
 * prospect the raw code name (`/simplify`, 2026-09-02, found by actually pressing the control
 * rather than reading the diff). Both demo orgs refuse every write at the request layer, and the
 * coach sandbox is FULLY PUBLIC, so a prospect who files a club bill or corrects a cheque in the
 * demo always lands on a 403. Rendering the server's `error` field put the literal string
 * "SandboxReadOnly" on a marketing surface at the exact moment they had decided they wanted the
 * feature.
 *
 * The guard already ships the sentence that belongs there and marks its body `sandbox: true`;
 * this returns it so a caller can show it in its own voice rather than in red. The header is the
 * contract, the body flag is belt to braces. Hoisted from the Club panel (where it was born) when
 * the fundraising rooms gained the same write paths — one sentence, every money door.
 */
export function sandboxRefusal(res: Response, data: any): string | null {
  if (res.headers.get('X-Sandbox-Blocked') === '1' || (res.status === 403 && data?.sandbox)) {
    return data?.message ?? 'Nothing is saved here. To keep your changes, start your own team — it\'s free.';
  }
  return null;
}

/**
 * What a failed write should SAY: the sandbox's own sentence when the demo refused it, else the
 * server's error, else the caller's fallback. For the common shape `if (!res.ok) throw new
 * Error(writeFailure(res, data, '…'))` — so no door ever prints a code name.
 */
export function writeFailure(res: Response, data: any, fallback: string): string {
  return sandboxRefusal(res, data) ?? (typeof data?.error === 'string' && data.error ? data.error : fallback);
}
