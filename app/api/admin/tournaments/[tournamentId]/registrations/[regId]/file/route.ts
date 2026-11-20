import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { canOpenModule } from '@/lib/member-access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { registrationFileKeyBelongs, registrationFileName } from '@/lib/registration-answers';

// ---------------------------------------------------------------------------
// A FILE A TEAM ATTACHED TO ITS REGISTRATION — opened from the team's record (Board Ready, the tournament registration
// questions F2; owner ruling 15, 2026-11-20).
//
// GET ?orgSlug=&fieldId=<question>  — sends the browser on to a ONE-HOUR signed link that downloads the file (the Privacy
//                                     Policy's "links that expire after one hour"). The storage key is never sent.
//
// WHO: exactly who reads the answers on the Teams list (`/api/admin/teams` GET) — a member who can open the tournaments
// area, inside their tournament scope, for a tournament of their own club. ⚠ That is wider than the registrations
// manager (F4, recorded for the tournaments' move onto the club form): when the answers' access narrows, this narrows
// with it — the two must never differ, or a file the record hides is still one link away.
// The bucket `tournament-registration-files` is private, read and written with the service role only. The key is read
// from our own answer row, never from the request, and must sit under this club's, tournament's and team's folder.
// ---------------------------------------------------------------------------

const BUCKET = 'tournament-registration-files';
const ONE_HOUR = 3600;

type RouteParams = { params: Promise<{ tournamentId: string; regId: string }> };

const notFound = () => NextResponse.json({ error: 'That file isn’t on this registration any more. Reload the page.' }, { status: 404 });

export const GET = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
    const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
    if (!ctx) return unauthorized();
    // The answers' own door (the Teams list's GET), so the file is never easier to reach than the answer that names it.
    if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();

    const { tournamentId, regId } = await params;
    const fieldId = req.nextUrl.searchParams.get('fieldId') ?? '';
    if (!isUuid(tournamentId) || !isUuid(regId) || !isUuid(fieldId)) return notFound();

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;
    const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
    if (wrongOrg) return wrongOrg;

    // The tenant wall (supabaseAdmin bypasses row security): the team and the question are both this tournament's.
    const [{ data: team, error: teamError }, { data: field, error: fieldError }, { data: answer, error: answerError }] = await Promise.all([
      supabaseAdmin.from('teams').select('id, tournament_id').eq('id', regId).maybeSingle(),
      supabaseAdmin.from('tournament_registration_fields').select('id, tournament_id').eq('id', fieldId).maybeSingle(),
      supabaseAdmin.from('tournament_registration_field_answers').select('file_url')
        .eq('registration_id', regId).eq('field_id', fieldId).maybeSingle(),
    ]);
    if (teamError) throw teamError;
    if (fieldError) throw fieldError;
    if (answerError) throw answerError;
    if (!team || team.tournament_id !== tournamentId) return notFound();
    if (!field || field.tournament_id !== tournamentId) return notFound();
    const key = (answer as { file_url: string | null } | null)?.file_url ?? '';
    if (!registrationFileKeyBelongs(key, ctx.org.id, tournamentId, regId)) return notFound();

    // `download`: storage serves it as `Content-Disposition: attachment` under its own name — a download, never a page that
    // renders — with the type the upload read from the bytes (F3). ⚠ Storage does NOT send `X-Content-Type-Options:
    // nosniff` and we cannot add a header to its response (probed on dev 2026-11-20); a header on THIS redirect would cover
    // nothing, so none is claimed. ⚖ Owner accepted that gap 2026-11-20 (BOARD_READY_PLAN.md ruling 15): a download is
    // never rendered as a page, and every new file's type is read from its bytes.
    const { data, error } = await supabaseAdmin.storage.from(BUCKET)
      .createSignedUrl(key, ONE_HOUR, { download: registrationFileName(key) });
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'The file couldn’t be opened just now. Try again.' }, { status: 502 });
    }
    const res = NextResponse.redirect(data.signedUrl, 302);
    // The signed address is a key to the file for an hour: never cached, never sent on as a referrer.
    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('Referrer-Policy', 'no-referrer');
    return res;
  } catch (err) {
    return captureAndJson(err, { error: 'The file couldn’t be opened just now. Try again.' }, 500);
  }
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/[regId]/file' });
