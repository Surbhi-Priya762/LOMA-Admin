// Packaging per order only works once the per-order columns exist in Supabase
// (supabase-packaging-per-order.sql). Until then nothing about sales changes.
export function packagingReady(data) {
  return (data.packaging || []).some((r) => 'used_for' in r);
}

export function orderPackagingItems(data, brand) {
  return (data.packaging || []).filter((r) => r.used_for === brand && Number(r.per_order ?? 1) !== 0);
}
