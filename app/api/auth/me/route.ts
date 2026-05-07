import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';

export async function GET() {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  return NextResponse.json({ orgSlug: ctx.org.slug, role: ctx.role });
}
