import { useEffect, useState } from 'react';
import { SIZES, CHANNELS, todayStr, rupee, fmt, uid, saleGross, saleNet } from '../lib/calc';
import { addSale, updateSale, deleteSale, saveProduct, saveChannelCommission } from '../lib/api';
import { useUI } from '../context/UIContext';

function computeNet(gross, commission) {
  if (gross === '' || gross == null) return '';
  const g = Number(gross);
  if (!commission || commission.type === 'None' || commission.value == null) return g.toFixed(2);
  if (commission.type === 'Percentage') return (g * (1 - Number(commission.value) / 100)).toFixed(2);
  if (commission.type === 'Flat') return (g - Number(commission.value)).toFixed(2);
  return g.toFixed(2);
}

function downloadCsv(rows, filename) {
  const header = ['Date', 'Product', 'Size', 'Qty', 'Channel', 'Gross', 'Net'];
  const lines = [header.join(',')];
  rows.forEach((l) => {
    const cells = [l.date, l.product_name, l.size, l.qty, l.channel, fmt(saleGross(l)) ?? '', fmt(saleNet(l)) ?? ''];
    lines.push(cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
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

export default function Sales({ data, reload }) {
  const { toast } = useUI();
  const { products, salesLog, commissions } = data;
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

  const commissionFor = (ch) => (commissions || []).find((c) => c.channel === ch) || { channel: ch, type: 'None', value: null };

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
    if (p && p.selling_price != null) setGross(p.selling_price);
  }

  useEffect(() => {
    setNet(computeNet(gross, commissionFor(channel)));
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
      price: gross === '' ? null : Number(gross) / q,
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

  async function updateCommission(ch, field, value) {
    const current = commissionFor(ch);
    await saveChannelCommission({ ...current, [field]: value });
    toast(`${ch} commission updated.`);
    reload();
  }

  // edit an existing, already-saved sale's Gross/Net directly — no delete-and-redo needed
  async function editSaleField(entry, field, value) {
    const num = value === '' ? null : Number(value);
    await updateSale({ ...entry, [field]: num });
    reload();
  }

  async function recalcNet(entry) {
    const g = saleGross(entry);
    const newNet = computeNet(g ?? '', commissionFor(entry.channel));
    await updateSale({ ...entry, net_amount: newNet === '' ? null : Number(newNet) });
    toast('Net recalculated from current commission settings.');
    reload();
  }

  function handleExport() {
    downloadCsv(sorted, `loma-sales-${todayStr()}.csv`);
    toast('Sales exported — opens directly in Excel.');
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Sales</h1>
          <div className="page-sub">Log a sale to deduct finished-goods stock and track Gross &amp; Net revenue by channel</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Commission settings, per channel</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>
          Net calculates automatically from Gross using these when you log a new sale. To fix an old sale, edit it directly in the table below instead.
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Channel</th><th>Type</th><th>Value</th></tr></thead>
            <tbody>
              {CHANNELS.map((ch) => {
                const c = commissionFor(ch);
                return (
                  <tr key={ch}>
                    <td>{ch}</td>
                    <td>
                      <select defaultValue={c.type} onChange={(e) => updateCommission(ch, 'type', e.target.value)} style={{ padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}>
                        <option value="None">None</option>
                        <option value="Percentage">Percentage</option>
                        <option value="Flat">Flat amount</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number" step="any" defaultValue={c.value ?? ''}
                        placeholder={c.type === 'Percentage' ? 'e.g. 40' : c.type === 'Flat' ? 'e.g. 336' : '—'}
                        disabled={c.type === 'None'}
                        onBlur={(e) => updateCommission(ch, 'value', e.target.value === '' ? null : Number(e.target.value))}
                        style={{ width: 100, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            <label>
              Net sale (Rs.) — after commission
              {commissionFor(channel).type === 'Percentage' && ` (auto: -${commissionFor(channel).value}%)`}
              {commissionFor(channel).type === 'Flat' && ` (auto: -Rs.${commissionFor(channel).value})`}
            </label>
            <input type="number" step="any" value={net} onChange={(e) => setNet(e.target.value)} />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search by marketplace or product</label>
          <input className="search-input" placeholder="e.g. Myntra, Coyu, or a product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mini-note" style={{ marginBottom: 8 }}>
        Gross and Net are editable directly in the table — click into either, type the real number, and click away to save. No need to delete and re-log a sale just to fix an amount.
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
                  <td>{l.channel}</td>
                  <td>
                    <input
                      type="number" step="any" defaultValue={saleGross(l) ?? ''}
                      onBlur={(e) => editSaleField(l, 'gross_amount', e.target.value)}
                      style={{ width: 90, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="any" defaultValue={saleNet(l) ?? ''}
                      onBlur={(e) => editSaleField(l, 'net_amount', e.target.value)}
                      style={{ width: 90, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary small" onClick={() => recalcNet(l)}>Recalc</button>
                    <button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button>
                  </td>
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
