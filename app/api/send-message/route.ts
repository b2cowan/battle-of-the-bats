import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { recipients, subject, message, tournamentName } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
    }

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    // Iterate through recipients and send emails
    // We send them sequentially to avoid hitting rate limits too fast (Resend free tier is 2 req/sec)
    // For larger volumes, a background job or Resend's batch API would be better.
    const results = { success: 0, failed: 0 };

    for (const email of recipients) {
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
  } catch (err: any) {
    console.error('Send message error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
