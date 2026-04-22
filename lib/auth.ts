const AUTH_KEY = 'botb_admin_session';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'miltonbats2025';

export function login(username: string, password: string): boolean {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ loggedIn: true, ts: Date.now() }));
    }
    return true;
  }
  return false;
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    // Session expires after 8 hours
    const eightHours = 8 * 60 * 60 * 1000;
    return session.loggedIn === true && (Date.now() - session.ts) < eightHours;
  } catch {
    return false;
  }
}
