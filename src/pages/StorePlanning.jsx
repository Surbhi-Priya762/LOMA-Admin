import { useMemo, useState } from 'react';
import { CATS, QTY_BASED_CATS, materialLineCost, productProductionCost, rupee, fmt } from '../lib/calc';

export default function StorePlanning({ data }) {
  const { products, settings } = data;
  const [piecesPerSize, setPiecesPerSize] = useState(5);
  const [overrides, setOverrides] = useState({}); // productId -> manual cost/piece override

  const pps = Number(piecesPerSize) || 0;

  const rows = useMemo(() => {
    return products.map((p) => {
      const sizesCount = (p.sizes || []).length || 6;
      const totalPieces = pps * sizesCount;
      const costPerPiece = productProductionCost(p, settings.daily_labour_budget);
      const override = overrides[p.id];
      const effectiveCost = costPerPiece != null ? costPerPiece : (override != null && override !== '' ? Number(override) : null);
      const totalCost = effectiveCost != null ? effectiveCost * totalPieces : null;
      return { product: p, sizesCount, totalPieces, costPerPiece, effectiveCost, totalCost, missing: costPerPiece == null };
    });
  }, [products, pps, settings.daily_labour_budget, overrides]);

  const materialsSummary = useMemo(() => {
    const map = {};
    rows.forEach(({ product: p, totalPieces }) => {
      CATS.forEach((cat) => {
        const key = cat.toLowerCase();
        const name = p[`${key}_name`];
        if (!name) return;
        let qtyPerPiece = p[`${key}_qty`];
        if (qtyPerPiece == null && key === 'fabric' && p.fabric_qty_m != null) qtyPerPiece = p.fabric_qty_m;
        const cost = materialLineCost(p, key);
        if (!map[name]) map[name] = { category: cat, unit: QTY_BASED_CATS.includes(key) ? 'm/pcs' : null, qtyNeeded: 0, hasQty: false, costTotal: 0, hasCost: false, incomplete: false };
        const entry = map[name];
        if (qtyPerPiece != null) {
          entry.qtyNeeded += Number(qtyPerPiece) * totalPieces;
          entry.hasQty = true;
        }
        if (cost != null) {
          entry.costTotal += cost * totalPieces;
          entry.hasCost = true;
        } else {
          entry.incomplete = true;
        }
      });
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const grandTotal = rows.reduce((a, r) => (r.totalCost != null ? a + r.totalCost : a), 0);
  const missingCount = rows.filter((r) => r.missing && overrides[r.product.id] == null).length;
  const totalPiecesAll = rows.reduce((a, r) => a + r.totalPieces, 0);

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Store Planning</h1>
          <div className="page-sub">Estimate materials &amp; cost to stock the mall store — set pieces per size, see totals across every product</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Target quantity</p>
        <div className="field-row" style={{ maxWidth: 260 }}>
          <div className="field">
            <label>Pieces per size, per product</label>
            <input type="number" min="0" value={piecesPerSize} onChange={(e) => setPiecesPerSize(e.target.value)} />
          </div>
        </div>
        <div className="mini-note">
          Applied across every size of every product (XS–XXL, or however many sizes each product has). Change this number to re-run the whole estimate instantly.
        </div>
      </div>

      <div className="grid-cards">
        <div className="stat-card"><div className="stat-num">{totalPiecesAll}</div><div className="stat-label">Total pieces to stock</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(grandTotal)}</div><div className="stat-label">Estimated total cost</div></div>
        <div className="stat-card"><div className="stat-num">{missingCount}</div><div className="stat-label">Products missing cost — fill in below</div>{missingCount > 0 && <div className="stat-flag">Estimate is partial until these are filled</div>}</div>
      </div>

      <p className="section-title">Raw materials needed</p>
      <div className="table-wrap" style={{ marginBottom: 22 }}>
        <table className="data-table">
          <thead><tr><th>Material</th><th>Category</th><th>Qty needed</th><th>Estimated cost</th></tr></thead>
          <tbody>
            {materialsSummary.length === 0 ? (
              <tr><td colSpan={4} className="empty">Assign materials to products first (Products page) to see totals here.</td></tr>
            ) : (
              materialsSummary.map(([name, m]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{m.category}</td>
                  <td>{m.hasQty ? fmt(m.qtyNeeded) : '—'}</td>
                  <td>{m.hasCost ? rupee(m.costTotal) + (m.incomplete ? ' (partial)' : '') : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="section-title">Per product</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Sizes</th><th>Total pieces</th><th>Cost/piece</th><th>Total cost</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.id}>
                <td>{r.product.name}</td>
                <td>{r.sizesCount}</td>
                <td>{r.totalPieces}</td>
                <td>
                  {r.costPerPiece != null ? (
                    rupee(r.costPerPiece)
                  ) : (
                    <input
                      type="number" step="any" placeholder="enter manually"
                      value={overrides[r.product.id] ?? ''}
                      onChange={(e) => setOverrides((o) => ({ ...o, [r.product.id]: e.target.value }))}
                      style={{ width: 100, padding: '4px 6px', border: '1px solid var(--rust)', borderRadius: 2 }}
                    />
                  )}
                </td>
                <td>{r.totalCost != null ? rupee(r.totalCost) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mini-note" style={{ marginTop: 8 }}>
        Cost/piece pulls straight from each product's real costing on the Products page. Where that's still blank, type an estimate directly here — it's just for this plan, not saved to the product.
      </div>
    </div>
  );
}
