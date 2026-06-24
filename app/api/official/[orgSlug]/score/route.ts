import { withObservability } from '@/lib/observability';
import { getScore } from './get-score';

export const dynamic = 'force-dynamic';

// The score-fetching logic lives in ./get-score (a non-route module) so the scorekeeper
// route can reuse it without a route file exporting a non-handler symbol — which the
// webpack production build rejects as an invalid Route export.
export const GET = withObservability(getScore, { route: '/api/official/[orgSlug]/score' });
