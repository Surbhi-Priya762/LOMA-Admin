import { useState } from 'react';
import { SIZES, CHANNELS, CHANNELS_BY_TYPE, SALE_TYPES, saleTypeForChannel, todayStr, rupee, fmt, uid, saleGross, saleNet, exportToExcel } from '../lib/calc';
import { addSale, updateSale, deleteSale, saveProduct, addSettlement, deleteSettlementBySale } from '../lib/api';
import { useUI } from '../context/UIContext';
import BrandGate from '../components/BrandGate';

const RETURN_STATUSES = ['None', 'Returned', 'Exchanged'];

export default function CASales({ data, reload, brand, setBrand }) {
  const { toast } = useUI();
  const [monthFilter, setMonthFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [saleType, setSaleType] = useState('Online');
  const [channel, setChannel] = useState(CHANNELS_BY_TYPE.Online[0]);
  const [gross, setGross] = useState('');
  const [net, setNet] = useState('');
  const [date, setDate] = useState(todayStr());

  if (brand === 'Combined') return <BrandGate brand={brand} setBrand={setBrand} pageName="Sales" />;

  const products = data.products.filter((p) => (p.brand || 'Loma') === brand);
  const salesLog = data.salesLog.filter((l) => (l.brand || 'Loma') === brand);

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
    if (p && p.selling_price != null) { setGross(p.selling_price); setNet(p.selling_price); }
  }

  function selectSaleType(type) {
    setSaleType(type);
    setChannel(CHANNELS_BY_TYPE[type][0]);
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const grossNum = gross === '' ? null : Number(gross);
    const netNum = net === '' ? grossNum : Number(net);
    const entry = {
      id: uid('sale'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, channel, sale_type: saleType, brand,
      gross_amount: grossNum, net_amount: netNum,
      price: gross === '' ? null : Number(gross) / q,
      return_exchange: 'None',
    };
    await addSale(entry);
    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);

    // keeps this in sync with the main Sales/Settlements pages behind the scenes —
    // not shown here, but admin will see it correctly on Settlements.
    const instantChannels = ['Our Store', 'Popup Sale'];
    const isInstant = instantChannels.includes(channel);
    await addSettlement({
      id: uid('settle'), sale_id: entry.id, date_logged: date, brand,
      product_name: selectedProduct.name, size, qty: q, channel,
      gross_amount: grossNum, commission_type: null, commission_value: null,
      expected_amount: netNum, received_amount: isInstant ? netNum : null,
      status: isInstant ? 'Settled' : 'Pending',
      settlement_date: isInstant ? date : null, notes: '',
    });

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
    await deleteSettlementBySale(entry.id);
    await deleteSale(entry.id);
    toast('Sale undone, stock restored.');
    reload();
  }

  async function editField(entry, field, value) {
    const num = value === '' ? null : Number(value);
    await updateSale({ ...entry, [field]: num });
    reload();
  }

  async function editReturnStatus(entry, value) {
    await updateSale({ ...entry, return_exchange: value });
    toast('Updated.');
    reload();
  }

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: (l) => l.sale_type || saleTypeForChannel(l.channel) || '', label: 'Type' },
        { key: 'channel', label: 'Channel' },
        { key: (l) => fmt(saleGross(l)) ?? '', label: 'Gross' },
        { key: (l) => fmt(saleNet(l)) ?? '', label: 'Net' },
        { key: (l) => l.return_exchange || 'None', label: 'Return/Exchange' },
      ],
      `loma-ca-sales-${brand}-${todayStr()}.csv`
    );
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Sales — {brand}</h1>
          <div className="page-sub">Every sale, straightforward — no settlement details here, just what sold and any returns or exchanges</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
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
        <div className="stat-card"><div className="stat-num">{rupee(totalNet)}</div><div className="stat-label">Net sale (filtered)</div></div>
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
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Online or Offline</label>
            <select value={saleType} onChange={(e) => selectSaleType(e.target.value)}>
              {SALE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS_BY_TYPE[saleType].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Gross sale (Rs.)</label><input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} /></div>
          <div className="field"><label>Net sale (Rs.)</label><input type="number" step="any" value={net} onChange={(e) => setNet(e.target.value)} placeholder="defaults to Gross if left blank" /></div>
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <input className="search-input" placeholder="Search by product or channel…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Type</th><th>Channel</th><th>Gross</th><th>Net</th><th>Return/Exchange</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={10} className="empty">No sales match your filters.</td></tr>
            ) : (
              sorted.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td><td>{l.product_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td>{l.sale_type || saleTypeForChannel(l.channel) || '—'}</td>
                  <td>{l.channel}</td>
                  <td>
                    <input
                      key={`gross-${l.id}-${l.gross_amount}`}
                      type="number" step="any" defaultValue={saleGross(l) ?? ''}
                      onBlur={(e) => editField(l, 'gross_amount', e.target.value)}
                      style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <input
                      key={`net-${l.id}-${l.net_amount}`}
                      type="number" step="any" defaultValue={saleNet(l) ?? ''}
                      onBlur={(e) => editField(l, 'net_amount', e.target.value)}
                      style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <select
                      key={`re-${l.id}-${l.return_exchange}`}
                      defaultValue={l.return_exchange || 'None'}
                      onChange={(e) => editReturnStatus(l, e.target.value)}
                      className={`tag ${l.return_exchange === 'Returned' ? 'reorder' : l.return_exchange === 'Exchanged' ? 'progress' : 'ok'}`}
                      style={{ border: '1px solid var(--line)' }}
                    >
                      {RETURN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({sorted.length} sale{sorted.length === 1 ? '' : 's'} shown)</td>
                <td>{totalUnits}</td><td></td><td></td><td>{rupee(totalGross)}</td><td>{rupee(totalNet)}</td><td></td><td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
