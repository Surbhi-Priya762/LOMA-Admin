import { useState } from 'react';
import { SIZES, filterByBrand } from '../lib/calc';

// Preferred order for the categories you actually use — anything else found in
// the data (or left blank) just gets its own group appended after these.
const CATEGORY_ORDER = ['Top', 'Shirt', 'Culottes & Trousers', 'Dress', 'Co-ord Set'];

function categoryFor(product) {
  return (product.type || '').trim() || 'Uncategorised';
}

function groupByCategory(products) {
  const groups = {};
  products.forEach((p) => {
    const cat = categoryFor(p);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  const orderedNames = [
    ...CATEGORY_ORDER.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];
  return orderedNames.map((name) => ({ name, products: groups[name] }));
}

function downloadCsv(groups, minStock, filename) {
  const header = ['Category', 'Product', ...SIZES, 'Total to make'];
  const lines = [header.join(',')];
  groups.forEach(({ name, products }) => {
    lines.push([`"${name}"`, '', ...SIZES.map(() => ''), ''].join(','));
    products.forEach((p) => {
      let toMake = 0;
      const sizeCells = SIZES.map((s) => {
        const sz = (p.sizes || []).find((x) => x.size === s);
        const cur = sz ? Number(sz.stock) || 0 : 0;
        const short = minStock - cur;
        if (short > 0) toMake += short;
        return short > 0 ? `${cur} (need ${short})` : String(cur);
      });
      const cells = [`"${name}"`, `"${p.name}"`, ...sizeCells.map((c) => `"${c}"`), toMake];
      lines.push(cells.join(','));
    });
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StockCheck({ data, brand }) {
  const products = filterByBrand(data.products, brand);
  const [minStock, setMinStock] = useState(2);
  const [search, setSearch] = useState('');

  const min = Number(minStock) || 0;
  const q = search.toLowerCase();
  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku_prefix || '').toLowerCase().includes(q));
  const groups = groupByCategory(filtered);

  function stockFor(p, size) {
    const sz = (p.sizes || []).find((s) => s.size === size);
    return sz ? Number(sz.stock) || 0 : 0;
  }

  let totalToMake = 0;
  let sizesShort = 0;
  filtered.forEach((p) => {
    SIZES.forEach((s) => {
      const cur = stockFor(p, s);
      if (cur < min) { totalToMake += min - cur; sizesShort += 1; }
    });
  });

  function handleExport() {
    downloadCsv(groups, min, `loma-stock-check-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Stock Check</h1>
          <div className="page-sub">Every product by category, every size, and how many more to make to hit your minimum</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Minimum stock target</p>
        <div className="field-row" style={{ maxWidth: 220 }}>
          <div className="field">
            <label>Pieces per size (minimum)</label>
            <input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
        </div>
        <div className="mini-note">Any size below this number is flagged red, with how many more pieces are needed to reach it. The export follows the same category grouping shown below.</div>
      </div>

      <div className="field-row" style={{ marginBottom: 18 }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <input className="search-input" placeholder="Search products or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{sizesShort}</div><div className="stat-label">Size slots below minimum</div></div>
        <div className="stat-card"><div className="stat-num">{totalToMake}</div><div className="stat-label">Total pieces to make</div></div>
      </div>

      {groups.length === 0 ? (
        <div className="empty">No products match your search.</div>
      ) : (
        groups.map(({ name, products: groupProducts }) => (
          <div key={name} style={{ marginBottom: 24 }}>
            <p className="section-title">{name} <span className="mini-note" style={{ display: 'inline' }}>({groupProducts.length})</span></p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    {SIZES.map((s) => <th key={s}>{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {groupProducts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      {SIZES.map((s) => {
                        const cur = stockFor(p, s);
                        const short = min - cur;
                        return (
                          <td key={s}>
                            <div style={{ fontWeight: 600 }}>{cur}</div>
                            {short > 0 && <div style={{ color: 'var(--rust)', fontSize: 10.5, fontFamily: 'IBM Plex Mono' }}>need {short}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
