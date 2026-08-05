import { useState } from 'react';

const STORAGE_KEY = 'loma-auth-v2';
const ADMIN = { username: 'LOMA', password: 'LOMA2026@', role: 'admin' };
const VIEWER = { username: 'LOMAVIEW', password: 'View2026@', role: 'viewer' };

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
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(38,36,30,.03) 0 1px, transparent 1px 44px)',
      }}
    >
      <form className="card" style={{ width: 340 }} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--indigo)' }} />
          <div>
            <div style={{ fontFamily: 'Oswald', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, fontSize: 15 }}>Lõma</div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '.04em' }}>Production Studio</div>
          </div>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        {error && <div style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button className="btn" type="submit" style={{ width: '100%' }}>Log in</button>
      </form>
    </div>
  );
}
