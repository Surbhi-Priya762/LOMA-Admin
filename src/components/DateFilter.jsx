import { rangeForPreset, rangeForMonth, monthName } from '../lib/calc';

const PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-7', label: 'Last 7 days' },
  { id: 'last-30', label: 'Last 30 days' },
];

// Shared period picker: quick presets, a specific month, or a custom from–to range.
export default function DateFilter({ value, onChange, months = [] }) {
  const isCustom = value.preset === 'custom';
  const monthValue = value.preset?.startsWith('month:') ? value.preset.slice(6) : '';
  return (
    <div className="date-filter">
      <div className="seg" role="group" aria-label="Period">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`seg-btn ${value.preset === p.id ? 'active' : ''}`}
            onClick={() => onChange(rangeForPreset(p.id))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`seg-btn ${isCustom ? 'active' : ''}`}
          onClick={() => onChange({ preset: 'custom', from: value.from, to: value.to })}
        >
          Custom
        </button>
      </div>
      {months.length > 0 && (
        <select
          className="month-select"
          aria-label="Pick a month"
          value={monthValue}
          onChange={(e) => (e.target.value ? onChange(rangeForMonth(e.target.value)) : onChange(rangeForPreset('all')))}
        >
          <option value="">Pick a month…</option>
          {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
      )}
      {isCustom && (
        <div className="date-custom">
          <label>From <input type="date" value={value.from || ''} onChange={(e) => onChange({ ...value, from: e.target.value || null })} /></label>
          <label>To <input type="date" value={value.to || ''} onChange={(e) => onChange({ ...value, to: e.target.value || null })} /></label>
        </div>
      )}
    </div>
  );
}
