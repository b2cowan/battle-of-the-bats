import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const gatingMap = await getPlanGatingMap();
  return Response.json(gatingMap);
}, { route: '/api/plan-gating' });
