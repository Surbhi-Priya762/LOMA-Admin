import { useState } from 'react';
import { CATS, materialLineCost, productProductionCost, rupee, fmt, uid, filterByBrand } from '../lib/calc';
import { saveMaterial, deleteMaterial, addStorePlanExtra, deleteStorePlanExtra } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function StorePlanning({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const products = filterByBrand(data.products, brand);
  const materials = filterByBrand(data.materials, brand);
  const storePlanExtras = filterByBrand(data.storePlanExtras, brand);
  const { settings } = data;
  const [piecesPerSize, setPiecesPerSize] = useState(5);
  const [newFabricName, setNewFabricName] = useState('');
  const [newFabricPrice, setNewFabricPrice] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraAmount, setExtraAmount] = useState('');

  const pps = Number(piecesPerSize) || 0;
  const fabrics = materials.filter((m) => m.category === 'Fabric');

  function stylesFor(fabricName) {
    return products.filter((p) => p.fabric_name === fabricName);
  }

  function styleBreakdown(p) {
    const sizesCount = (p.sizes || []).length || 6;
    const totalPieces = pps * sizesCount;
    const fabricQty = p.fabric_qty ?? p.fabric_qty_m;
    const metersNeeded = fabricQty != null ? Number(fabricQty) * totalPieces : null;
    const costPerPiece = productProductionCost(p, settings.daily_labour_budget);
    const totalCost = costPerPiece != null ? costPerPiece * totalPieces : null;
    const lines = CATS.map((cat) => ({ cat, cost: materialLineCost(p, cat.toLowerCase()) }));
    return { totalPieces, metersNeeded, costPerPiece, totalCost, lines };
  }

  async function updateFabricPrice(fabric, value) {
    await saveMaterial({ ...fabric, price: value === '' ? null : Number(value) });
    toast('Fabric price updated.');
    reload();
  }

  async function handleDeleteFabric(fabric) {
    const count = stylesFor(fabric.name).length;
    const ok = await confirm(
      count > 0 ? `${count} style(s) still use "${fabric.name}". Delete this fabric anyway?` : `Delete "${fabric.name}"?`,
      'Delete'
    );
    if (!ok) return;
    await deleteMaterial(fabric.id);
    toast('Fabric deleted.');
    reload();
  }

  async function handleAddFabric() {
    if (!newFabricName.trim()) { toast('Enter a fabric name.'); return; }
    await saveMaterial({
      id: uid('mat'), name: newFabricName.trim(), category: 'Fabric', unit: 'm',
      price: newFabricPrice === '' ? null : Number(newFabricPrice), stock: null, block: null, reorder_level: null, image: null,
      brand,
    });
    toast('Fabric added.');
    setNewFabricName(''); setNewFabricPrice('');
    reload();
  }

  async function handleAddExtra() {
    const amt = Number(extraAmount);
    if (!extraName.trim() || !amt) { toast('Enter a name and amount.'); return; }
    await addStorePlanExtra({ id: uid('extra'), name: extraName.trim(), amount: amt, brand });
    toast('Added.');
    setExtraName(''); setExtraAmount('');
    reload();
  }

  async function handleDeleteExtra(id) {
    await deleteStorePlanExtra(id);
    reload();
  }

  const fabricTotals = fabrics.map((f) => {
    const styles = stylesFor(f.name);
    const breakdowns = styles.map((p) => ({ product: p, ...styleBreakdown(p) }));
    const metersTotal = breakdowns.reduce((a, b) => a + (b.metersNeeded || 0), 0);
    const costTotal = breakdowns.reduce((a, b) => a + (b.totalCost || 0), 0);
    const hasIncomplete = breakdowns.some((b) => b.costPerPiece == null);
    return { fabric: f, breakdowns, metersTotal, costTotal, hasIncomplete };
  });

  const extrasTotal = (storePlanExtras || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const grandTotal = fabricTotals.reduce((a, f) => a + f.costTotal, 0) + extrasTotal;
  const totalPiecesAll = products.reduce((a, p) => a + pps * ((p.sizes || []).length || 6), 0);

  const assignedProductIds = new Set(products.filter((p) => p.fabric_name).map((p) => p.id));
  const unassigned = products.filter((p) => !assignedProductIds.has(p.id));

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Store Planning</h1>
          <div className="page-sub">Fabric by fabric — every style that uses it, how much of everything it needs, and the total cost to stock the store</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Target quantity</p>
        <div className="field-row" style={{ maxWidth: 260 }}>
          <div className="field">
            <label>Pieces per size, per style</label>
            <input type="number" min="0" value={piecesPerSize} onChange={(e) => setPiecesPerSize(e.target.value)} />
          </div>
        </div>
        <div className="mini-note">Applied across every size of every style. Change this to re-run the whole plan instantly.</div>
      </div>

      <div className="grid-cards">
        <div className="stat-card"><div className="stat-num">{fabrics.length}</div><div className="stat-label">Fabrics</div></div>
        <div className="stat-card"><div className="stat-num">{totalPiecesAll}</div><div className="stat-label">Total pieces across all styles</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(grandTotal)}</div><div className="stat-label">Grand total (fabrics + extras)</div></div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Add a fabric</p>
        <div className="field-row">
          <div className="field"><label>Fabric name</label><input value={newFabricName} onChange={(e) => setNewFabricName(e.target.value)} /></div>
          <div className="field"><label>Price / m (Rs.)</label><input type="number" step="any" value={newFabricPrice} onChange={(e) => setNewFabricPrice(e.target.value)} /></div>
          <button className="btn secondary" style={{ alignSelf: 'flex-end' }} onClick={handleAddFabric}>+ Add fabric</button>
        </div>
      </div>

      {fabricTotals.map(({ fabric, breakdowns, metersTotal, costTotal, hasIncomplete }) => (
        <div className="card" style={{ marginBottom: 18 }} key={fabric.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p className="section-title" style={{ marginBottom: 4 }}>{fabric.name}</p>
              <div className="mini-note">{breakdowns.length} style{breakdowns.length === 1 ? '' : 's'} use this fabric</div>
            </div>
            <button className="btn danger small" onClick={() => handleDeleteFabric(fabric)}>Delete fabric</button>
          </div>
          <div className="field-row" style={{ maxWidth: 220, marginBottom: 12 }}>
            <div className="field">
              <label>Price / m (Rs.) — editable anytime</label>
              <input type="number" step="any" defaultValue={fabric.price ?? ''} onBlur={(e) => updateFabricPrice(fabric, e.target.value)} />
            </div>
          </div>

          {breakdowns.length === 0 ? (
            <div className="empty">No styles use this fabric yet.</div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 10 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Style</th><th>Pieces</th><th>Meters needed</th>
                    {CATS.filter((c) => c !== 'Fabric').map((c) => <th key={c}>{c}</th>)}
                    <th>Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdowns.map(({ product, totalPieces, metersNeeded, totalCost, lines }) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{totalPieces}</td>
                      <td>{metersNeeded != null ? fmt(metersNeeded) : '—'}</td>
                      {lines.filter((l) => l.cat !== 'Fabric').map((l) => (
                        <td key={l.cat}>{l.cost != null ? rupee(l.cost * totalPieces) : '—'}</td>
                      ))}
                      <td>{totalCost != null ? rupee(totalCost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Fabric total</td><td></td><td>{fmt(metersTotal)} m</td>
                    <td colSpan={CATS.length - 1}></td>
                    <td>{rupee(costTotal)}{hasIncomplete ? ' (partial)' : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="section-title">Styles with no fabric assigned</p>
          <div className="mini-note" style={{ marginBottom: 8 }}>These won't show under any fabric above until you assign one on the Products page.</div>
          {unassigned.map((p) => <div className="activity-row" key={p.id}><span>{p.name}</span></div>)}
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Extra costs — rent, store setup, anything else</p>
        <div className="field-row">
          <div className="field"><label>Name</label><input value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="e.g. Store rent" /></div>
          <div className="field"><label>Amount (Rs.)</label><input type="number" step="any" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} /></div>
          <button className="btn secondary" style={{ alignSelf: 'flex-end' }} onClick={handleAddExtra}>+ Add</button>
        </div>
        {(storePlanExtras || []).length > 0 && (
          <div style={{ marginTop: 10 }}>
            {storePlanExtras.map((e) => (
              <div className="activity-row" key={e.id}>
                <span>{e.name}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {rupee(e.amount)}
                  <button className="btn danger small" onClick={() => handleDeleteExtra(e.id)}>Remove</button>
                </span>
              </div>
            ))}
            <div className="activity-row" style={{ fontWeight: 600 }}>
              <span>Extras total</span><span>{rupee(extrasTotal)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ borderColor: 'var(--brass)' }}>
        <p className="section-title">Grand total</p>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 600, color: 'var(--brass)' }}>{rupee(grandTotal)}</div>
        <div className="mini-note">All fabrics' style costs, plus extras, at {piecesPerSize} pieces per size.</div>
      </div>
    </div>
  );
}
