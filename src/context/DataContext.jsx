import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchAll, fetchTables, takeDirtyTables } from '../lib/api';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // reload() after a save only re-fetches the tables that were written to.
  // reload({ full: true }) (or the first load) fetches everything.
  const reload = useCallback(async (opts) => {
    try {
      const changed = takeDirtyTables();
      if (opts?.full || changed.length === 0) {
        const d = await fetchAll();
        setData(d);
      } else {
        const part = await fetchTables(changed);
        setData((prev) => ({ ...(prev || {}), ...part }));
      }
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    reload({ full: true });
  }, [reload]);

  return <DataContext.Provider value={{ data, error, reload }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
