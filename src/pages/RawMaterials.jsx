import { useState } from 'react';
import { CATS, materialUsedByProducts, todayStr, exportToExcel } from '../lib/calc';
import MaterialModal from './MaterialModal';

export default function RawMaterials({ data, reload, brand }) {
  const { products } = data;
  const [catFilter, setCatFilter] = useState('All');
  const [openId, setOpenId] = useState(undefined);

  const byBrand = brand === 'Combined' ? data.materials : data.materials.filter((m) => (m.brand || 'Loma') === brand);
  const list = catFilter === 'All' ? byBrand : byBrand.filter((m) => m.category === catFilter);
  const openMaterial = openId === undefined || openId === null ? null : data.materials.find((m) => m.id === openId);

  function handleExport() {
    exportToExcel(
      list,
      [
        { key: 'brand', label: 'Brand' },
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'unit', label: 'Unit' },
        { key: 'price', label: 'Price/unit' },
        { key: 'stock', label: 'In house' },
        { key: 'block', label: 'Block' },
        { key: 'reorder_level', label: 'Reorder level' },
        { key: (m) => materialUsedByProducts(m, products).length, label: 'Used in (products)' },
      ],
      `loma-raw-materials-${todayStr()}.csv`
    );
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Raw Materials {brand !== 'Combined' ? `— ${brand}` : ''}</h1>
          <div className="page-sub">{list.length} materials — fabric, button, thread, fusing, zip, hook, elastic &amp; lining, all in one place</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
          <button className="btn" onClick={() => setOpenId(null)}>+ Add raw material</button>
        </div>
      </div>

      <div className="tabs-row">
        <div className={`pill ${catFilter === 'All' ? 'active' : ''}`} onClick={() => setCatFilter('All')}>All</div>
        {CATS.map((c) => (
          <div className={`pill ${catFilter === c ? 'active' : ''}`} key={c} onClick={() => setCatFilter(c)}>{c}</div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">No materials in this category yet.</div>
      ) : (
        <div className="fab-grid">
          {list.map((m) => {
            const usedCount = materialUsedByProducts(m, products).length;
            return (
              <div className="fab-card" key={m.id} onClick={() => setOpenId(m.id)}>
                <div className="fab-img">{m.image ? <img src={m.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No photo'}</div>
                <div className="fab-body">
                  <div className="fab-name">{m.name}</div>
                  <div className="tag" style={{ marginBottom: 6 }}>{m.category}</div>
                  <div className="fab-meta"><span>{m.price != null ? `Rs.${m.price}/${m.unit}` : 'no price'}</span><span>In house: {m.stock ?? '—'}</span></div>
                  <div className="fab-meta"><span>Block: {m.block ?? '—'}</span><span /></div>
                  <div className="fab-used">Used in {usedCount} product{usedCount === 1 ? '' : 's'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openId !== undefined && (
        <MaterialModal
          material={openMaterial}
          products={products}
          defaultCategory={catFilter === 'All' ? 'Fabric' : catFilter}
          defaultBrand={brand === 'Combined' ? 'Loma' : brand}
          onClose={() => setOpenId(undefined)}
          onSaved={() => { setOpenId(undefined); reload(); }}
          onDeleted={() => { setOpenId(undefined); reload(); }}
        />
      )}
    </div>
  );
}
