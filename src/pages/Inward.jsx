import { useState, useRef, useEffect } from 'react';
import { SIZES, CHANNELS, todayStr, uid, exportToExcel, filterByBrand, matchScannedSku } from '../lib/calc';
import { addInward, deleteInward, saveProduct, saveInward, adjustSizeStock } from '../lib/api';
import { useUI } from '../context/UIContext';

const SOURCES = [...CHANNELS, 'Customer', 'Vendor'];

export default function Inward({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const products = filterByBrand(data.products, brand);
  const inward = filterByBrand(data.inward, brand);
  const [date, setDate] = useState(todayStr());
  const [source, setSource] = useState(SOURCES[0]);
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [search, setSearch] = useState('');
  const scanEntries = useRef({}); // inward entries built by barcode scans this session

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  const q = search.toLowerCase();
  const filtered = inward.filter((i) => !q || (i.product_name || '').toLowerCase().includes(q) || (i.source || '').toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'source', label: 'From' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: 'remarks', label: 'Remarks' },
      ],
      `loma-inward-${todayStr()}.csv`
    );
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const qn = Number(qty) || 0;
    if (qn <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('inw'), date, source, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: qn, remarks: remarks.trim(),
      brand,
    };
    await addInward(entry);

    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) + qn } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);

    toast(`Restocked ${qn} × ${selectedProduct.name} (${size}) from ${source}.`);
    setRemarks('');
    reload();
  }

  async function handleUndo(entry) {
    const ok = await confirm(
      `Undo this inward entry?\n\n${entry.qty} × ${entry.product_name} (${entry.size}) from ${entry.source} · ${entry.date}\n\nThis takes the pieces back out of stock.`,
      'Undo entry'
    );
    if (!ok) return;
    const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
    if (p) {
      const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) - Number(entry.qty)) } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }
    await deleteInward(entry.id);
    Object.keys(scanEntries.current).forEach((k) => { if (scanEntries.current[k].id === entry.id) delete scanEntries.current[k]; });
    toast('Entry undone, stock adjusted back.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Inward / Returns</h1>
          <div className="page-sub">Log anything coming back — a return, an exchange, stock received — and it adds to finished-goods stock automatically</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <ScanBox
        allProducts={data.products}
        entries={scanEntries}
        brand={brand}
        date={date} setDate={setDate}
        source={source} setSource={setSource}
        reload={reload}
      />

      <div className="card add-form" id="add-form" style={{ marginBottom: 20 }}>
        <p className="section-title">Or log an inward entry by hand</p>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <label>From where</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setSize(''); }}>
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
        </div>
        <div className="field">
          <label>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Customer return, size exchange, wrong item sent back" />
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log inward &amp; restock</button>
      </div>

      <input className="search-input" placeholder="Search by product or source…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>From</th><th>Product</th><th>Size</th><th>Qty</th><th>Remarks</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="empty">No inward entries yet.</td></tr>
            ) : (
              sorted.map((i) => (
                <tr key={i.id}>
                  <td>{i.date}</td><td>{i.source}</td><td>{i.product_name}</td><td>{i.size}</td><td>{i.qty}</td><td>{i.remarks}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(i)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Short beep so you know a scan landed without looking at the screen.
function beep(ok) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1200 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.35));
    osc.onended = () => ctx.close();
  } catch { /* sound is optional */ }
}

function ScanBox({ allProducts, entries, brand, date, setDate, source, setSource, reload }) {
  const [code, setCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState([]); // this scanning session, newest first
  const [last, setLast] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(0);
  const inputRef = useRef(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleScan(raw) {
    const text = raw.trim();
    if (!text) return;
    setCode('');
    const match = matchScannedSku(text, allProducts);
    if (match.error) {
      beep(false);
      setLast({ ok: false, text: match.error });
      return;
    }
    const { product, size } = match;
    const productBrand = product.brand || 'Loma';
    if (productBrand !== brand) {
      beep(false);
      setLast({ ok: false, text: `${product.name} is a ${productBrand} product — switch to ${productBrand} to scan it in.` });
      return;
    }
    // Snapshot the settings at scan time, then process scans one after another.
    const snap = { date, source, remarks: remarks.trim() };
    setBusy((b) => b + 1);
    queue.current = queue.current.then(() => applyScan(product, size, snap)).finally(() => setBusy((b) => b - 1));
  }

  async function applyScan(product, size, snap) {
    const key = `${product.id}|${size}|${snap.date}|${snap.source}|${snap.remarks}`;
    const prev = entries.current[key];
    const entry = prev
      ? { ...prev, qty: prev.qty + 1 }
      : { id: uid('inw'), date: snap.date, source: snap.source, product_id: product.id, product_name: product.name, size, qty: 1, remarks: snap.remarks || 'Barcode scan', brand };
    try {
      await adjustSizeStock(product.id, size, 1);
      try {
        await saveInward(entry);
      } catch (err) {
        await adjustSizeStock(product.id, size, -1); // keep stock and log in step
        throw err;
      }
      entries.current[key] = entry;
      beep(true);
      setLast({ ok: true, text: `+1 ${product.name} (${size}) — ${entry.qty} scanned` });
      setRows((rs) => [{ key, name: product.name, sku: `${product.sku_prefix}-${size}`, size, qty: entry.qty, source: snap.source }, ...rs.filter((r) => r.key !== key)]);
      reload();
    } catch (err) {
      beep(false);
      setLast({ ok: false, text: `Couldn't save that scan: ${err.message || err}. Scan it again.` });
    }
  }

  const total = rows.reduce((a, r) => a + r.qty, 0);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <p className="section-title">Scan barcode</p>
      <div className="field-row">
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field">
          <label>From where</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="field" style={{ flex: 1.5 }}>
          <label>Remarks (optional)</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Myntra returns batch" />
        </div>
      </div>
      <div className="field">
        <label>Click here, then scan — each scan adds 1 piece to stock</label>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleScan(code); } }}
          placeholder="e.g. LOM-BBT-W-BLK-M"
          autoComplete="off"
          style={{ fontSize: 18, padding: '10px 12px', fontFamily: 'monospace' }}
        />
      </div>
      {last && (
        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, fontWeight: 600,
          background: last.ok ? '#e6f4ea' : '#fdecea', color: last.ok ? '#1e6b34' : '#a32020' }}>
          {last.ok ? '✓ ' : '✕ '}{last.text}
        </div>
      )}
      {busy > 0 && <div className="mini-note" style={{ marginTop: 6 }}>Saving {busy} scan{busy === 1 ? '' : 's'}…</div>}

      {rows.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>From</th><th>Scanned</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}><td>{r.name}</td><td>{r.sku}</td><td>{r.source}</td><td>{r.qty}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total this session</td><td>{total}</td></tr></tfoot>
          </table>
        </div>
      )}
      <div className="mini-note" style={{ marginTop: 8 }}>
        Repeat scans of the same item add up into one entry in the list below — use Undo there to reverse a whole batch.
        Products without a SKU can't be scanned; add them by hand.
      </div>
    </div>
  );
}
