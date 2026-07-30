import { useState } from 'react';
import { SIZES, CHANNELS, todayStr, rupee, uid } from '../lib/calc';
import { addSale, deleteSale, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Sales({ data, reload }) {
  const { toast } = useUI();
  const { products, salesLog } = data;
  const [monthFilter, setMonthFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayStr());

  const allMonths = Array.from(new Set(salesLog.map((l) => (l.date || '').slice(0, 7)))).filter(Boolean).sort().reverse();
  const q = search.toLowerCase();
  const filtered = salesLog.filter((l) => {
    if (monthFilter !== 'All' && (l.date || '').slice(0, 7) !== monthFilter) return false;
    if (channelFilter !== 'All' && l.channel !== channelFilter) return false;
    if (q && !l.product_name.toLowerCase().includes(q) && !(l.channel || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalRevenue = filtered.reduce((a, l) => a + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
  const totalUnits = filtered.reduce((a, l) => a + (Number(l.qty) || 0), 0);

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  function selectProduct(id) {
    setProductId(id);
    setSize('');
    const p = products.find((x) => x.id === id);
    if (p && p.selling_price != null) setPrice(p.selling_price);
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('sale'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, channel, price: price === '' ? null : Number(price),
    };
    await addSale(entry);
    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);
    toast('Sale logged.');
    reload();
  }

  async function handleUndo(entry) {
    const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
    if (p) {
      const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: (Number(s.stock) || 0) + Number(entry.qty) } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }
    await deleteSale(entry.id);
    toast('Sale undone, stock restored.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Sales</h1>
          <div className="page-sub">Log a sale to deduct finished-goods stock and track revenue</div>
        </div>
      </div>

      <div className="tabs-row">
        <div className={`pill ${monthFilter === 'All' ? 'active' : ''}`} onClick={() => setMonthFilter('All')}>All months</div>
        {allMonths.map((m) => (
          <div className={`pill ${monthFilter === m ? 'active' : ''}`} key={m} onClick={() => setMonthFilter(m)}>{m}</div>
        ))}
      </div>
      <div className="tabs-row">
        <div className={`pill ${channelFilter === 'All' ? 'active' : ''}`} onClick={() => setChannelFilter('All')}>All channels</div>
        {CHANNELS.map((c) => (
          <div className={`pill ${channelFilter === c ? 'active' : ''}`} key={c} onClick={() => setChannelFilter(c)}>{c}</div>
        ))}
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{totalUnits}</div><div className="stat-label">Units sold (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalRevenue)}</div><div className="stat-label">Revenue (filtered)</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log a sale</p>
        <div className="field-row">
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => selectProduct(e.target.value)}>
              <option value="">Select…</option>
              {products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">—</option>
              {sizeOptions.map((s) => <option value={s} key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="field">
            <label>Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Price (Rs.)</label><input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <button className="btn" style={{ marginTop: 6 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search by marketplace or product</label>
          <input className="search-input" placeholder="e.g. Myntra, Coyu, or a product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Channel</th><th>Price</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="empty">No sales match your filters.</td></tr>
            ) : (
              sorted.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td><td>{l.product_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td>{l.channel}</td><td>{rupee(l.price)}</td><td>{rupee((Number(l.price) || 0) * (Number(l.qty) || 0))}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({sorted.length} sale{sorted.length === 1 ? '' : 's'} shown)</td>
                <td>{totalUnits}</td><td></td><td></td><td>{rupee(totalRevenue)}</td><td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
