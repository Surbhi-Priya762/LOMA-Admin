import { useState } from 'react';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider, useData } from './context/DataContext';
import { backupAll } from './lib/api';
import Login, { getRole, logout } from './components/Login';
import Home from './pages/Home';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';
import Stock from './pages/Stock';
import ProductionLog from './pages/ProductionLog';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import Inward from './pages/Inward';
import StorePlanning from './pages/StorePlanning';
import StockCheck from './pages/StockCheck';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '◆' },
  { id: 'products', label: 'Products', icon: '●' },
  { id: 'materials', label: 'Raw Materials', icon: '▤', adminOnly: true },
  { id: 'stock', label: 'Stock', icon: '☰', adminOnly: true },
  { id: 'production', label: 'Production Log', icon: '✎', adminOnly: true },
  { id: 'inward', label: 'Inward / Returns', icon: '↩', adminOnly: true },
  { id: 'sales', label: 'Sales', icon: '₹', adminOnly: true },
  { id: 'expenses', label: 'Expenses', icon: '§', adminOnly: true },
  { id: 'store', label: 'Store Planning', icon: '⬒', adminOnly: true },
  { id: 'stockcheck', label: 'Stock Check', icon: '✓', adminOnly: true },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Shell({ role, onLogout }) {
  const [route, setRoute] = useState('home');
  const { data, error, reload } = useData();
  const { toast } = useUI();
  const [backingUp, setBackingUp] = useState(false);
  const isViewer = role === 'viewer';
  const navItems = NAV_ITEMS.filter((n) => !n.adminOnly || !isViewer);

  async function handleBackup() {
    setBackingUp(true);
    try {
      const payload = await backupAll();
      const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loma-supabase-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Backup downloaded — keep this file safe.');
    } catch (e) {
      toast('Backup failed: ' + (e.message || String(e)));
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">Lõma</div>
            <div className="brand-sub">Production Studio {isViewer ? '· View only' : ''}</div>
          </div>
        </div>
        {navItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${route === n.id ? 'active' : ''}`}
            onClick={() => setRoute(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.15)' }}>
          {!isViewer && (
            <button className="nav-item" style={{ fontSize: 11 }} onClick={handleBackup} disabled={backingUp}>
              <span className="nav-icon">⬇</span>
              {backingUp ? 'Backing up…' : 'Backup data'}
            </button>
          )}
          <button className="nav-item" style={{ fontSize: 11 }} onClick={onLogout}>
            <span className="nav-icon">⏻</span>
            Log out
          </button>
        </div>
      </div>
      <div className="main">
        {!data && !error && <div className="loading">Loading Lõma Production Studio…</div>}
        {error && (
          <div className="card" style={{ borderColor: 'var(--rust)' }}>
            <p className="section-title">Could not load data</p>
            <p style={{ fontSize: 13 }}>{error}</p>
            <p className="mini-note">
              Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly, and that the
              Supabase schema (including migration 2) has been created.
            </p>
          </div>
        )}
        {data && (
          <>
            {route === 'home' && <Home data={data} setRoute={setRoute} reload={reload} role={role} />}
            {route === 'products' && <Products data={data} reload={reload} role={role} />}
            {!isViewer && route === 'materials' && <RawMaterials data={data} reload={reload} />}
            {!isViewer && route === 'stock' && <Stock data={data} reload={reload} />}
            {!isViewer && route === 'production' && <ProductionLog data={data} reload={reload} />}
            {!isViewer && route === 'inward' && <Inward data={data} reload={reload} />}
            {!isViewer && route === 'sales' && <Sales data={data} reload={reload} />}
            {!isViewer && route === 'expenses' && <Expenses data={data} reload={reload} />}
            {!isViewer && route === 'store' && <StorePlanning data={data} reload={reload} />}
            {!isViewer && route === 'stockcheck' && <StockCheck data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

function Gate() {
  const [role, setRole] = useState(getRole());
  if (!role) return <Login onSuccess={(r) => setRole(r)} />;
  return (
    <DataProvider>
      <Shell role={role} onLogout={() => { logout(); setRole(null); }} />
    </DataProvider>
  );
}

export default function App() {
  return (
    <UIProvider>
      <Gate />
    </UIProvider>
  );
}
