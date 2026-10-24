import { NextResponse } from 'next/server';
import { getPlatformAdminContext, type PlatformAuthContext } from './platform-auth';

/** A platform role alone never grants access to the proprietor's records. */
export function canAccessBookkeeping(auth: PlatformAuthContext): boolean {
  const email = auth.user.email?.trim().toLowerCase();
  if (!email) return false;
  const explicit = (process.env.BOOKKEEPING_OWNER_EMAILS ?? 'fieldlogichq@gmail.com')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return explicit.includes(email);
}

export async function requireBookkeepingApi() {
  const auth = await getPlatformAdminContext();
  if (!auth || !canAccessBookkeeping(auth)) {
    return { auth: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { auth, response: null };
}
