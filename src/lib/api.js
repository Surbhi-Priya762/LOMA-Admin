import { supabase } from './supabaseClient';

// Each table the app loads, the key it lives under in `data`, and how to query it.
const TABLES = {
  products: { key: 'products', q: (t) => t.select('*').order('name') },
  materials: { key: 'materials', q: (t) => t.select('*').order('category').order('name') },
  production_log: { key: 'productionLog', q: (t) => t.select('*').order('date', { ascending: false }) },
  sales_log: { key: 'salesLog', q: (t) => t.select('*').order('date', { ascending: false }) },
  app_settings: { key: 'settings', single: true, fallback: { daily_labour_budget: null }, q: (t) => t.select('*').eq('id', 1).maybeSingle() },
  last_update: { key: 'lastUpdate', single: true, fallback: null, q: (t) => t.select('*').eq('id', 1).maybeSingle() },
  expenses: { key: 'expenses', q: (t) => t.select('*').order('date', { ascending: false }) },
  inward: { key: 'inward', q: (t) => t.select('*').order('date', { ascending: false }) },
  store_plan_extras: { key: 'storePlanExtras', q: (t) => t.select('*').order('created_at') },
  channel_commissions: { key: 'commissions', q: (t) => t.select('*') },
  outward: { key: 'outward', q: (t) => t.select('*').order('date', { ascending: false }) },
  settlements: { key: 'settlements', q: (t) => t.select('*').order('date_logged', { ascending: false }) },
  customer_details: { key: 'customerDetails', q: (t) => t.select('*').order('date', { ascending: false }) },
  quality_checks: { key: 'qualityChecks', q: (t) => t.select('*').order('date', { ascending: false }) },
};

// Tables changed since the last reload. Every save/delete below goes through
// write(), which marks its table here, so reload() only re-fetches what changed
// instead of all 14 tables.
const dirty = new Set();
function write(table) {
  dirty.add(table);
  return supabase.from(table);
}
export function takeDirtyTables() {
  const list = Array.from(dirty);
  dirty.clear();
  return list;
}

// Fetch some tables (or all of them) and return them keyed the way the app expects.
export async function fetchTables(names = Object.keys(TABLES)) {
  const results = await Promise.all(names.map((n) => TABLES[n].q(supabase.from(n))));
  const out = {};
  results.forEach((r, i) => {
    if (r.error) throw r.error;
    const cfg = TABLES[names[i]];
    out[cfg.key] = r.data || (cfg.single ? cfg.fallback : []);
  });
  return out;
}

export async function fetchAll() {
  return fetchTables();
}

export async function saveProduct(product) {
  const { error } = await write('products').upsert(product);
  if (error) throw error;
}
export async function deleteProduct(id) {
  const { error } = await write('products').delete().eq('id', id);
  if (error) throw error;
}
export async function saveMaterial(material) {
  const { error } = await write('materials').upsert(material);
  if (error) throw error;
}
export async function deleteMaterial(id) {
  const { error } = await write('materials').delete().eq('id', id);
  if (error) throw error;
}
export async function addProductionLog(entry) {
  const { error } = await write('production_log').insert(entry);
  if (error) throw error;
}
export async function updateProductionLog(entry) {
  const { error } = await write('production_log').upsert(entry);
  if (error) throw error;
}
export async function deleteProductionLog(id) {
  const { error } = await write('production_log').delete().eq('id', id);
  if (error) throw error;
}
export async function addSale(entry) {
  const { error } = await write('sales_log').insert(entry);
  if (error) throw error;
}
export async function updateSale(entry) {
  const { error } = await write('sales_log').upsert(entry);
  if (error) throw error;
}
export async function deleteSale(id) {
  const { error } = await write('sales_log').delete().eq('id', id);
  if (error) throw error;
}
export async function updateSettings(dailyLabourBudget) {
  const { error } = await write('app_settings')
    .upsert({ id: 1, daily_labour_budget: dailyLabourBudget });
  if (error) throw error;
}
export async function recordLastUpdate(name, what) {
  const entry = { id: 1, name: (name || 'Someone').trim() || 'Someone', what, ts: new Date().toISOString() };
  const { error } = await write('last_update').upsert(entry);
  if (error) throw error;
  return entry;
}

export async function backupAll() {
  const d = await fetchAll();
  return {
    exportedAt: new Date().toISOString(),
    products: d.products,
    materials: d.materials,
    productionLog: d.productionLog,
    salesLog: d.salesLog,
    settings: d.settings,
    lastUpdate: d.lastUpdate,
    expenses: d.expenses,
    inward: d.inward,
    storePlanExtras: d.storePlanExtras,
    commissions: d.commissions,
    outward: d.outward,
    settlements: d.settlements,
    customerDetails: d.customerDetails,
    qualityChecks: d.qualityChecks,
  };
}

export async function addExpense(entry) {
  const { error } = await write('expenses').insert(entry);
  if (error) throw error;
}
export async function updateExpense(entry) {
  const { error } = await write('expenses').upsert(entry);
  if (error) throw error;
}
export async function deleteExpense(id) {
  const { error } = await write('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function addInward(entry) {
  const { error } = await write('inward').insert(entry);
  if (error) throw error;
}
export async function deleteInward(id) {
  const { error } = await write('inward').delete().eq('id', id);
  if (error) throw error;
}

export async function addStorePlanExtra(entry) {
  const { error } = await write('store_plan_extras').insert(entry);
  if (error) throw error;
}
export async function deleteStorePlanExtra(id) {
  const { error } = await write('store_plan_extras').delete().eq('id', id);
  if (error) throw error;
}

export async function saveChannelCommission(entry) {
  const { error } = await write('channel_commissions').upsert(entry);
  if (error) throw error;
}

export async function addOutward(entry) {
  const { error } = await write('outward').insert(entry);
  if (error) throw error;
}
export async function deleteOutward(id) {
  const { error } = await write('outward').delete().eq('id', id);
  if (error) throw error;
}

export async function addSettlement(entry) {
  const { error } = await write('settlements').insert(entry);
  if (error) throw error;
}
export async function updateSettlement(entry) {
  const { error } = await write('settlements').upsert(entry);
  if (error) throw error;
}
export async function deleteSettlementBySale(saleId) {
  const { error } = await write('settlements').delete().eq('sale_id', saleId);
  if (error) throw error;
}
export async function deleteSettlement(id) {
  const { error } = await write('settlements').delete().eq('id', id);
  if (error) throw error;
}

export async function addCustomerDetail(entry) {
  const { error } = await write('customer_details').insert(entry);
  if (error) throw error;
}
export async function updateCustomerDetail(entry) {
  const { error } = await write('customer_details').upsert(entry);
  if (error) throw error;
}
export async function deleteCustomerDetail(id) {
  const { error } = await write('customer_details').delete().eq('id', id);
  if (error) throw error;
}

export async function addQualityCheck(entry) {
  const { error } = await write('quality_checks').insert(entry);
  if (error) throw error;
}
export async function updateQualityCheck(entry) {
  const { error } = await write('quality_checks').upsert(entry);
  if (error) throw error;
}
export async function deleteQualityCheck(id) {
  const { error } = await write('quality_checks').delete().eq('id', id);
  if (error) throw error;
}
export async function deleteQualityCheckByProductionLog(productionLogId) {
  const { error } = await write('quality_checks').delete().eq('production_log_id', productionLogId);
  if (error) throw error;
}
