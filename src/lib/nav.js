// Sidebar structure. Sales, Settlements and Expenses stay as their own top-level
// items (not grouped); the rest are grouped into folding sections.
export const NAV = [
  { type: 'item', id: 'home', label: 'Home', roles: ['admin', 'viewer', 'ca'] },
  { type: 'item', id: 'sales', label: 'Sales', roles: ['admin', 'ca'] },
  { type: 'item', id: 'settlements', label: 'Settlements', roles: ['admin'] },
  { type: 'item', id: 'expenses', label: 'Expenses', roles: ['admin', 'ca'] },
  {
    type: 'group', id: 'make', label: 'Make',
    items: [
      { id: 'products', label: 'Products', roles: ['admin', 'viewer', 'ca'] },
      { id: 'materials', label: 'Raw Materials', roles: ['admin', 'ca'] },
      { id: 'production', label: 'Production Log', roles: ['admin', 'ca'] },
      { id: 'qualitycheck', label: 'Quality Check', roles: ['admin', 'ca'] },
    ],
  },
  {
    type: 'group', id: 'stock', label: 'Stock',
    items: [
      { id: 'stock', label: 'Stock', roles: ['admin', 'ca'] },
      { id: 'inward', label: 'Inward / Returns', roles: ['admin', 'ca'] },
      { id: 'outward', label: 'Outward', roles: ['admin', 'ca'] },
      { id: 'stockcheck', label: 'Stock Check', roles: ['admin', 'ca'] },
    ],
  },
  {
    type: 'group', id: 'people', label: 'Customers & Planning',
    items: [
      { id: 'customers', label: 'Customer Details', roles: ['admin'] },
      { id: 'store', label: 'Store Planning', roles: ['admin', 'ca'] },
    ],
  },
];

export function navForRole(role) {
  return NAV.map((n) => {
    if (n.type === 'item') return n.roles.includes(role) ? n : null;
    const items = n.items.filter((i) => i.roles.includes(role));
    return items.length ? { ...n, items } : null;
  }).filter(Boolean);
}

export function allowedRoutes(role) {
  const out = [];
  navForRole(role).forEach((n) => (n.type === 'item' ? out.push(n.id) : n.items.forEach((i) => out.push(i.id))));
  return out;
}

export function labelFor(route) {
  for (const n of NAV) {
    if (n.type === 'item' && n.id === route) return n.label;
    if (n.type === 'group') {
      const hit = n.items.find((i) => i.id === route);
      if (hit) return hit.label;
    }
  }
  return 'Home';
}

// Quick-add shortcuts: page to open + who can use it.
export const QUICK_ADD = [
  { id: 'sale', label: 'Sale', route: 'sales', roles: ['admin', 'ca'] },
  { id: 'expense', label: 'Expense', route: 'expenses', roles: ['admin', 'ca'] },
  { id: 'production', label: 'Production', route: 'production', roles: ['admin', 'ca'] },
  { id: 'return', label: 'Return / Inward', route: 'inward', roles: ['admin', 'ca'] },
];

// Pages that can show both brands together. Every other page needs one brand picked.
export const COMBINED_OK = ['home', 'expenses'];

// ---- Hash routing: #/sales, #/sales?add=1 ----
export function readHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  return { route: path || 'home', add: /(^|&)add=1/.test(query || '') };
}
export function hrefFor(route, add = false) {
  return `#/${route}${add ? '?add=1' : ''}`;
}
