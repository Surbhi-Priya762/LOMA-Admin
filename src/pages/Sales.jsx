import { useEffect, useState } from 'react';
import { SIZES, CHANNELS, CHANNELS_BY_TYPE, SALE_TYPES, saleTypeForChannel, todayStr, rupee, fmt, uid, saleGross, saleNet, applyCommission, exportToExcel, filterByBrand, sizeStock, inDateRange, rangeForPreset, rangeLabel } from '../lib/calc';
import DateFilter from '../components/DateFilter';
import { applyOrderPackaging, addSale, updateSale, deleteSale, saveProduct, saveChannelCommission, addSettlement, deleteSettlementBySale, updateSettlement } from '../lib/api';
import { useUI } from '../context/UIContext';
import SalesEditModal from './SalesEditModal';
import PackedToggle from '../components/PackedToggle';
import { packagingReady, orderPackagingItems } from '../lib/packaging';

export default function Sales({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const products = filterByBrand(data.products, brand);
  const salesLog = filterByBrand(data.salesLog, brand);
  const settlements = filterByBrand(data.settlements, brand);
  // Channel commission defaults stay shared across both brands (like Expenses) —
  // the marketplace rate doesn't usually depend on which brand is selling.
  const { commissions } = data;
  const SETTLE_STATUSES = ['Pending', 'Invoice Sent', 'Partial', 'Settled', 'Cancelled'];
  const RETURN_STATUSES = ['None', 'Returned', 'Exchanged'];
  const settlementForSale = (saleId) => settlements.find((s) => s.sale_id === saleId);
  const isReturned = (l) => l.return_exchange === 'Returned';
  // Not counted in totals: returned sales, and sales whose settlement was cancelled
  // (order cancelled, or an exchange that isn't a new sale).
  const notCounted = (l) => isReturned(l) || settlementForSale(l.id)?.status === 'Cancelled';

  const [range, setRange] = useState(() => rangeForPreset('this-month'));
  const [typeFilter, setTypeFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [returnFilter, setReturnFilter] = useState('All');
  const [editId, setEditId] = useState(null);

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
  const [packed, setPacked] = useState(true);

  const channelDefault = (ch) => (commissions || []).find((c) => c.channel === ch) || { channel: ch, type: 'None', value: null };

  const allMonths = Array.from(new Set(salesLog.map((l) => (l.date || '').slice(0, 7)))).filter(Boolean).sort().reverse();
  const q = search.toLowerCase();
  const filtered = salesLog.filter((l) => {
    if (!inDateRange(l.date, range)) return false;
    if (typeFilter !== 'All' && (l.sale_type || saleTypeForChannel(l.channel)) !== typeFilter) return false;
    if (channelFilter !== 'All' && l.channel !== channelFilter) return false;
    if (returnFilter !== 'All' && (l.return_exchange || 'None') !== returnFilter) return false;
    if (q && !l.product_name.toLowerCase().includes(q) && !(l.channel || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Returned sales stay in the list but are left out of the totals — the money went back.
  const counted = filtered.filter((l) => !notCounted(l));
  const returnedRows = filtered.filter(notCounted);
  const totalGross = counted.reduce((a, l) => a + (saleGross(l) || 0), 0);
  const totalNet = counted.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const totalUnits = counted.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const returnedUnits = returnedRows.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const returnedNet = returnedRows.reduce((a, l) => a + (saleNet(l) || 0), 0);

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  function selectProduct(id) {
    setProductId(id);
    setSize('');
    const p = products.find((x) => x.id === id);
    if (p && p.selling_price != null) setGross(p.selling_price);
  }

  function selectChannel(ch) {
    setChannel(ch);
    const def = channelDefault(ch);
    setCommType(def.type || 'None');
    setCommValue(def.value ?? '');
  }

  function selectSaleType(type) {
    setSaleType(type);
    setPacked(type === 'Online');
    selectChannel(CHANNELS_BY_TYPE[type][0]);
  }

  useEffect(() => {
    setNet(applyCommission(gross, { type: commType, value: commValue }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gross, commType, commValue]);

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const stockAffected = saleType !== 'Onhand';
    if (stockAffected) {
      const available = sizeStock(selectedProduct, size);
      if (q > available) {
        const ok = await confirm(
          `Only ${available} in stock for ${selectedProduct.name} (${size}), but you're logging ${q}.\n\nSaving will take stock below zero (to ${available - q}). Save anyway?`,
          'Save anyway'
        );
        if (!ok) return;
      }
    }

    const grossNum = gross === '' ? null : Number(gross);
    const netNum = net === '' ? null : Number(net);
    const entry = {
      id: uid('sale'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, channel, sale_type: saleType,
      commission_type: commType, commission_value: commValue === '' ? null : Number(commValue),
      gross_amount: grossNum, net_amount: netNum,
      price: gross === '' ? null : Number(gross) / q,
      stock_affected: stockAffected,
      brand,
    };
    const usePackaging = packed && packagingReady(data) && orderPackagingItems(data, brand).length > 0;
    if (packagingReady(data)) entry.packaging_used = usePackaging;
    await addSale(entry);
    if (usePackaging) await applyOrderPackaging(brand, -1);

    if (stockAffected) {
      const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }

    const instantChannels = ['Our Store', 'Popup Sale'];
    const isInstant = instantChannels.includes(channel);
    await addSettlement({
      id: uid('settle'), sale_id: entry.id, date_logged: date,
      product_name: selectedProduct.name, size, qty: q, channel,
      gross_amount: grossNum, commission_type: commType, commission_value: commValue === '' ? null : Number(commValue),
      expected_amount: netNum, received_amount: isInstant ? netNum : null,
      status: isInstant ? 'Settled' : 'Pending',
      settlement_date: isInstant ? date : null, notes: '',
      stock_affected: stockAffected,
      brand,
    });

    toast(`${stockAffected ? 'Sale logged.' : 'Onhand sale logged — stock not affected.'}${usePackaging ? ' Packaging taken off.' : ''}`);
    setGross(''); setNet('');
    reload();
  }

  async function handleUndo(entry) {
    const stockAffected = entry.stock_affected !== false; // older rows without the flag default to true
    const ok = await confirm(
      `Undo this sale?\n\n${entry.qty} × ${entry.product_name} (${entry.size}) · ${entry.channel} · ${entry.date}\n\nThis deletes the sale and its settlement record${stockAffected ? ', and puts the stock back' : ''}.`,
      'Undo sale'
    );
    if (!ok) return;
    if (stockAffected) {
      const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
      if (p) {
        const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: (Number(s.stock) || 0) + Number(entry.qty) } : s)) };
        delete updated.updated_at;
        await saveProduct(updated);
      }
    }
    if (entry.packaging_used) await applyOrderPackaging(entry.brand || brand, 1);
    await deleteSettlementBySale(entry.id);
    await deleteSale(entry.id);
    toast(`${stockAffected ? 'Sale undone, stock restored.' : 'Onhand sale undone.'}${entry.packaging_used ? ' Packaging put back.' : ''}`);
    reload();
  }

  async function changeReturnStatus(sale, value) {
    await updateSale({ ...sale, return_exchange: value });
    const existing = settlementForSale(sale.id);
    if (value === 'Returned' && existing && existing.status !== 'Cancelled') {
      const ok = await confirm(
        `Also mark the settlement for this sale as Cancelled?\n\n${sale.product_name} (${sale.size}) · ${sale.channel} · ${sale.date}\n\nChoose this if the marketplace took the money back.`,
        'Cancel settlement'
      );
      if (ok) await updateSettlement({ ...existing, status: 'Cancelled', received_amount: 0, cancel_reason: existing.cancel_reason || `Returned (${sale.channel})` });
    }
    toast(value === 'Returned' ? 'Marked returned. Log the piece in Inward when it arrives.' : 'Updated.');
    reload();
  }

  async function changeSettlementStatus(sale, newStatus) {
    const existing = settlementForSale(sale.id);
    if (existing) {
      await updateSettlement({ ...existing, status: newStatus });
    } else {
      const instantChannels = ['Our Store', 'Popup Sale'];
      await addSettlement({
        id: uid('settle'), sale_id: sale.id, date_logged: sale.date,
        product_name: sale.product_name, size: sale.size, qty: sale.qty, channel: sale.channel,
        gross_amount: saleGross(sale), commission_type: sale.commission_type, commission_value: sale.commission_value,
        expected_amount: saleNet(sale), received_amount: null,
        status: newStatus, settlement_date: newStatus === 'Settled' ? todayStr() : null, notes: '',
        stock_affected: sale.stock_affected !== false,
        brand: sale.brand || brand,
      });
    }
    toast('Settlement status updated.');
    reload();
  }

  async function updateChannelDefault(ch, field, value) {
    const current = channelDefault(ch);
    await saveChannelCommission({ ...current, [field]: value });
    toast(`${ch} default commission updated.`);
    reload();
  }

  async function editSaleCommission(entry, field, value) {
    const updatedEntry = { ...entry, [field]: field === 'commission_value' ? (value === '' ? null : Number(value)) : value };
    const newNet = applyCommission(saleGross(updatedEntry) ?? '', { type: updatedEntry.commission_type, value: updatedEntry.commission_value });
    await updateSale({ ...updatedEntry, net_amount: newNet === '' ? null : Number(newNet) });
    toast('Commission updated, Net recalculated.');
    reload();
  }

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
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: (l) => l.sale_type || saleTypeForChannel(l.channel) || '', label: 'Type' },
        { key: 'channel', label: 'Channel' },
        { key: 'commission_type', label: 'Commission Type' },
        { key: 'commission_value', label: 'Commission Value' },
        { key: (l) => fmt(saleGross(l)) ?? '', label: 'Gross' },
        { key: (l) => fmt(saleNet(l)) ?? '', label: 'Net' },
        { key: (l) => (l.stock_affected === false ? 'No' : 'Yes'), label: 'Stock Affected' },
        { key: (l) => l.return_exchange || 'None', label: 'Return/Exchange' },
      ],
      `loma-sales-${rangeLabel(range)}.csv`
    );
    toast('Sales exported — opens directly in Excel.');
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Sales</h1>
          <div className="page-sub">Log a sale — Online/Offline deduct finished-goods stock, Onhand (Coyu portal) doesn't since that stock already left as bulk consignment</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card add-form" id="add-form" style={{ marginBottom: 20 }}>
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
              {sizeOptions.map((s) => <option value={s} key={s}>{selectedProduct ? `${s} — ${sizeStock(selectedProduct, s)} in stock` : s}</option>)}
            </select>
          </div>
          <div className="field"><label>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Sale Type</label>
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
        {saleType === 'Onhand' && (
          <div className="mini-note" style={{ marginBottom: 10, color: 'var(--brass)' }}>
            Onhand = Coyu's daily portal sale from stock already bulk-shipped earlier. This logs as revenue but will NOT deduct from your product stock.
          </div>
        )}
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
        <PackedToggle data={data} brand={brand} checked={packed} onChange={setPacked} />
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log sale</button>
      </div>

      <details className="card fold" style={{ marginBottom: 18 }}>
        <summary className="section-title">Default commission, per channel</summary>
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
      </details>

      <DateFilter value={range} onChange={setRange} months={allMonths} />
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

      <div className="tabs-row">
        {['All', 'None', 'Returned', 'Exchanged'].map((r) => (
          <div className={`pill ${returnFilter === r ? 'active' : ''}`} key={r} onClick={() => setReturnFilter(r)}>{r === 'All' ? 'All sales' : r === 'None' ? 'No return' : r}</div>
        ))}
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{totalUnits}</div><div className="stat-label">Units sold (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalGross)}</div><div className="stat-label">Gross sale (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalNet)}</div><div className="stat-label">Net sale, after commission (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{returnedUnits}</div><div className="stat-label">Returned or cancelled{returnedUnits ? ` · ${rupee(returnedNet)} not counted` : ''}</div></div>
      </div>

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search by marketplace or product</label>
          <input className="search-input" placeholder="e.g. Myntra, Coyu, or a product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mini-note" style={{ marginBottom: 8 }}>
        Every sale has its own Commission box below — change the type or value and Net recalculates and saves right away. Gross and Net can also be typed over directly. Use Edit to change Product/Size/Qty/Channel/Date.
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Type</th><th>Channel</th><th>Commission</th><th>Gross</th><th>Net</th><th>Settlement status</th><th>Return / Exchange</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={12} className="empty">No sales match your filters.</td></tr>
            ) : (
              sorted.map((l) => {
                const settlement = settlementForSale(l.id);
                const settleStatus = settlement ? settlement.status || 'Pending' : null;
                return (
                <tr key={l.id} className={notCounted(l) ? 'row-returned' : ''}>
                  <td>{l.date}</td><td>{l.product_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td>{l.sale_type || saleTypeForChannel(l.channel) || '—'}{l.stock_affected === false ? ' (no stock)' : ''}</td>
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
                  <td>
                    <select
                      key={`settle-${l.id}-${settleStatus}`}
                      defaultValue={settleStatus || 'Pending'}
                      onChange={(e) => changeSettlementStatus(l, e.target.value)}
                      className={`tag ${settleStatus === 'Settled' ? 'ready' : settleStatus === 'Partial' || settleStatus === 'Invoice Sent' ? 'progress' : settleStatus === 'Cancelled' ? 'reorder' : 'pending'}`}
                      style={{ border: '1px solid var(--line)' }}
                    >
                      {SETTLE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      key={`re-${l.id}-${l.return_exchange}`}
                      defaultValue={l.return_exchange || 'None'}
                      onChange={(e) => changeReturnStatus(l, e.target.value)}
                      className={`tag ${l.return_exchange === 'Returned' ? 'reorder' : l.return_exchange === 'Exchanged' ? 'progress' : 'ok'}`}
                      style={{ border: '1px solid var(--line)' }}
                    >
                      {RETURN_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary small" onClick={() => setEditId(l.id)}>Edit</button>
                      <button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({counted.length} sale{counted.length === 1 ? '' : 's'}{returnedRows.length ? `, ${returnedRows.length} returned/cancelled not counted` : ''})</td>
                <td>{totalUnits}</td><td></td><td></td><td></td><td>{rupee(totalGross)}</td><td>{rupee(totalNet)}</td><td></td><td></td><td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editId && (
        <SalesEditModal
          sale={sorted.find((l) => l.id === editId)}
          products={products}
          linkedSettlement={settlementForSale(editId)}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); reload(); }}
        />
      )}
    </div>
  );
}