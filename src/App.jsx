import { useState } from 'react';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider, useData } from './context/DataContext';
import { backupAll } from './lib/api';
import Login, { getRole, logout } from './components/Login';
import BrandGate from './components/BrandGate';
import Home from './pages/Home';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';
import Stock from './pages/Stock';
import ProductionLog from './pages/ProductionLog';
import QualityCheck from './pages/QualityCheck';
import Sales from './pages/Sales';
import Settlements from './pages/Settlements';
import Expenses from './pages/Expenses';
import Inward from './pages/Inward';
import Outward from './pages/Outward';
import StorePlanning from './pages/StorePlanning';
import StockCheck from './pages/StockCheck';
import CustomerDetails from './pages/CustomerDetails';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '◆' },
  { id: 'products', label: 'Products', icon: '●' },
  { id: 'materials', label: 'Raw Materials', icon: '▤', adminOnly: true },
  { id: 'stock', label: 'Stock', icon: '☰', adminOnly: true },
  { id: 'production', label: 'Production Log', icon: '✎', adminOnly: true },
  { id: 'qualitycheck', label: 'Quality Check', icon: '⚑', adminOnly: true },
  { id: 'inward', label: 'Inward / Returns', icon: '↩', adminOnly: true },
  { id: 'outward', label: 'Outward', icon: '↗', adminOnly: true },
  { id: 'sales', label: 'Sales', icon: '₹', adminOnly: true },
  { id: 'settlements', label: 'Settlements', icon: '⚖', adminOnly: true },
  { id: 'expenses', label: 'Expenses', icon: '§', adminOnly: true },
  { id: 'store', label: 'Store Planning', icon: '⬒', adminOnly: true },
  { id: 'stockcheck', label: 'Stock Check', icon: '✓', adminOnly: true },
  { id: 'customers', label: 'Customer Details', icon: '☺', adminOnly: true },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Shell({ role, onLogout }) {
  const [route, setRoute] = useState('home');
  const [brand, setBrand] = useState('Loma'); // 'Loma' | 'Sauca' | 'Combined'
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

        <div style={{ display: 'flex', gap: 4, padding: '0 4px 14px', borderBottom: '1px solid rgba(255,255,255,.15)', marginBottom: 12 }}>
          {['Loma', 'Sauca', 'Combined'].map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              style={{
                flex: 1, fontSize: 10.5, padding: '6px 4px', borderRadius: 2, border: 'none', cursor: 'pointer',
                fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '.02em', fontWeight: 600,
                background: brand === b ? 'var(--brass)' : 'rgba(255,255,255,.08)',
                color: brand === b ? '#26241e' : '#cbd5e1',
              }}
            >
              {b}
            </button>
          ))}
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
              Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly, and that every
              Supabase migration has been run.
            </p>
          </div>
        )}
        {data && (
          <>
            {route === 'home' && <Home data={data} setRoute={setRoute} reload={reload} role={role} brand={brand} setBrand={setBrand} />}
            {route === 'products' && (
              <BrandGate brand={brand}><Products data={data} reload={reload} role={role} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'materials' && (
              <BrandGate brand={brand}><RawMaterials data={data} reload={reload} brand={brand} /></BrandGate>
            )}

            {/* Everything below is single-brand-only — Combined isn't a valid view here,
                it's Home-only. BrandGate shows a nudge instead of mixing both brands. */}
            {!isViewer && route === 'stock' && (
              <BrandGate brand={brand}><Stock data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'production' && (
              <BrandGate brand={brand}><ProductionLog data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'qualitycheck' && (
              <BrandGate brand={brand}><QualityCheck data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'inward' && (
              <BrandGate brand={brand}><Inward data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'outward' && (
              <BrandGate brand={brand}><Outward data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'sales' && (
              <BrandGate brand={brand}><Sales data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'settlements' && (
              <BrandGate brand={brand}><Settlements data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'expenses' && <Expenses data={data} reload={reload} />}
            {!isViewer && route === 'store' && (
              <BrandGate brand={brand}><StorePlanning data={data} reload={reload} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'stockcheck' && (
              <BrandGate brand={brand}><StockCheck data={data} brand={brand} /></BrandGate>
            )}
            {!isViewer && route === 'customers' && (
              <BrandGate brand={brand}><CustomerDetails data={data} reload={reload} brand={brand} /></BrandGate>
            )}
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
