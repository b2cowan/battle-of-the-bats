import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Plan gates toggle is only enabled locally — not on Amplify dev
  if (process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const { mode }: { mode: string } = await req.json();
  if (mode !== 'live' && mode !== 'enforced') {
    return NextResponse.json({ error: 'mode must be "live" or "enforced"' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, mode });
  res.cookies.set('dev_plan_gates', mode, {
    path: '/',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  return res;
}
