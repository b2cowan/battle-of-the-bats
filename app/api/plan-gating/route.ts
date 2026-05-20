import { getPlanGatingMap } from '@/lib/plan-gating-server';

export async function GET() {
  const gatingMap = await getPlanGatingMap();
  return Response.json(gatingMap);
}
