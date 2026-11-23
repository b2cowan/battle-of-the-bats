import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { removeWaitingDealFile } from '@/lib/club-form-deal';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/public/sponsorship/[token]/files/[fileId] — Remove (and Cancel after the file arrived) deletes a WAITING
 * file of this club's sponsorship form at once. A file already attached to the deal is changed by sending again, never
 * from here. Answers the same whether or not there was one: the door says nothing about anyone else's files.
 */
export const DELETE = withObservability(async (req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token, fileId } = await params;
  const at = await dealForLink(token);
  if ('failure' in at) return at.failure;
  try {
    await removeWaitingDealFile(at.org.id, fileId);
  } catch (e) {
    console.error('[sponsorship-link] removing a business file failed:', (e as { code?: string })?.code ?? 'no code');
    return NextResponse.json({ error: 'It didn’t remove. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/public/sponsorship/[token]/files/[fileId]' });
