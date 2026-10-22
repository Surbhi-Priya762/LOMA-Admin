export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const BRANDS = ['Loma', 'Sauca'];
export const QC_SECTIONS = [
  { section: 'Fabric & Cutting', items: [
    'Fabric matches approved swatch/shade for this style',
    'No visible weave defects, slubs, or pulls on main panels',
    'Grain line straight — no bowing or skew on panels',
    'Pattern/stripe matched at side seams and yoke (if applicable)',
    'Cut pieces match pattern size — no short/uneven panels',
  ]},
  { section: 'Stitching & Construction', items: [
    'Seams straight, even, no puckering or wavy lines',
    'Stitch density consistent — no skipped or loose stitches',
    'Seam allowance consistent throughout',
    'Armhole, neckline and hem stitched flat, no pulling',
    'Understitching secure on facings/collars',
    'Topstitching straight and even width from edge',
    'No open seams or loose threads at stress points (underarm, crotch, side splits)',
  ]},
  { section: 'Fastenings — Buttons, Zips, Hooks', items: [
    'All buttons attached securely, correct thread color',
    'Button count matches design — none missing',
    'Buttonholes clean-cut, no fraying, correct size for button',
    'Zip runs smoothly top to bottom, no snagging',
    'Zip pull and slider secure, tape stitched flat',
    'Hooks, snaps, or drawstrings functioning and securely attached',
    'Ties/belts correct length and securely attached',
  ]},
  { section: 'Finishing & Pressing', items: [
    'Garment pressed flat — no crease marks or shine from iron',
    'Hems even all around, correct finished length',
    'No visible chalk marks, tailor tacks, or basting threads left in',
    'No loose or hanging threads anywhere on garment',
    'Trims (lace, piping, embroidery) secure and symmetrical',
  ]},
  { section: 'Stains & Surface Check', items: [
    'No oil, grease, or machine-oil stains',
    'No dirt, dust, or footprint marks',
    'No visible watermarks or discoloration',
    'No rust marks near metal trims',
    'Garment odor-free (no chemical or mustiness)',
  ]},
  { section: 'Measurements (spot check against tech pack)', items: [
    'Chest/bust measurement within tolerance',
    'Length (shoulder to hem) within tolerance',
    'Sleeve length within tolerance',
    'Waist/hip measurement within tolerance',
  ]},
  { section: 'Labels & Packaging', items: [
    'Brand label correctly placed and securely stitched',
    'Size label correct for this piece',
    'Care label present, correct wash instructions',
    'Price/SKU tag attached, matches order',
    'Folded/hung per packing standard, poly bag sealed',
  ]},
];
export function blankQCChecklist() {
  const rows = [];
  QC_SECTIONS.forEach(({ section, items }) => {
    items.forEach((item) => rows.push({ section, item, ok: false, fix: false, note: '' }));
  });
  return rows;
}
export const SALE_TYPES = ['Online', 'Offline', 'Onhand'];
export const CHANNELS_BY_TYPE = {
  Online: ['Myntra', 'Nykaa', 'Shopify', 'Coyu MTO', 'Other'],
  Offline: ['Coyu Store', 'Our Store', 'Popup Sale'],
  Onhand: ['Coyu Onhand'],
};
export const CHANNELS = [...CHANNELS_BY_TYPE.Online, ...CHANNELS_BY_TYPE.Offline, ...CHANNELS_BY_TYPE.Onhand];
export function saleTypeForChannel(channel) {
  if (CHANNELS_BY_TYPE.Online.includes(channel)) return 'Online';
  if (CHANNELS_BY_TYPE.Offline.includes(channel)) return 'Offline';
  if (CHANNELS_BY_TYPE.Onhand.includes(channel)) return 'Onhand';
  return null;
}

export const CATS = ['Fabric', 'Button', 'Thread', 'Fusing', 'Zip', 'Hook', 'Elastic', 'Lining'];
export const CAT_KEYS = CATS.map((c) => c.toLowerCase());
export const CAT_UNITS = { Fabric: 'm', Button: 'pcs', Thread: 'cones', Fusing: 'm', Zip: 'pcs', Hook: 'pcs', Elastic: 'm', Lining: 'm' };
export const QTY_BASED_CATS = ['fabric', 'lining'];

