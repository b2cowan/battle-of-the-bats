'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, LogIn } from 'lucide-react';
import { login } from '@/lib/auth';
import styles from './login.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    if (login(username, password)) {
      router.push('/admin');
    } else {
      setError('Invalid username or password.');
    }
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <Shield size={28} />
          </div>
          <h1 className={styles.title}>Admin Login</h1>
          <p className={styles.sub}>Battle of the Bats — Tournament Management</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className={styles.pwWrap}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowPw(s => !s)}
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading} id="login-submit">
            {loading ? 'Signing in…' : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
