import { useState } from 'react';
import { materialTotalIssued, fmt, rupee, todayStr, exportToExcel, filterByBrand } from '../lib/calc';
import { saveMaterial, saveProduct } from '../lib/api';

export default function Stock({ data, reload, brand }) {
  const materials = filterByBrand(data.materials, brand);
  const products = filterByBrand(data.products, brand);
  const productionLog = filterByBrand(data.productionLog, brand);
  const [tab, setTab] = useState('materials');
  const [search, setSearch] = useState('');

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Stock</h1>
          <div className="page-sub">Raw material stock and finished-goods stock, all in one place</div>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Search by product or material name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="tabs-row">
        <div className={`pill ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>Raw materials</div>
        <div className={`pill ${tab === 'finished' ? 'active' : ''}`} onClick={() => setTab('finished')}>Finished goods</div>
      </div>
      {tab === 'materials' ? (
        <MaterialStockTable materials={materials} products={products} productionLog={productionLog} search={search} reload={reload} />
      ) : (
        <FinishedStockTable products={products} search={search} reload={reload} />
      )}
    </div>
  );
}

function MaterialStockTable({ materials, products, productionLog, search, reload }) {
  const q = search.toLowerCase();
  const list = materials.filter((m) => !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));

  function handleExport() {
    exportToExcel(
      list,
      [
        { key: 'name', label: 'Material' },
        { key: 'category', label: 'Category' },
        { key: 'unit', label: 'Unit' },
        { key: 'price', label: 'Price/unit' },
        { key: 'stock', label: 'In house' },
        { key: (m) => fmt(materialTotalIssued(m, products, productionLog)) || 0, label: 'Used (Ready production)' },
        { key: (m) => { const used = materialTotalIssued(m, products, productionLog); return m.stock != null ? fmt(Number(m.stock) - used) : ''; }, label: 'Current stock' },
        { key: 'block', label: 'Block' },
      ],
      `loma-material-stock-${todayStr()}.csv`
    );
  }

  if (materials.length === 0) return <div className="empty">No materials yet — add them on the Raw Materials page.</div>;
  if (list.length === 0) return <div className="empty">No materials match your search.</div>;

  async function updateField(m, field, value) {
    await saveMaterial({ ...m, [field]: value === '' ? null : Number(value) });
    reload();
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th><th>Category</th><th>Unit</th><th>Price/unit</th><th>In house</th>
              <th>Used (Ready production)</th><th>Current stock</th><th>Status</th><th>Block (booked, not received)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const used = materialTotalIssued(m, products, productionLog);
              const current = m.stock != null ? Number(m.stock) - used : null;
              const low = current != null && m.reorder_level != null && current <= Number(m.reorder_level);
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.category}</td>
                  <td>{m.unit}</td>
                  <td>{m.price != null ? rupee(m.price) : '—'}</td>
                  <td>
                    <input type="number" step="any" defaultValue={m.stock ?? ''} style={{ width: 90, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      onBlur={(e) => updateField(m, 'stock', e.target.value)} />
                  </td>
                  <td>{fmt(used) || 0}</td>
                  <td>{current != null ? fmt(current) : '—'}</td>
                  <td>{low ? <span className="tag reorder">Reorder</span> : current != null ? <span className="tag ok">OK</span> : '—'}</td>
                  <td>
                    <input type="number" step="any" defaultValue={m.block ?? ''} style={{ width: 90, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      onBlur={(e) => updateField(m, 'block', e.target.value)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mini-note" style={{ marginTop: 8 }}>Block is informational only — it doesn't feed into Current stock or any other calculation.</div>
    </>
  );
}

function FinishedStockTable({ products, search, reload }) {
  const q = search.toLowerCase();
  const rows = [];
  products.forEach((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !(p.sku_prefix || '').toLowerCase().includes(q)) return;
    (p.sizes || []).forEach((s) => rows.push({ product: p, size: s.size, stock: s.stock }));
  });

  function handleExport() {
    exportToExcel(
      rows,
      [
        { key: (r) => r.product.name, label: 'Product' },
        { key: (r) => `${r.product.sku_prefix || '—'}-${r.size}`, label: 'SKU' },
        { key: 'size', label: 'Size' },
        { key: 'stock', label: 'Stock (pcs)' },
      ],
      `loma-finished-stock-${todayStr()}.csv`
    );
  }

  if (rows.length === 0) return <div className="empty">No products match your search.</div>;

  async function updateStock(product, size, value) {
    const updated = { ...product, sizes: product.sizes.map((s) => (s.size === size ? { ...s, stock: Number(value) || 0 } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);
    reload();
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Size</th><th>Stock (pcs)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.product.id}-${r.size}`}>
                <td>{r.product.name}</td>
                <td>{r.product.sku_prefix || '—'}-{r.size}</td>
                <td>{r.size}</td>
                <td>
                  <input type="number" defaultValue={r.stock ?? 0} style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    onBlur={(e) => updateStock(r.product, r.size, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
