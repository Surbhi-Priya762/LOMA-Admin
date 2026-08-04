import { supabase } from './supabaseClient';

export async function fetchAll() {
  const [products, materials, productionLog, salesLog, settings, lastUpdate] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('materials').select('*').order('category').order('name'),
    supabase.from('production_log').select('*').order('date', { ascending: false }),
    supabase.from('sales_log').select('*').order('date', { ascending: false }),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('last_update').select('*').eq('id', 1).maybeSingle(),
  ]);
  for (const r of [products, materials, productionLog, salesLog, settings, lastUpdate]) {
    if (r.error) throw r.error;
  }
  return {
    products: products.data || [],
    materials: materials.data || [],
    productionLog: productionLog.data || [],
    salesLog: salesLog.data || [],
    settings: settings.data || { daily_labour_budget: null },
    lastUpdate: lastUpdate.data || null,
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
  };
}
