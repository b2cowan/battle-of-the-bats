import { NextResponse } from 'next/server';

// 'enforced' = follow the plan_gating rows (dev's are all live, owner ruling 2026-10-30); 'live' = every plan open;
// 'closed' = "show as closed": League Plus, Club and Club · Association read closed, as on production before the flip,
// without touching dev's rows (on-sale pages S1). Read by getPlanGatingMap() in lib/plan-gating-server.ts.
const MODES = ['live', 'enforced', 'closed'] as const;

export async function POST(req: Request) {
  // Plan gates toggle is only enabled locally — not on Amplify dev
  if (process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const { mode }: { mode: string } = await req.json();
  if (!(MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: 'mode must be "live", "enforced" or "closed"' }, { status: 400 });
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
