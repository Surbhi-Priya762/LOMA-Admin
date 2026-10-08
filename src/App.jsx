import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider, useData } from './context/DataContext';
import { backupAll } from './lib/api';
import { todayStr } from './lib/calc';
import { navForRole, allowedRoutes, labelFor, readHash, hrefFor, COMBINED_OK } from './lib/nav';
import Login, { getRole, logout } from './components/Login';
import BrandGate from './components/BrandGate';
import QuickAdd from './components/QuickAdd';
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
import HomeTrials from './pages/HomeTrials';

// roles: 'admin' sees everything. 'viewer' sees only Home + Products, no editing, no pricing.
// 'ca' sees everything except Customer Details, Settlements, and the real Sales page —
// they get "Sales" too, but it routes to CASales (plain, no settlement info).

const BRAND_KEY = 'loma-brand';
const GROUPS_KEY = 'loma-nav-open';
const BRANDS = ['Loma', 'Sauca', 'Combined'];
const BRAND_LABEL = { Loma: 'Lõma', Sauca: 'Sauca', Combined: 'Both' };

function readStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// Scroll to a page's entry form, focus its first field and briefly highlight it.
function focusAddForm() {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById('add-form');
    if (!el) {
      if (tries++ < 20) setTimeout(tick, 60);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const fields = [...el.querySelectorAll('select, input, textarea')].filter((f) => !f.disabled);
    const first = fields.find((f) => f.type !== 'date' && !f.value) || fields[0];
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 250);
    el.classList.remove('flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('flash');
  };
  tick();
}

