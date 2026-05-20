import { NextResponse } from 'next/server';
import { getAuthDestination } from '@/lib/auth-destination';

export async function GET() {
  const destination = await getAuthDestination();
  return NextResponse.json({ destination });
}
