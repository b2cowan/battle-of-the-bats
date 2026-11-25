import { NextResponse } from 'next/server';
import { isPreviewRow } from './preview-org';
import { isPreviewOrgId } from './preview-org-server';

/**
 * lib/preview-write-refusal.ts — every public form is CLOSED on a preview club, on the server too (Club Website Track P,
 * Session P2; drawing tab 5, a safety rule with no ask). A preview holds no people (T3), and its sample is cleared the
 * moment it is claimed, so a board member's parent who scans the code must not be able to register a real child into it.
 *
 * Each public write route asks this the moment it knows the club, BEFORE it reads the request body: a crafted request
 * writes nothing and nothing it sent is logged. `tests/unit/preview-org-guard.test.ts` lists the routes and fails the
 * build when one stops asking.
 *
 * The page side (the "Registration isn't open on this preview" notice in place of each form) is
 * `components/public/PreviewClosedForm.tsx`; the words are `lib/preview-org.ts`.
 */

export const PREVIEW_WRITE_REFUSED = 'Registration isn’t open on this preview. Nothing was kept.';

function refused(): NextResponse {
  return NextResponse.json({ error: PREVIEW_WRITE_REFUSED, code: 'preview' }, { status: 403 });
}

/** The refusal for a club already read (its row or `Organization`), or null when it takes the write. */
export function previewWriteRefusal(org: { isPreview?: boolean | null; is_preview?: boolean | null } | null | undefined): NextResponse | null {
  if (!org) return null;
  return org.isPreview === true || isPreviewRow(org) ? refused() : null;
}

/**
 * The refusal for a club known only by id. FAILS CLOSED: when the marker cannot be read, the write is refused ("try
 * again"), because a write that lands in a preview is the one answer that cannot be taken back.
 */
export async function previewWriteRefusalById(orgId: string | null | undefined): Promise<NextResponse | null> {
  if (!orgId) return null;
  try {
    return (await isPreviewOrgId(orgId)) ? refused() : null;
  } catch {
    return NextResponse.json({ error: 'That didn’t go through. Try again in a moment.' }, { status: 503 });
  }
}
