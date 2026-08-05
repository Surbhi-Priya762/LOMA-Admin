import { supabase } from './supabaseClient';

export async function fetchAll() {
  const [products, materials, productionLog, salesLog, settings, lastUpdate, expenses, inward] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('materials').select('*').order('category').order('name'),
    supabase.from('production_log').select('*').order('date', { ascending: false }),
    supabase.from('sales_log').select('*').order('date', { ascending: false }),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('last_update').select('*').eq('id', 1).maybeSingle(),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('inward').select('*').order('date', { ascending: false }),
  ]);
  for (const r of [products, materials, productionLog, salesLog, settings, lastUpdate, expenses, inward]) {
    if (r.error) throw r.error;
  }
  return {
    products: products.data || [],
    materials: materials.data || [],
    productionLog: productionLog.data || [],
    salesLog: salesLog.data || [],
    settings: settings.data || { daily_labour_budget: null },
    lastUpdate: lastUpdate.data || null,
    expenses: expenses.data || [],
    inward: inward.data || [],
  };
}

export async function saveProduct(product) {
  const { error } = await supabase.from('products').upsert(product);
  if (error) throw error;
}
export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
export async function saveMaterial(material) {
  const { error } = await supabase.from('materials').upsert(material);
  if (error) throw error;
}
export async function deleteMaterial(id) {
  const { error } = await supabase.from('materials').delete().eq('id', id);
  if (error) throw error;
}
export async function addProductionLog(entry) {
  const { error } = await supabase.from('production_log').insert(entry);
  if (error) throw error;
}
export async function updateProductionLog(entry) {
  const { error } = await supabase.from('production_log').upsert(entry);
  if (error) throw error;
}
export async function deleteProductionLog(id) {
  const { error } = await supabase.from('production_log').delete().eq('id', id);
  if (error) throw error;
}
export async function addSale(entry) {
  const { error } = await supabase.from('sales_log').insert(entry);
  if (error) throw error;
}
export async function deleteSale(id) {
  const { error } = await supabase.from('sales_log').delete().eq('id', id);
  if (error) throw error;
}
export async function updateSettings(dailyLabourBudget) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, daily_labour_budget: dailyLabourBudget });
  if (error) throw error;
}
export async function recordLastUpdate(name, what) {
  const entry = { id: 1, name: (name || 'Someone').trim() || 'Someone', what, ts: new Date().toISOString() };
  const { error } = await supabase.from('last_update').upsert(entry);
  if (error) throw error;
  return entry;
}

// Pulls all 6 tables fresh from Supabase for a one-click backup download.
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
  };
}

export async function addExpense(entry) {
  const { error } = await supabase.from('expenses').insert(entry);
  if (error) throw error;
}
export async function updateExpense(entry) {
  const { error } = await supabase.from('expenses').upsert(entry);
  if (error) throw error;
}
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function addInward(entry) {
  const { error } = await supabase.from('inward').insert(entry);
  if (error) throw error;
}
export async function deleteInward(id) {
  const { error } = await supabase.from('inward').delete().eq('id', id);
  if (error) throw error;
}
