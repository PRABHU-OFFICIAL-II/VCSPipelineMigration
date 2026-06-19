import React, { useState, useEffect, useRef } from 'react';
import './SSOLoginPanel.css';
import { proxyFetch } from '../utils/apiClient';
import { ClipLoader } from 'react-spinners';

const STEP = { SETUP: 0, WAITING: 1, PASTE: 2, SUCCESS: 3 };

function StepBubbles({ current }) {
  const labels = ['Launch', 'Login', 'Verify'];
  return (
    <div className="sso-steps">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`sso-bubble-wrap ${i < current ? 'sso-bubble-wrap--done' : i === current ? 'sso-bubble-wrap--active' : ''}`}>
            <div className="sso-bubble">
              {i < current ? '✓' : i + 1}
            </div>
            <span className="sso-bubble-label">{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div className={`sso-step-line ${i < current ? 'sso-step-line--done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function SSOLoginPanel({ onSuccess, accentColor = 'blue' }) {
  const [step, setStep]             = useState(STEP.SETUP);
  const [podURL, setPodURL]         = useState('');
  const [userSession, setUserSession] = useState('');
  const [userInfo, setUserInfo]     = useState(null);
  const [error, setError]           = useState('');
  const [podError, setPodError]     = useState('');
  const [validating, setValidating] = useState(false);
  const popupRef = useRef(null);
  const pollRef  = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  const handleLaunch = () => {
    if (!podURL.trim()) { setPodError('POD URL is required'); return; }
    setPodError('');
    setError('');

    const url = podURL.replace(/\/$/, '');
    const popup = window.open(url, 'infa-sso', 'width=1000,height=680,scrollbars=yes,resizable=yes,toolbar=no');

    if (!popup || popup.closed) {
      setError('Popup was blocked. Allow popups for this site in your browser settings and try again.');
      return;
    }

    popupRef.current = popup;
    setStep(STEP.WAITING);

    pollRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setStep(STEP.PASTE);
      }
    }, 500);
  };

  const handleValidate = async () => {
    if (!userSession.trim()) { setError('Paste your USER_SESSION cookie value first'); return; }
    setError('');
    setValidating(true);

    const base = podURL.replace(/\/$/, '');
    try {
      const response = await proxyFetch(
        `${base}/ma/api/v2/user/getSessionUser`,
        { method: 'GET', headers: { 'icSessionId': userSession.trim() }, redirect: 'follow' }
      );
      if (!response.ok) throw new Error(`Session rejected by server (HTTP ${response.status}) — make sure you copied the USER_SESSION cookie correctly`);
      let data = null;
      try { data = await response.json(); } catch { /* non-JSON body is fine, session still valid */ }
      setUserInfo(data);
      setStep(STEP.SUCCESS);
      setTimeout(() => onSuccess(userSession.trim(), `${base}/saas`), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStep(STEP.SETUP);
    setPodURL('');
    setUserSession('');
    setUserInfo(null);
    setError('');
    setPodError('');
  };

  const handleKeyDown = (e, fn) => { if (e.key === 'Enter') fn(); };

  const cls = `sso-panel sso-panel--${accentColor}`;

  return (
    <div className={cls}>
      <StepBubbles current={step} />

      {error && (
        <div className="sso-alert">
          <span className="sso-alert-icon">✗</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 0: Enter POD URL + Launch ── */}
      {step === STEP.SETUP && (
        <div className="sso-step-content">
          <p className="sso-hint">
            Enter your Informatica POD URL and click <strong>Launch SSO</strong>. A browser window will open where you can complete your organisation's SSO login (Okta, Azure AD, Ping, etc.).
          </p>
          <div className="sso-field">
            <label>Informatica POD URL <span className="sso-req">*</span></label>
            <input
              type="text"
              value={podURL}
              onChange={e => { setPodURL(e.target.value); setPodError(''); }}
              onKeyDown={e => handleKeyDown(e, handleLaunch)}
              placeholder="https://na2.dm-us.informaticacloud.com"
            />
            {podError && <p className="sso-field-err">{podError}</p>}
          </div>
          <button className="sso-launch-btn" onClick={handleLaunch}>
            <span className="sso-launch-icon">↗</span> Launch SSO Login
          </button>
        </div>
      )}

      {/* ── Step 1: Popup open, waiting ── */}
      {step === STEP.WAITING && (
        <div className="sso-step-content sso-step-content--center">
          <div className="sso-waiting-ring">
            <ClipLoader color="var(--sso-accent)" size={36} />
          </div>
          <p className="sso-waiting-title">Complete your SSO login</p>
          <p className="sso-waiting-sub">
            A popup window has opened — sign in with your organisation credentials. This panel will advance automatically once the popup closes.
          </p>
          <button className="sso-link-btn" onClick={() => { if (popupRef.current && !popupRef.current.closed) popupRef.current.focus(); }}>
            Bring popup to front ↗
          </button>
          <button className="sso-text-btn" onClick={() => setStep(STEP.PASTE)}>
            Already logged in? Skip →
          </button>
        </div>
      )}

      {/* ── Step 2: Paste USER_SESSION ── */}
      {step === STEP.PASTE && (
        <div className="sso-step-content">
          <div className="sso-guide">
            <p className="sso-guide-title">Copy your <code>USER_SESSION</code> cookie</p>
            <ol className="sso-guide-steps">
              <li>In the popup (or any tab logged into Informatica), press <kbd>F12</kbd> to open DevTools</li>
              <li>Go to <strong>Application</strong> → <strong>Cookies</strong> → select the Informatica domain</li>
              <li>Find the cookie named <code>USER_SESSION</code></li>
              <li>Copy its <strong>Value</strong> column and paste it below</li>
            </ol>
          </div>

          <div className="sso-field">
            <label>USER_SESSION value <span className="sso-req">*</span></label>
            <textarea
              className="sso-token-input"
              value={userSession}
              onChange={e => { setUserSession(e.target.value); setError(''); }}
              placeholder="Paste the full USER_SESSION cookie value here…"
              rows={3}
              spellCheck={false}
            />
          </div>

          <div className="sso-paste-actions">
            <button className="sso-verify-btn" onClick={handleValidate} disabled={validating || !userSession.trim()}>
              {validating
                ? <><ClipLoader color="#fff" size={14} /> Verifying…</>
                : '✓ Verify Session'
              }
            </button>
            <button className="sso-text-btn" onClick={handleReset}>← Start over</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === STEP.SUCCESS && (
        <div className="sso-step-content sso-step-content--center">
          <div className="sso-success-icon">✓</div>
          <p className="sso-success-title">Session verified!</p>
          {userInfo && (
            <div className="sso-user-card">
              <span className="sso-user-avatar">
                {(userInfo.name || userInfo.firstName || '?')[0].toUpperCase()}
              </span>
              <div>
                <p className="sso-user-name">{userInfo.name || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown user'}</p>
                {(userInfo.emails?.[0]?.address || userInfo.email) && (
                  <p className="sso-user-email">{userInfo.emails?.[0]?.address || userInfo.email}</p>
                )}
                {userInfo.orgName && <p className="sso-user-org">{userInfo.orgName}</p>}
              </div>
            </div>
          )}
          <p className="sso-success-sub">Proceeding automatically…</p>
        </div>
      )}
    </div>
  );
}

export default SSOLoginPanel;
