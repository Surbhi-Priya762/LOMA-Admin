import { packagingReady, orderPackagingItems } from '../lib/packaging';

export default function PackedToggle({ data, brand, checked, onChange }) {
  if (!packagingReady(data)) return null;
  const items = orderPackagingItems(data, brand);
  if (items.length === 0) return null;
  const names = items.map((i) => `${i.name}${Number(i.per_order ?? 1) !== 1 ? ` ×${i.per_order}` : ''}`).join(', ');
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>
        <strong>Packed — take packaging off</strong>
        <span className="mini-note" style={{ display: 'block' }}>1 order uses: {names}</span>
      </span>
    </label>
  );
}
