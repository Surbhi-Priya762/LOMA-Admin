export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const CHANNELS = ['Myntra', 'Coyu', 'Nykaa', 'Shopify', 'Popup', 'Other'];
export const CATS = ['Fabric', 'Button', 'Thread', 'Fusing', 'Zip', 'Hook', 'Elastic', 'Lining'];
export const CAT_KEYS = CATS.map((c) => c.toLowerCase());
export const CAT_UNITS = { Fabric: 'm', Button: 'pcs', Thread: 'cones', Fusing: 'm', Zip: 'pcs', Hook: 'pcs', Elastic: 'm', Lining: 'm' };
// Only these two multiply qty x price. Everything else is a flat manual cost, independent of quantity.
export const QTY_BASED_CATS = ['fabric', 'lining'];

export function fmt(n) {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (Number.isNaN(num)) return null;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}
export function rupee(n) {
  const f = fmt(n);
  return f == null ? '—' : `Rs.${f}`;
}

// One material line's cost, e.g. cat='fabric' -> fabric_qty x fabric_price. Fabric/Lining only.
// Everything else is a flat cost stored directly in {cat}_price.
export function materialLineCost(p, cat) {
  const price = p[`${cat}_price`];
  if (QTY_BASED_CATS.includes(cat)) {
    const qty = p[`${cat}_qty`];
    if (qty != null && qty !== '' && price != null && price !== '') {
      return Number(qty) * Number(price);
    }
    return null;
  }
  if (price != null && price !== '') return Number(price);
  return null;
}

export function productMaterialSubtotal(p) {
  const parts = CAT_KEYS.map((cat) => materialLineCost(p, cat)).filter((x) => x != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

// Labour cost/piece = shared daily labour budget ÷ this product's tailor output (pieces/day).
// Falls back to a manually-typed labour cost if tailor output isn't set.
export function productLabourCost(p, dailyBudget) {
  const out = p.tailor_output;
  if (out != null && out !== '' && Number(out) > 0 && dailyBudget != null && dailyBudget !== '') {
    return Number(dailyBudget) / Number(out);
  }
  if (p.labour_cost != null && p.labour_cost !== '') return Number(p.labour_cost);
  return null;
}

export function productProductionCost(p, dailyBudget) {
  const sub = productMaterialSubtotal(p);
  const labour = productLabourCost(p, dailyBudget);
  if (sub == null || labour == null) return null;
  const electricity = p.electricity_cost != null && p.electricity_cost !== '' ? Number(p.electricity_cost) : 0;
  return sub + labour + electricity;
}

export function productFinalCost(p, dailyBudget) {
  const pc = productProductionCost(p, dailyBudget);
  if (pc == null) return null;
  const pkg = p.packaging != null && p.packaging !== '' ? Number(p.packaging) : 0;
  return pc + pkg;
}

export function productTargetMRP(p, dailyBudget) {
  const pc = productProductionCost(p, dailyBudget);
  return pc == null ? null : pc * 3;
}

export function labourFormulaText(p, dailyBudget) {
  const out = p.tailor_output;
  if (out != null && out !== '' && Number(out) > 0 && dailyBudget != null && dailyBudget !== '') {
    return `Rs.${fmt(dailyBudget)} ÷ ${fmt(out)} pieces/day = Rs.${fmt(Number(dailyBudget) / Number(out))} labour per piece.`;
  }
  if (p.labour_cost != null && p.labour_cost !== '') {
    return `Using the manually typed labour cost (Rs.${fmt(p.labour_cost)}/piece) since tailor output isn't set.`;
  }
  return "Fill in Tailor output (and the daily budget) to calculate this automatically, or type a labour cost directly.";
}

export function productTotalStock(p) {
  return (p.sizes || []).reduce((a, s) => a + (Number(s.stock) || 0), 0);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Effective gross/net for a sale row, falling back to price x qty for older entries
// that predate the gross/net fields.
export function saleGross(sale) {
  if (sale.gross_amount != null && sale.gross_amount !== '') return Number(sale.gross_amount);
  if (sale.price != null) return Number(sale.price) * (Number(sale.qty) || 1);
  return null;
}
export function saleNet(sale) {
  if (sale.net_amount != null && sale.net_amount !== '') return Number(sale.net_amount);
  return saleGross(sale);
}

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// How much of a Fabric material has been consumed by all "Ready" production log entries.
export function materialTotalIssued(material, products, productionLog) {
  if (material.category !== 'Fabric') return 0;
  let total = 0;
  productionLog.forEach((l) => {
    if (l.status !== 'Ready') return;
    const p = products.find((pp) => pp.name === l.product_name || pp.id === l.product_id);
    if (!p || p.fabric_name !== material.name || p.fabric_qty == null) return;
    total += Number(p.fabric_qty) * (Number(l.qty) || 0);
  });
  return total;
}

// Which products currently reference this material, via whichever category field matches its category.
export function materialUsedByProducts(material, products) {
  const key = `${(material.category || 'Fabric').toLowerCase()}_name`;
  return products.filter((p) => p[key] === material.name);
}

