import { useState } from 'react';
import { UIProvider } from './context/UIContext';
import { DataProvider, useData } from './context/DataContext';
import Home from './pages/Home';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';
import Stock from './pages/Stock';
import ProductionLog from './pages/ProductionLog';
import Sales from './pages/Sales';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '◆' },
  { id: 'products', label: 'Products', icon: '●' },
  { id: 'materials', label: 'Raw Materials', icon: '▤' },
  { id: 'stock', label: 'Stock', icon: '☰' },
  { id: 'production', label: 'Production Log', icon: '✎' },
  { id: 'sales', label: 'Sales', icon: '₹' },
];

function Shell() {
  const [route, setRoute] = useState('home');
  const { data, error, reload } = useData();

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">Lõma</div>
            <div className="brand-sub">Production Studio</div>
          </div>
        </div>
        {NAV_ITEMS.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${route === n.id ? 'active' : ''}`}
            onClick={() => setRoute(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
      <div className="main">
        {!data && !error && <div className="loading">Loading Lõma Production Studio…</div>}
        {error && (
          <div className="card" style={{ borderColor: 'var(--rust)' }}>
            <p className="section-title">Could not load data</p>
            <p style={{ fontSize: 13 }}>{error}</p>
            <p className="mini-note">
              Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly, and that the
              Supabase schema has been created.
            </p>
          </div>
        )}
        {data && (
          <>
            {route === 'home' && <Home data={data} setRoute={setRoute} reload={reload} />}
            {route === 'products' && <Products data={data} reload={reload} />}
            {route === 'materials' && <RawMaterials data={data} reload={reload} />}
            {route === 'stock' && <Stock data={data} reload={reload} />}
            {route === 'production' && <ProductionLog data={data} reload={reload} />}
            {route === 'sales' && <Sales data={data} reload={reload} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </UIProvider>
  );
}
