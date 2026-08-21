import { useState } from 'react';
import { productTargetMRP, productProductionCost, productTotalStock, rupee, todayStr, exportToExcel } from '../lib/calc';
import ProductModal from './ProductModal';
import ProductViewModal from './ProductViewModal';

export default function Products({ data, reload, role }) {
  const { products, materials, settings } = data;
  const isViewer = role === 'viewer';
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(undefined); // undefined = closed, null = new, id = edit

  const q = search.toLowerCase();
  const list = products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku_prefix || '').toLowerCase().includes(q));

  const openProduct = openId === undefined || openId === null ? null : products.find((p) => p.id === openId);

  function handleExport() {
    exportToExcel(
      list,
      [
        { key: 'name', label: 'Name' },
        { key: 'sku_prefix', label: 'SKU' },
        { key: 'type', label: 'Type' },
        { key: 'fabric_name', label: 'Fabric' },
        { key: (p) => { const mrp = productTargetMRP(p, settings.daily_labour_budget); return mrp != null ? mrp.toFixed(2) : ''; }, label: 'Target MRP' },
        { key: (p) => { const c = productProductionCost(p, settings.daily_labour_budget); return c != null ? c.toFixed(2) : ''; }, label: 'Production cost' },
        { key: (p) => productProductionCost(p, settings.daily_labour_budget) == null ? 'Incomplete' : 'Costed', label: 'Status' },
        { key: (p) => productTotalStock(p), label: 'Total stock' },
      ],
      `loma-products-${todayStr()}.csv`
    );
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Products</h1>
          <div className="page-sub">
            {products.length} products{isViewer ? '' : ' — click any card to view or edit its full recipe & costing'}
          </div>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Search products or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {!isViewer && <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>}
          {!isViewer && <button className="btn" onClick={() => setOpenId(null)}>+ Add product</button>}
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
                  {!isViewer && (
                    <div className="prod-price-row">
                      <span className="prod-mrp">{mrp != null ? rupee(mrp) : '—'}</span>
                      <span className={`prod-flag ${missing ? 'missing' : 'ready'}`}>{missing ? 'Incomplete' : 'Costed'}</span>
                    </div>
                  )}
                  <div className="mini-note">Stock: {stock} pcs</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openId !== undefined && isViewer && openProduct && (
        <ProductViewModal product={openProduct} onClose={() => setOpenId(undefined)} />
      )}

      {openId !== undefined && !isViewer && (
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
