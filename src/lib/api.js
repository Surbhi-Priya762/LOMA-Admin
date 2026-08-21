import { supabase } from './supabaseClient';

export async function fetchAll() {
  const [
    products, materials, productionLog, salesLog, settings, lastUpdate,
    expenses, inward, storePlanExtras, commissions, outward, settlements, customerDetails,
  ] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('materials').select('*').order('category').order('name'),
    supabase.from('production_log').select('*').order('date', { ascending: false }),
    supabase.from('sales_log').select('*').order('date', { ascending: false }),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('last_update').select('*').eq('id', 1).maybeSingle(),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('inward').select('*').order('date', { ascending: false }),
    supabase.from('store_plan_extras').select('*').order('created_at'),
    supabase.from('channel_commissions').select('*'),
    supabase.from('outward').select('*').order('date', { ascending: false }),
    supabase.from('settlements').select('*').order('date_logged', { ascending: false }),
    supabase.from('customer_details').select('*').order('date', { ascending: false }),
  ]);
  for (const r of [products, materials, productionLog, salesLog, settings, lastUpdate, expenses, inward, storePlanExtras, commissions, outward, settlements, customerDetails]) {
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
    storePlanExtras: storePlanExtras.data || [],
    commissions: commissions.data || [],
    outward: outward.data || [],
    settlements: settlements.data || [],
    customerDetails: customerDetails.data || [],
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
export async function updateSale(entry) {
  const { error } = await supabase.from('sales_log').upsert(entry);
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

export async function addStorePlanExtra(entry) {
  const { error } = await supabase.from('store_plan_extras').insert(entry);
  if (error) throw error;
}
export async function deleteStorePlanExtra(id) {
  const { error } = await supabase.from('store_plan_extras').delete().eq('id', id);
  if (error) throw error;
}

export async function saveChannelCommission(entry) {
  const { error } = await supabase.from('channel_commissions').upsert(entry);
  if (error) throw error;
}

export async function addOutward(entry) {
  const { error } = await supabase.from('outward').insert(entry);
  if (error) throw error;
}
export async function deleteOutward(id) {
  const { error } = await supabase.from('outward').delete().eq('id', id);
  if (error) throw error;
}

export async function addSettlement(entry) {
  const { error } = await supabase.from('settlements').insert(entry);
  if (error) throw error;
}
export async function updateSettlement(entry) {
  const { error } = await supabase.from('settlements').upsert(entry);
  if (error) throw error;
}
export async function deleteSettlementBySale(saleId) {
  const { error } = await supabase.from('settlements').delete().eq('sale_id', saleId);
  if (error) throw error;
}
export async function deleteSettlement(id) {
  const { error } = await supabase.from('settlements').delete().eq('id', id);
  if (error) throw error;
}

export async function addCustomerDetail(entry) {
  const { error } = await supabase.from('customer_details').insert(entry);
  if (error) throw error;
}
export async function updateCustomerDetail(entry) {
  const { error } = await supabase.from('customer_details').upsert(entry);
  if (error) throw error;
}
export async function deleteCustomerDetail(id) {
  const { error } = await supabase.from('customer_details').delete().eq('id', id);
  if (error) throw error;
}
