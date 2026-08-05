import { useEffect, useState } from 'react';
import { SIZES, CHANNELS, todayStr, rupee, uid, saleGross, saleNet } from '../lib/calc';
import { addSale, deleteSale, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

const COYU_KEEP_RATE = 0.6; // Coyu takes 40% commission, you keep 60%

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
  const [gross, setGross] = useState('');
  const [net, setNet] = useState('');
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
  const totalGross = filtered.reduce((a, l) => a + (saleGross(l) || 0), 0);
  const totalNet = filtered.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const totalUnits = filtered.reduce((a, l) => a + (Number(l.qty) || 0), 0);

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  function selectProduct(id) {
    setProductId(id);
    setSize('');
    const p = products.find((x) => x.id === id);
    if (p && p.selling_price != null) {
      setGross(p.selling_price);
    }
  }

  // Coyu: net auto-follows gross at a fixed 60% (40% commission). Other channels: you type both.
  useEffect(() => {
    if (channel === 'Coyu' && gross !== '') {
      setNet((Number(gross) * COYU_KEEP_RATE).toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, gross]);

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('sale'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, channel,
      gross_amount: gross === '' ? null : Number(gross),
      net_amount: net === '' ? null : Number(net),
      price: gross === '' ? null : Number(gross) / q, // keep legacy per-unit field populated too, for anything still reading it
    };
    await addSale(entry);
    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);
    toast('Sale logged.');
    setGross(''); setNet('');
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
          <div className="page-sub">Log a sale to deduct finished-goods stock and track Gross &amp; Net revenue by channel</div>
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
        <div className="stat-card"><div className="stat-num">{rupee(totalGross)}</div><div className="stat-label">Gross sale (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalNet)}</div><div className="stat-label">Net sale, after commission (filtered)</div></div>
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
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Gross sale (Rs.)</label>
            <input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div className="field">
            <label>Net sale (Rs.){channel === 'Coyu' ? ' — auto (60% after commission)' : ''}</label>
            <input type="number" step="any" value={net} onChange={(e) => setNet(e.target.value)} placeholder={channel === 'Myntra' ? 'from settlement, once known' : ''} />
          </div>
        </div>
        {channel === 'Myntra' && (
          <div className="mini-note">Myntra's actual payout varies per order — enter Net once you know it from the settlement report, or leave blank and fill in later.</div>
        )}
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search by marketplace or product</label>
          <input className="search-input" placeholder="e.g. Myntra, Coyu, or a product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Channel</th><th>Gross</th><th>Net</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="empty">No sales match your filters.</td></tr>
            ) : (
              sorted.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td><td>{l.product_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td>{l.channel}</td><td>{rupee(saleGross(l))}</td><td>{rupee(saleNet(l))}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({sorted.length} sale{sorted.length === 1 ? '' : 's'} shown)</td>
                <td>{totalUnits}</td><td></td><td>{rupee(totalGross)}</td><td>{rupee(totalNet)}</td><td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
