import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchAll } from '../lib/api';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const d = await fetchAll();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return <DataContext.Provider value={{ data, error, reload }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
