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
import QualityCheck from './pages/QualityCheck';
import Sales from './pages/Sales';
import CASales from './pages/CASales';
import Settlements from './pages/Settlements';
import Expenses from './pages/Expenses';
import Inward from './pages/Inward';
import Outward from './pages/Outward';
import StorePlanning from './pages/StorePlanning';
import StockCheck from './pages/StockCheck';
import CustomerDetails from './pages/CustomerDetails';

// roles: 'admin' sees everything. 'viewer' sees only Home + Products, no editing, no pricing.
// 'ca' sees everything except Customer Details, Settlements, and the real Sales page —
// they get "Sales" too, but it routes to CASales (plain, no settlement info).
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '◆', roles: ['admin', 'viewer', 'ca'] },
  { id: 'products', label: 'Products', icon: '●', roles: ['admin', 'viewer', 'ca'] },
  { id: 'materials', label: 'Raw Materials', icon: '▤', roles: ['admin', 'ca'] },
  { id: 'stock', label: 'Stock', icon: '☰', roles: ['admin', 'ca'] },
  { id: 'production', label: 'Production Log', icon: '✎', roles: ['admin', 'ca'] },
  { id: 'qualitycheck', label: 'Quality Check', icon: '⚑', roles: ['admin', 'ca'] },
  { id: 'inward', label: 'Inward / Returns', icon: '↩', roles: ['admin', 'ca'] },
  { id: 'outward', label: 'Outward', icon: '↗', roles: ['admin', 'ca'] },
  { id: 'sales', label: 'Sales', icon: '₹', roles: ['admin', 'ca'] },
  { id: 'settlements', label: 'Settlements', icon: '⚖', roles: ['admin'] },
  { id: 'expenses', label: 'Expenses', icon: '§', roles: ['admin', 'ca'] },
  { id: 'store', label: 'Store Planning', icon: '⬒', roles: ['admin', 'ca'] },
  { id: 'stockcheck', label: 'Stock Check', icon: '✓', roles: ['admin', 'ca'] },
  { id: 'customers', label: 'Customer Details', icon: '☺', roles: ['admin'] },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Shell({ role, onLogout }) {
  const [route, setRoute] = useState('home');
  const [brand, setBrand] = useState('Loma');
  const { data, error, reload } = useData();
  const { toast } = useUI();
  const [backingUp, setBackingUp] = useState(false);
  const isViewer = role === 'viewer';
  const isCA = role === 'ca';
  const navItems = NAV_ITEMS.filter((n) => n.roles.includes(role));

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
            <div className="brand-sub">
              Production Studio {isViewer ? '· View only' : isCA ? '· CA access' : ''}
            </div>
          </div>
        </div>

        {role !== 'viewer' && (
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
        )}

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
          {role === 'admin' && (
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
            {route === 'products' && <Products data={data} reload={reload} role={role} brand={brand} />}
            {!isViewer && route === 'materials' && <RawMaterials data={data} reload={reload} brand={brand} />}
            {!isViewer && route === 'stock' && <Stock data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'production' && <ProductionLog data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'qualitycheck' && <QualityCheck data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'inward' && <Inward data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'outward' && <Outward data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'sales' && !isCA && <Sales data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'sales' && isCA && <CASales data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {role === 'admin' && route === 'settlements' && <Settlements data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'expenses' && <Expenses data={data} reload={reload} />}
            {!isViewer && route === 'store' && <StorePlanning data={data} reload={reload} brand={brand} setBrand={setBrand} />}
            {!isViewer && route === 'stockcheck' && <StockCheck data={data} brand={brand} setBrand={setBrand} />}
            {role === 'admin' && route === 'customers' && <CustomerDetails data={data} reload={reload} brand={brand} setBrand={setBrand} />}
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
