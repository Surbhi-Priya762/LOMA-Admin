import { useState } from 'react';
import { productTargetMRP, productProductionCost, productTotalStock, rupee } from '../lib/calc';
import ProductModal from './ProductModal';

export default function Products({ data, reload }) {
  const { products, materials, settings } = data;
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(undefined); // undefined = closed, null = new, id = edit

  const q = search.toLowerCase();
  const list = products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku_prefix || '').toLowerCase().includes(q));

  const openProduct = openId === undefined ? null : openId === null ? null : products.find((p) => p.id === openId);

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Products</h1>
          <div className="page-sub">{products.length} products — click any card to view or edit its full recipe &amp; costing</div>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Search products or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" onClick={() => setOpenId(null)}>+ Add product</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">No products match your search.</div>
      ) : (
        <div className="prod-grid">
          {list.map((p) => {
            const mrp = productTargetMRP(p, settings.daily_labour_budget);
            const missing = productProductionCost(p, settings.daily_labour_budget) == null;
            const stock = productTotalStock(p);
            return (
              <div className="prod-card" key={p.id} onClick={() => setOpenId(p.id)}>
                {p.image ? (
                  <img className="prod-img" src={p.image} alt={p.name} onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="prod-img placeholder">No image</div>
                )}
                <div className="prod-body">
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-sku">{p.sku_prefix || '—'}</div>
                  <div className="prod-price-row">
                    <span className="prod-mrp">{mrp != null ? rupee(mrp) : '—'}</span>
                    <span className={`prod-flag ${missing ? 'missing' : 'ready'}`}>{missing ? 'Incomplete' : 'Costed'}</span>
                  </div>
                  <div className="mini-note">Stock: {stock} pcs</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openId !== undefined && (
        <ProductModal
          product={openProduct}
          materials={materials}
          dailyBudget={settings.daily_labour_budget}
          onClose={() => setOpenId(undefined)}
          onSaved={() => { setOpenId(undefined); reload(); }}
          onDeleted={() => { setOpenId(undefined); reload(); }}
        />
      )}
    </div>
  );
}