function Shell({ role, onLogout }) {
  const allowed = useMemo(() => allowedRoutes(role), [role]);
  const safeRoute = useCallback((r) => (allowed.includes(r) ? r : 'home'), [allowed]);

  const [route, setRouteState] = useState(() => safeRoute(readHash().route));
  const [brand, setBrandState] = useState(() => {
    const b = readStored(BRAND_KEY, 'Loma');
    return BRANDS.includes(b) ? b : 'Loma';
  });
  const [openGroups, setOpenGroups] = useState(() => readStored(GROUPS_KEY, { make: true, stock: true, people: true }));
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, error, reload } = useData();
  const { toast } = useUI();
  const [backingUp, setBackingUp] = useState(false);
  const isViewer = role === 'viewer';
  const isCA = role === 'ca';
  const nav = navForRole(role);

  // Keep the page in the address bar so refresh, back/forward and bookmarks work.
  useEffect(() => {
    function onHash() {
      const { route: r, add } = readHash();
      const next = safeRoute(r);
      setRouteState(next);
      setMenuOpen(false);
      if (add) {
        focusAddForm();
        window.history.replaceState(null, '', hrefFor(next));
      } else {
        window.scrollTo(0, 0);
      }
    }
    window.addEventListener('hashchange', onHash);
    if (readHash().add) onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, [safeRoute]);

  useEffect(() => {
    document.title = `${labelFor(route)} · Lõma Production Studio`;
  }, [route]);

  const setRoute = useCallback((r) => {
    window.location.hash = hrefFor(r);
  }, []);

  const setBrand = useCallback((b) => {
    setBrandState(b);
    writeStored(BRAND_KEY, b);
  }, []);

  function toggleGroup(id) {
    setOpenGroups((g) => {
      const next = { ...g, [id]: !g[id] };
      writeStored(GROUPS_KEY, next);
      return next;
    });
  }

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

  const needsBrand = !COMBINED_OK.includes(route) && brand === 'Combined';
  const p = { data, reload, brand, setBrand };

  const navLink = (item, nested = false) => (
    <a
      key={item.id}
      href={hrefFor(item.id)}
      className={`nav-item ${nested ? 'nested' : ''} ${route === item.id ? 'active' : ''}`}
      aria-current={route === item.id ? 'page' : undefined}
      onClick={() => setMenuOpen(false)}
    >
      {item.label}
    </a>
  );

  const bottomTabs = isViewer
    ? [{ id: 'home', label: 'Home' }, { id: 'products', label: 'Products' }]
    : [{ id: 'home', label: 'Home' }, { id: 'sales', label: 'Sales' }, { id: 'stock', label: 'Stock' }];

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <header className="mobile-bar">
        <button className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <span className="burger" aria-hidden="true" />
        </button>
        <div className="mobile-title">{labelFor(route)}</div>
        {!isViewer && <div className="mobile-brand">{BRAND_LABEL[brand]}</div>}
      </header>

      <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">L</div>
          <div>
            <div className="brand-title">Lõma</div>
            <div className="brand-sub">
              Production Studio{isViewer ? ' · View only' : isCA ? ' · CA access' : ''}
            </div>
          </div>
          <button className="icon-btn close-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
        </div>

        {!isViewer && (
          <div className="brand-switch" role="group" aria-label="Brand">
            {BRANDS.map((b) => (
              <button key={b} className={brand === b ? 'active' : ''} aria-pressed={brand === b} onClick={() => setBrand(b)}>
                {BRAND_LABEL[b]}
              </button>
            ))}
          </div>
        )}

        <div className="nav-list">
          {nav.map((n) =>
            n.type === 'item' ? (
              navLink(n)
            ) : (
              <div className="nav-group" key={n.id}>
                <button
                  className={`nav-group-head ${n.items.some((i) => i.id === route) ? 'has-active' : ''}`}
                  aria-expanded={!!openGroups[n.id]}
                  onClick={() => toggleGroup(n.id)}
                >
                  <span>{n.label}</span>
                  <span className={`chev ${openGroups[n.id] ? 'open' : ''}`} aria-hidden="true" />
                </button>
                {(openGroups[n.id] || n.items.some((i) => i.id === route)) && n.items.map((i) => navLink(i, true))}
              </div>
            )
          )}
        </div>

        <div className="nav-foot">
          {role === 'admin' && (
            <button className="nav-item small" onClick={handleBackup} disabled={backingUp}>
              {backingUp ? 'Backing up…' : 'Backup data'}
            </button>
          )}
          <button className="nav-item small" onClick={onLogout}>Log out</button>
        </div>
      </nav>

      <main className="main">
        {!data && !error && <div className="loading">Loading Lõma Production Studio…</div>}
        {error && (
          <div className="card" style={{ borderColor: 'var(--rust)' }}>
            <p className="section-title">Could not load data</p>
            <p style={{ fontSize: 13 }}>{error}</p>
            <p className="mini-note">
              Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly, and that every
              Supabase migration has been run.
            </p>
            <button className="btn secondary small" onClick={() => reload({ full: true })}>Try again</button>
          </div>
        )}
        {data && needsBrand && <BrandGate brand={brand} setBrand={setBrand} pageName={labelFor(route)} />}
        {data && !needsBrand && (
          <>
            {route === 'home' && <Home {...p} setRoute={setRoute} role={role} />}
            {route === 'products' && <Products {...p} role={role} />}
            {!isViewer && route === 'materials' && <RawMaterials {...p} />}
            {!isViewer && route === 'stock' && <Stock {...p} />}
            {!isViewer && route === 'production' && <ProductionLog {...p} />}
            {!isViewer && route === 'qualitycheck' && <QualityCheck {...p} />}
            {!isViewer && route === 'inward' && <Inward {...p} />}
            {!isViewer && route === 'outward' && <Outward {...p} />}
            {!isViewer && route === 'sales' && !isCA && <Sales {...p} />}
            {!isViewer && route === 'sales' && isCA && <CASales {...p} />}
            {role === 'admin' && route === 'settlements' && <Settlements {...p} />}
            {!isViewer && route === 'expenses' && <Expenses data={data} reload={reload} />}
            {!isViewer && route === 'store' && <StorePlanning {...p} />}
            {!isViewer && route === 'stockcheck' && <StockCheck {...p} />}
            {role === 'admin' && route === 'customers' && <CustomerDetails {...p} />}
            {role === 'admin' && route === 'hometrials' && <HomeTrials {...p} />}
          </>
        )}
      </main>

      {!isViewer && <QuickAdd role={role} />}

      <nav className="bottom-bar" aria-label="Quick navigation">
        {bottomTabs.map((t) => (
          <a key={t.id} href={hrefFor(t.id)} className={route === t.id ? 'active' : ''}>{t.label}</a>
        ))}
        <button onClick={() => setMenuOpen(true)}>Menu</button>
      </nav>
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