export function fmt(n) {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (Number.isNaN(num)) return null;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}
// Display only (exports use fmt): Indian digit grouping, e.g. Rs.1,23,456.5
export function rupee(n) {
  const f = fmt(n);
  if (f == null) return '—';
  return `Rs.${Number(f).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

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

export function productLabourCost(p, dailyBudget) {
  const out = p.tailor_output;
  if (out != null && out !== '' && Number(out) > 0 && dailyBudget != null && dailyBudget !== '') {
    return Number(dailyBudget) / Number(out);
  }
  if (p.labour_cost != null && p.labour_cost !== '') return Number(p.labour_cost);
  return null;
}

// Pattern cost (Rs./piece) — Sauca products only. Loma products always return 0.
export function productPatternCost(p) {
  if ((p.brand || 'Loma') !== 'Sauca') return 0;
  return p.pattern_cost != null && p.pattern_cost !== '' ? Number(p.pattern_cost) : 0;
}

// Master cost (Rs./piece) — every product, both brands. Blank counts as 0.
export function productMasterCost(p) {
  return p.master_cost != null && p.master_cost !== '' ? Number(p.master_cost) : 0;
}

export function productProductionCost(p, dailyBudget) {
  const sub = productMaterialSubtotal(p);
  const labour = productLabourCost(p, dailyBudget);
  if (sub == null || labour == null) return null;
  const electricity = p.electricity_cost != null && p.electricity_cost !== '' ? Number(p.electricity_cost) : 0;
  return sub + labour + electricity + productPatternCost(p) + productMasterCost(p);
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

// Stage 2 helper — used by every single-brand-only page (Stock, Production Log,
// Quality Check, Inward, Outward, Sales, Settlements, Store Planning, Stock Check,
// Customer Details). Rows saved before the brand split default to 'Loma'.
export function filterByBrand(rows, brand) {
  if (!rows) return [];
  return rows.filter((r) => (r.brand || 'Loma') === brand);
}

export function productTotalStock(p) {
  return (p.sizes || []).reduce((a, s) => a + (Number(s.stock) || 0), 0);
}

export function todayStr() {
  // Local date (IST), not UTC — so entries made before 5:30am don't land on yesterday.
  return isoLocal(new Date());
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

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

export function materialUsedByProducts(material, products) {
  const key = `${(material.category || 'Fabric').toLowerCase()}_name`;
  return products.filter((p) => p[key] === material.name);
}

export function saleGross(sale) {
  if (sale.gross_amount != null && sale.gross_amount !== '') return Number(sale.gross_amount);
  if (sale.price != null) return Number(sale.price) * (Number(sale.qty) || 1);
  return null;
}
export function saleNet(sale) {
  if (sale.net_amount != null && sale.net_amount !== '') return Number(sale.net_amount);
  return saleGross(sale);
}

export function applyCommission(gross, commission) {
  if (gross === '' || gross == null) return '';
  const g = Number(gross);
  if (!commission || commission.type === 'None' || commission.value == null || commission.value === '') return g.toFixed(2);
  if (commission.type === 'Percentage') return (g * (1 - Number(commission.value) / 100)).toFixed(2);
  if (commission.type === 'Flat') return (g - Number(commission.value)).toFixed(2);
  return g.toFixed(2);
}

export function matchProductBySku(skuCode, products) {
  if (!skuCode) return null;
  const parts = skuCode.trim().split('-');
  const lastPart = parts[parts.length - 1].toUpperCase();
  if (!SIZES.includes(lastPart)) return null;
  const prefix = parts.slice(0, -1).join('-');
  const product = products.find((p) => p.sku_prefix === prefix);
  return product ? { product, size: lastPart } : null;
}

// Barcode scan: "LOM-BBT-W-BLK-M" -> { product, size }. Case-insensitive, ignores
// spaces. Returns { error } with a reason when it can't be matched.
export function matchScannedSku(code, products) {
  const clean = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return { error: 'Empty scan.' };
  const parts = clean.split('-');
  const size = parts[parts.length - 1];
  const prefix = parts.slice(0, -1).join('-');
  const byPrefix = (pre) => products.find((p) => p.sku_prefix && p.sku_prefix.trim().toUpperCase() === pre);
  if (SIZES.includes(size) && prefix) {
    const product = byPrefix(prefix);
    if (product) return { product, size };
  }
  if (byPrefix(clean)) return { error: `"${clean}" has no size on the end (e.g. ${clean}-M).` };
  return { error: `No product has SKU "${clean}".` };
}

export function matchProductBySkuPrefix(strippedSku, products) {
  if (!strippedSku) return null;
  const sorted = [...products].filter((p) => p.sku_prefix).sort((a, b) => b.sku_prefix.length - a.sku_prefix.length);
  return sorted.find((p) => strippedSku === p.sku_prefix || strippedSku.startsWith(`${p.sku_prefix}-`)) || null;
}

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function exportToExcel(rows, columns, filename) {
  const header = columns.map((c) => c.label);
  const lines = [header.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',')];
  rows.forEach((row) => {
    const cells = columns.map((c) => {
      const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    });
    lines.push(cells.join(','));
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
// ---------- Date range filter helpers ----------
// A range is { preset, from, to } with from/to as 'YYYY-MM-DD' (or null = open-ended).
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function rangeForPreset(preset) {
  const now = new Date();
  if (preset === 'this-month') {
    return { preset, from: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === 'last-month') {
    return { preset, from: isoLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoLocal(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (preset === 'last-7') {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { preset, from: isoLocal(from), to: isoLocal(now) };
  }
  if (preset === 'last-30') {
    const from = new Date(now); from.setDate(from.getDate() - 29);
    return { preset, from: isoLocal(from), to: isoLocal(now) };
  }
  return { preset: 'all', from: null, to: null };
}
export function rangeForMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return { preset: `month:${month}`, from: isoLocal(new Date(y, m - 1, 1)), to: isoLocal(new Date(y, m, 0)) };
}
export function inDateRange(dateStr, range) {
  if (!range || (!range.from && !range.to)) return true;
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}
export function rangeLabel(range) {
  if (!range || range.preset === 'all') return 'all-time';
  if (range.from && range.to) return `${range.from}_to_${range.to}`;
  if (range.from) return `from-${range.from}`;
  if (range.to) return `until-${range.to}`;
  return 'all-time';
}
export function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

// Stock currently held for one size of a product.
export function sizeStock(product, size) {
  const s = (product?.sizes || []).find((x) => x.size === size);
  return s ? Number(s.stock) || 0 : 0;
}
