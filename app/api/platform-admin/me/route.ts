import { NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';

export async function GET() {
  const user = await getPlatformAuthContext();
  if (!user) return NextResponse.json({ isPlatformAdmin: false }, { status: 401 });
  return NextResponse.json({ isPlatformAdmin: true });
}
