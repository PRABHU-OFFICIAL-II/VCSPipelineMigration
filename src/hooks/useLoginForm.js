import { useState } from 'react';
import { proxyFetch } from '../utils/apiClient';

export function useLoginForm(onSuccess) {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [regionURL, setRegionUrl] = useState('');
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);

  const validate = () => {
    const e = {};
    if (!username.trim())  e.username  = 'Username is required';
    if (!password.trim())  e.password  = 'Password is required';
    if (!regionURL.trim()) e.regionURL = 'Region URL is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const apiUrl = `${regionURL.replace(/\/$/, '')}/ma/api/v2/user/login`;
    try {
      const response = await proxyFetch(apiUrl, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json' },
        body:     JSON.stringify({ username, password }),
        redirect: 'follow',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Login failed (${response.status}): ${text}`);
      }
      const data = await response.json();
      if (data?.icSessionId && data?.serverUrl) {
        onSuccess(data.icSessionId, data.serverUrl);
      } else {
        throw new Error('Session details missing in login response.');
      }
    } catch (err) {
      setErrors({ login: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e, fn) => { if (e.key === 'Enter') fn(); };

  return {
    username,  setUsername,
    password,  setPassword,
    regionURL, setRegionUrl,
    errors,    loading,
    handleLogin, handleKeyDown,
  };
}
