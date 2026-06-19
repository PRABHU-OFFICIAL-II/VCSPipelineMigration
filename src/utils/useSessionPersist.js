import { useState } from 'react';

const SESSION_KEY = 'vcs_dev_session';

export function useSessionPersist() {
  const getStored = () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [session, setSessionState] = useState(getStored);

  const saveSession = (sessionId, serverUrl) => {
    const data = { sessionId, serverUrl };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
    setSessionState(data);
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionState(null);
  };

  return { session, saveSession, clearSession };
}
