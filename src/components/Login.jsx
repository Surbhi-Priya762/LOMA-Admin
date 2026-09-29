import { useState } from 'react';

const STORAGE_KEY = 'loma-auth-v2';
const ADMIN = { username: 'LOMA', password: 'LOMA2026@', role: 'admin' };
const VIEWER = { username: 'LOMAVIEW', password: 'View2026@', role: 'viewer' };
const CA = { username: 'LOMACA', password: 'CA2026@', role: 'ca' };

export function getRole() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function logout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function Login({ onSuccess }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const u = user.trim();
    let match = null;
    if (u === ADMIN.username && pass === ADMIN.password) match = ADMIN;
    else if (u === VIEWER.username && pass === VIEWER.password) match = VIEWER;
    else if (u === CA.username && pass === CA.password) match = CA;

    if (match) {
      try {
        localStorage.setItem(STORAGE_KEY, match.role);
      } catch {
        // ignore
      }
      setError('');
      onSuccess(match.role);
    } else {
      setError('Wrong username or password.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 16,
      }}
    >
      <form className="card" style={{ width: 360, maxWidth: '100%', padding: 24 }} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="brand-mark" style={{ background: 'var(--side)', color: '#e8efea' }} aria-hidden="true">L</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Lõma</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Production Studio</div>
          </div>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus autoCapitalize="characters" autoComplete="username" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <div style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button className="btn" type="submit" style={{ width: '100%' }}>Log in</button>
      </form>
    </div>
  );
}
