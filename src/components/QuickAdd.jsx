import { useEffect, useRef, useState } from 'react';
import { QUICK_ADD, hrefFor } from '../lib/nav';

// Floating "+ Add" button with the four most common entries.
export default function QuickAdd({ role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const items = QUICK_ADD.filter((q) => q.roles.includes(role));

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div className="quick-add" ref={ref}>
      {open && (
        <div className="quick-menu" role="menu">
          <div className="quick-menu-title">Add new</div>
          {items.map((q) => (
            <a key={q.id} role="menuitem" className="quick-item" href={hrefFor(q.route, true)} onClick={() => setOpen(false)}>
              {q.label}
            </a>
          ))}
        </div>
      )}
      <button className="fab" aria-expanded={open} aria-label="Add new entry" onClick={() => setOpen((o) => !o)}>
        <span className="fab-plus" aria-hidden="true">{open ? '×' : '+'}</span>
        <span className="fab-label">Add</span>
      </button>
    </div>
  );
}
