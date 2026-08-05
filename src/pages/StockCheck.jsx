import { useState } from 'react';
import { SIZES } from '../lib/calc';

export default function StockCheck({ data }) {
  const { products } = data;
  const [minStock, setMinStock] = useState(2);
  const [search, setSearch] = useState('');

  const min = Number(minStock) || 0;
  const q = search.toLowerCase();
  const list = products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku_prefix || '').toLowerCase().includes(q));

  function stockFor(p, size) {
    const sz = (p.sizes || []).find((s) => s.size === size);
    return sz ? Number(sz.stock) || 0 : 0;
  }

  let totalToMake = 0;
  let sizesShort = 0;
  list.forEach((p) => {
    SIZES.forEach((s) => {
      const cur = stockFor(p, s);
      if (cur < min) {
        totalToMake += min - cur;
        sizesShort += 1;
      }
    });
  });

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Stock Check</h1>
          <div className="page-sub">Every product, every size, at a glance — and exactly how many more to make to hit your minimum</div>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Search products or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <div className="mini-note">Any size below this number is flagged red, with how many more pieces are needed to reach it.</div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{sizesShort}</div><div className="stat-label">Size slots below minimum</div></div>
        <div className="stat-card"><div className="stat-num">{totalToMake}</div><div className="stat-label">Total pieces to make</div></div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              {SIZES.map((s) => <th key={s}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={SIZES.length + 1} className="empty">No products match your search.</td></tr>
            ) : (
              list.map((p) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
