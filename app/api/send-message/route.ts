import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'send_communications')) return forbidden();

  try {
    const { tournamentId, recipients, subject, message } = await req.json();

    if (!tournamentId || typeof tournamentId !== 'string') {
      return NextResponse.json({ error: 'Tournament is required' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .eq('organization_id', ctx.org.id)
      .single();
    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
    }

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const normalizedRecipients = Array.from(new Set(recipients.map(normalizeEmail).filter(Boolean)));
    if (normalizedRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients selected' }, { status: 400 });
    }

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('email')
      .eq('tournament_id', tournamentId);
    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 });
    }

    const allowedRecipients = new Set((contacts ?? []).map(contact => normalizeEmail(contact.email)).filter(Boolean));
    const unauthorizedRecipients = normalizedRecipients.filter(email => !allowedRecipients.has(email));
    if (unauthorizedRecipients.length > 0) {
      return NextResponse.json({ error: 'One or more recipients are not contacts for this tournament.' }, { status: 403 });
    }

    // Iterate through recipients and send emails
    // We send them sequentially to avoid hitting rate limits too fast (Resend free tier is 2 req/sec)
    // For larger volumes, a background job or Resend's batch API would be better.
    const results = { success: 0, failed: 0 };

    for (const email of normalizedRecipients) {
      try {
        await sendEmail(email, subject, message);
        results.success++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        results.failed++;
      }
    }

    return NextResponse.json({ 
      message: `Finished sending. Success: ${results.success}, Failed: ${results.failed}`,
      results
    });
  } catch (err: unknown) {
    console.error('Send message error:', err);
    const message = err instanceof Error ? err.message : 'Unable to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
