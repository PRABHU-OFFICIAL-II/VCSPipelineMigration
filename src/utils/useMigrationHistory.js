import { useState, useEffect } from 'react';

const STORAGE_KEY = 'vcs_migration_history';
const MAX_ENTRIES = 50;

export function useMigrationHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // quota exceeded — silently ignore
    }
  }, [history]);

  const addEntry = (entry) => {
    setHistory((prev) => {
      const next = [{ ...entry, timestamp: new Date().toISOString() }, ...prev];
      return next.slice(0, MAX_ENTRIES);
    });
  };

  const clearHistory = () => setHistory([]);

  return { history, addEntry, clearHistory };
}
