import { useEffect, useState } from 'react';
import { SIZES, CHANNELS, CHANNELS_BY_TYPE, SALE_TYPES, saleTypeForChannel, todayStr, rupee, fmt, uid, saleGross, saleNet, applyCommission } from '../lib/calc';
import { addSale, updateSale, deleteSale, saveProduct, saveChannelCommission, addSettlement, deleteSettlementBySale } from '../lib/api';
import { useUI } from '../context/UIContext';

function downloadCsv(rows, filename) {
  const header = ['Date', 'Product', 'Size', 'Qty', 'Sale Type', 'Channel', 'Commission Type', 'Commission Value', 'Gross', 'Net'];
  const lines = [header.join(',')];
  rows.forEach((l) => {
    const cells = [l.date, l.product_name, l.size, l.qty, l.sale_type || saleTypeForChannel(l.channel) || '', l.channel, l.commission_type || '', l.commission_value ?? '', fmt(saleGross(l)) ?? '', fmt(saleNet(l)) ?? ''];
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
  const [typeFilter, setTypeFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [saleType, setSaleType] = useState('Online');
  const [channel, setChannel] = useState(CHANNELS_BY_TYPE.Online[0]);
  const [gross, setGross] = useState('');
  const [net, setNet] = useState('');
  const [commType, setCommType] = useState('None');
  const [commValue, setCommValue] = useState('');
  const [date, setDate] = useState(todayStr());

  const channelDefault = (ch) => (commissions || []).find((c) => c.channel === ch) || { channel: ch, type: 'None', value: null };

  const allMonths = Array.from(new Set(salesLog.map((l) => (l.date || '').slice(0, 7)))).filter(Boolean).sort().reverse();
  const q = search.toLowerCase();
  const filtered = salesLog.filter((l) => {
    if (monthFilter !== 'All' && (l.date || '').slice(0, 7) !== monthFilter) return false;
    if (typeFilter !== 'All' && (l.sale_type || saleTypeForChannel(l.channel)) !== typeFilter) return false;
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

  // When channel changes, load that channel's default commission into the per-sale boxes — still fully editable before you log it.
  function selectChannel(ch) {
    setChannel(ch);
    const def = channelDefault(ch);
    setCommType(def.type || 'None');
    setCommValue(def.value ?? '');
  }

  // Switching Online/Offline resets Channel to the first option in that group.
  function selectSaleType(type) {
    setSaleType(type);
    selectChannel(CHANNELS_BY_TYPE[type][0]);
  }

  // Net always follows Gross + this sale's own commission box — type/value here, not just the channel default.
  useEffect(() => {
    setNet(applyCommission(gross, { type: commType, value: commValue }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gross, commType, commValue]);

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const grossNum = gross === '' ? null : Number(gross);
    const netNum = net === '' ? null : Number(net);
    const entry = {
      id: uid('sale'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, channel, sale_type: saleType,
      commission_type: commType, commission_value: commValue === '' ? null : Number(commValue),
      gross_amount: grossNum,
      net_amount: netNum,
      price: gross === '' ? null : Number(gross) / q,
    };
    await addSale(entry);
    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);

    // Every sale gets a matching settlement row, tracked on the marketplace's own payment
    // cycle — cash channels are already "Settled", marketplaces start "Pending".
    const instantChannels = ['Our Store', 'Popup Sale'];
    const isInstant = instantChannels.includes(channel);
    await addSettlement({
      id: uid('settle'), sale_id: entry.id, date_logged: date,
      product_name: selectedProduct.name, size, channel,
      gross_amount: grossNum, commission_type: commType, commission_value: commValue === '' ? null : Number(commValue),
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

  async function updateChannelDefault(ch, field, value) {
    const current = channelDefault(ch);
    await saveChannelCommission({ ...current, [field]: value });
    toast(`${ch} default commission updated.`);
    reload();
  }

  // edit an existing sale's own commission box — recalculates and saves its Net immediately
  async function editSaleCommission(entry, field, value) {
    const updatedEntry = { ...entry, [field]: field === 'commission_value' ? (value === '' ? null : Number(value)) : value };
    const newNet = applyCommission(saleGross(updatedEntry) ?? '', { type: updatedEntry.commission_type, value: updatedEntry.commission_value });
    await updateSale({ ...updatedEntry, net_amount: newNet === '' ? null : Number(newNet) });
    toast('Commission updated, Net recalculated.');
    reload();
  }

  // still allow typing Gross or Net directly for a saved sale
  async function editSaleAmount(entry, field, value) {
    const num = value === '' ? null : Number(value);
    if (field === 'gross_amount') {
      const newNet = applyCommission(num ?? '', { type: entry.commission_type, value: entry.commission_value });
      await updateSale({ ...entry, gross_amount: num, net_amount: newNet === '' ? null : Number(newNet) });
    } else {
      await updateSale({ ...entry, [field]: num });
    }
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
        <p className="section-title">Default commission, per channel</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>
          This is just the starting point that fills in when you pick a channel below — every sale has its own commission box you can still change per order.
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Channel</th><th>Type</th><th>Value</th></tr></thead>
            <tbody>
              {CHANNELS.map((ch) => {
                const c = channelDefault(ch);
                return (
                  <tr key={ch}>
                    <td>{ch}</td>
                    <td>
                      <select key={`ct-${ch}-${c.type}`} defaultValue={c.type} onChange={(e) => updateChannelDefault(ch, 'type', e.target.value)} style={{ padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}>
                        <option value="None">None</option>
                        <option value="Percentage">Percentage</option>
                        <option value="Flat">Flat amount</option>
                      </select>
                    </td>
                    <td>
                      <input
                        key={`cv-${ch}-${c.value}`}
                        type="number" step="any" defaultValue={c.value ?? ''}
                        placeholder={c.type === 'Percentage' ? 'e.g. 40' : c.type === 'Flat' ? 'e.g. 336' : '—'}
                        disabled={c.type === 'None'}
                        onBlur={(e) => updateChannelDefault(ch, 'value', e.target.value === '' ? null : Number(e.target.value))}
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
        <div className={`pill ${typeFilter === 'All' ? 'active' : ''}`} onClick={() => setTypeFilter('All')}>All types</div>
        {SALE_TYPES.map((t) => (
          <div className={`pill ${typeFilter === t ? 'active' : ''}`} key={t} onClick={() => setTypeFilter(t)}>{t}</div>
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
            <select value={channel} onChange={(e) => selectChannel(e.target.value)}>
              {CHANNELS_BY_TYPE[saleType].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Gross sale (Rs.)</label>
            <input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div className="field">
            <label>Commission type</label>
            <select value={commType} onChange={(e) => setCommType(e.target.value)}>
              <option value="None">None</option>
              <option value="Percentage">Percentage off</option>
              <option value="Flat">Flat amount off</option>
            </select>
          </div>
          <div className="field">
            <label>Commission value{commType === 'Percentage' ? ' (%)' : commType === 'Flat' ? ' (Rs.)' : ''}</label>
            <input type="number" step="any" value={commValue} onChange={(e) => setCommValue(e.target.value)} disabled={commType === 'None'} />
          </div>
          <div className="field">
            <label>Net sale (Rs.) — calculated</label>
            <input type="number" step="any" value={net} onChange={(e) => setNet(e.target.value)} />
          </div>
        </div>
        <div className="mini-note">Net updates instantly from Gross and the commission box — you can still type over it directly if needed.</div>
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search by marketplace or product</label>
          <input className="search-input" placeholder="e.g. Myntra, Coyu, or a product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mini-note" style={{ marginBottom: 8 }}>
        Every sale has its own Commission box below — change the type or value and Net recalculates and saves right away. Gross and Net can also be typed over directly.
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Type</th><th>Channel</th><th>Commission</th><th>Gross</th><th>Net</th><th></th></tr></thead>
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
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select
                        key={`ct-${l.id}-${l.commission_type}`}
                        defaultValue={l.commission_type || 'None'}
                        onChange={(e) => editSaleCommission(l, 'commission_type', e.target.value)}
                        style={{ padding: '4px 4px', border: '1px solid var(--line)', borderRadius: 2, fontSize: 11 }}
                      >
                        <option value="None">None</option>
                        <option value="Percentage">%</option>
                        <option value="Flat">Flat</option>
                      </select>
                      <input
                        key={`cv-${l.id}-${l.commission_value}`}
                        type="number" step="any" defaultValue={l.commission_value ?? ''}
                        onBlur={(e) => editSaleCommission(l, 'commission_value', e.target.value)}
                        disabled={(l.commission_type || 'None') === 'None'}
                        style={{ width: 60, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      key={`gross-${l.id}-${l.gross_amount}`}
                      type="number" step="any" defaultValue={saleGross(l) ?? ''}
                      onBlur={(e) => editSaleAmount(l, 'gross_amount', e.target.value)}
                      style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <input
                      key={`net-${l.id}-${l.net_amount}`}
                      type="number" step="any" defaultValue={saleNet(l) ?? ''}
                      onBlur={(e) => editSaleAmount(l, 'net_amount', e.target.value)}
                      style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
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
                <td>{totalUnits}</td><td></td><td></td><td></td><td>{rupee(totalGross)}</td><td>{rupee(totalNet)}</td><td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
