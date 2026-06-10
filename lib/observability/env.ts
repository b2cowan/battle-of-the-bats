/**
 * Observability environment signal.
 *
 * Canonical override is OBSERVABILITY_ENV ('production' | 'dev'); absent it, fall back to
 * NODE_ENV. Belt-and-suspenders: dev and prod errors are ALSO physically separated by Supabase
 * project (the dev Amplify branch points at the dev project, prod at the prod project), so the
 * env column is the secondary discriminator the dashboard defaults/filters on.
 *
 * On the prod Amplify branch set OBSERVABILITY_ENV=production so dyno errors are tagged correctly.
 */
export type ObservabilityEnv = 'production' | 'dev';

export function observabilityEnv(): ObservabilityEnv {
  const explicit = process.env.OBSERVABILITY_ENV?.toLowerCase();
  if (explicit === 'production' || explicit === 'prod') return 'production';
  if (explicit === 'dev' || explicit === 'development') return 'dev';
  return process.env.NODE_ENV === 'production' ? 'production' : 'dev';
}
