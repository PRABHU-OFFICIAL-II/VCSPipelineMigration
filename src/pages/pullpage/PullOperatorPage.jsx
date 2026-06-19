import React, { useState, useEffect, useRef } from 'react';
import LoginProd from '../loginprod/LoginProd';
import './PullOperatorPage.css';
import { useMigrationHistory } from '../../utils/useMigrationHistory';
import Toast from '../../components/Toast';
import { proxyFetch } from '../../utils/apiClient';

const POLL_INTERVAL = 4000;
const POLL_MAX_ATTEMPTS = 20;

const STATUS_META = {
  COMPLETED:   { color: '#28a745', bg: '#f0fff4', border: '#b7ebc8', label: 'Completed',   icon: '✓' },
  FAILED:      { color: '#dc3545', bg: '#fff5f5', border: '#f5c6cb', label: 'Failed',      icon: '✗' },
  WARNING:     { color: '#e67e22', bg: '#fff8f0', border: '#ffd59e', label: 'Warning',     icon: '⚠' },
  IN_PROGRESS: { color: '#007bff', bg: '#f0f7ff', border: '#b8daff', label: 'In Progress', icon: '↻' },
  INITIALIZED: { color: '#6f42c1', bg: '#f5f0ff', border: '#d4b8ff', label: 'Initialized', icon: '◎' },
  NOT_STARTED: { color: '#6c757d', bg: '#f8f9fa', border: '#dee2e6', label: 'Not Started', icon: '○' },
};

function getStatusMeta(state) {
  return STATUS_META[(state || '').toUpperCase().replace(/-/g, '_')] || STATUS_META.NOT_STARTED;
}

function StatusChip({ state, large }) {
  const meta = getStatusMeta(state);
  return (
    <span className={`status-chip ${large ? 'status-chip--large' : ''}`}
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
      {meta.icon}&nbsp;{state || '—'}
    </span>
  );
}

function PullOperatorPage({ framedPullRequest, onGoBack }) {
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [sessionId, setSessionId]     = useState('');
  const [serverUrl, setServerUrl]     = useState('');
  const [pullResult, setPullResult]   = useState(null);
  const [pullError, setPullError]     = useState('');
  const [pullLoading, setPullLoading] = useState(false);
  const [scaDetails, setScaDetails]   = useState(null);
  const [scaError, setScaError]       = useState('');
  const [scaLoading, setScaLoading]   = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [toast, setToast]             = useState(null);

  const { addEntry }   = useMigrationHistory();
  const pollRef        = useRef(null);
  const pollCountRef   = useRef(0);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleLoginSuccess = (sid, surl) => {
    setSessionId(sid);
    setServerUrl(surl);
    setIsLoggedIn(true);
    setToast({ message: 'Logged into PROD environment', type: 'success' });
  };

  const fetchScaDetails = async (actionId, sid, surl) => {
    try {
      const response = await proxyFetch(
        `${surl}/public/core/v3/sourceControlAction/${actionId}?expand=objects`,
        { method: 'GET', headers: { 'INFA-SESSION-ID': sid }, redirect: 'follow' }
      );
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        setScaDetails(json);
        const state = json?.status?.state?.toUpperCase();
        if (['COMPLETED', 'FAILED', 'WARNING'].includes(state)) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setScaLoading(false);
          addEntry({
            pullActionId: actionId,
            status: state,
            message: json?.status?.message || '',
            objectCount: json?.objects?.length || 0,
            commitHash: framedPullRequest?.commitHash,
          });
          const msgs = { COMPLETED: 'Migration completed successfully!', FAILED: 'Migration failed — see results below.', WARNING: 'Migration completed with warnings.' };
          const types = { COMPLETED: 'success', FAILED: 'error', WARNING: 'warning' };
          setToast({ message: msgs[state], type: types[state] });
        }
      } catch {
        setScaDetails({ raw: text });
        setScaLoading(false);
      }
    } catch (err) {
      setScaError('Error fetching migration status: ' + err.message);
      setScaLoading(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  };

  const handleStartPull = async () => {
    if (!sessionId || !serverUrl || !framedPullRequest) {
      setToast({ message: 'Session ID, Server URL, or Pull Request data is missing.', type: 'error' });
      return;
    }
    setPullLoading(true);
    setPullResult(null);
    setPullError('');
    setScaDetails(null);
    setScaError('');
    setScaLoading(false);
    pollCountRef.current = 0;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    try {
      const pullResponse = await proxyFetch(`${serverUrl}/public/core/v3/pull`, {
        method: 'POST',
        headers: { 'INFA-SESSION-ID': sessionId, 'Content-Type': 'application/json' },
        body: JSON.stringify(framedPullRequest),
        redirect: 'follow',
      });
      const text = await pullResponse.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      if (json) {
        setPullResult(json);
        if (json.pullActionId) {
          setScaLoading(true);
          setToast({ message: 'Pull initiated — monitoring migration status…', type: 'info' });
          pollRef.current = setInterval(() => {
            pollCountRef.current += 1;
            if (pollCountRef.current >= POLL_MAX_ATTEMPTS) {
              clearInterval(pollRef.current); pollRef.current = null;
              setScaLoading(false);
              setScaError(`Status polling timed out after ${POLL_MAX_ATTEMPTS} attempts.`);
              return;
            }
            fetchScaDetails(json.pullActionId, sessionId, serverUrl);
          }, POLL_INTERVAL);
          setTimeout(() => fetchScaDetails(json.pullActionId, sessionId, serverUrl), 3000);
        } else {
          setToast({ message: 'Pull initiated (no action ID returned)', type: 'warning' });
        }
      } else {
        setPullResult(text);
      }
    } catch (err) {
      setPullError(err.message);
      setToast({ message: err.message, type: 'error' });
    } finally {
      setPullLoading(false);
    }
  };

  const objectCount   = framedPullRequest?.objects?.length || 0;
  const specCount     = framedPullRequest?.objectSpecification?.length || 0;
  const isMigrating   = pullLoading || scaLoading;
  const isDone        = scaDetails && !scaLoading;
  const finalState    = scaDetails?.status?.state;
  const finalMeta     = getStatusMeta(finalState);

  const completedObjs = scaDetails?.objects?.filter(o => o.status?.state?.toUpperCase() === 'COMPLETED').length || 0;
  const failedObjs    = scaDetails?.objects?.filter(o => o.status?.state?.toUpperCase() === 'FAILED').length || 0;
  const warningObjs   = scaDetails?.objects?.filter(o => o.status?.state?.toUpperCase() === 'WARNING').length || 0;

  return (
    <div className="po-page">

      {/* ── Page header ── */}
      <div className="po-header">
        <div className="po-header-inner">
          <div>
            <h1 className="po-title">Execute Migration</h1>
            <p className="po-subtitle">
              Authenticate to the target environment and run the pull operation
            </p>
          </div>
          <button onClick={onGoBack} className="po-back-btn">← Back</button>
        </div>
      </div>

      <div className="po-body">

        {/* ── Step 1: Login ── */}
        <section className={`po-card po-card--login ${isLoggedIn ? 'po-card--done' : ''}`}>
          <div className="po-card-header">
            <span className="po-step-badge">1</span>
            <h2>Target Environment Login</h2>
            {isLoggedIn && <span className="po-check-badge">✓ Connected</span>}
          </div>
          {!isLoggedIn ? (
            <LoginProd onLoginSuccess={handleLoginSuccess} />
          ) : (
            <div className="po-connected-state">
              <div className="po-connected-icon">✓</div>
              <div>
                <p className="po-connected-title">Successfully authenticated</p>
                <p className="po-connected-sub">{serverUrl}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Step 2: Payload preview ── */}
        <section className="po-card">
          <div className="po-card-header">
            <span className="po-step-badge">2</span>
            <h2>Migration Payload</h2>
            <div className="po-payload-chips">
              <span className="po-chip po-chip--blue">{objectCount} object{objectCount !== 1 ? 's' : ''}</span>
              {specCount > 0 && <span className="po-chip po-chip--amber">{specCount} connection mapping{specCount !== 1 ? 's' : ''}</span>}
              <span className="po-chip po-chip--mono">{framedPullRequest?.commitHash?.substring(0, 10)}…</span>
            </div>
            <button className="po-toggle-btn" onClick={() => setPayloadOpen(v => !v)}>
              {payloadOpen ? 'Hide payload ▲' : 'Show payload ▼'}
            </button>
          </div>
          {payloadOpen && (
            <div className="po-payload-body">
              <pre><code>{JSON.stringify(framedPullRequest, null, 2)}</code></pre>
            </div>
          )}
        </section>

        {/* ── Step 3: Execute ── */}
        <section className="po-card">
          <div className="po-card-header">
            <span className="po-step-badge">3</span>
            <h2>Execute Pull</h2>
          </div>

          {!isLoggedIn && (
            <p className="po-locked-msg">Complete PROD login above to enable execution.</p>
          )}

          {isLoggedIn && !pullResult && !isMigrating && (
            <div className="po-execute-area">
              <p className="po-execute-hint">
                This will migrate <strong>{objectCount}</strong> object{objectCount !== 1 ? 's' : ''}
                {specCount > 0 ? ` and map ${specCount} connection${specCount !== 1 ? 's' : ''}` : ''} to the target environment.
              </p>
              <button onClick={handleStartPull} className="po-execute-btn">
                <span className="po-execute-btn-icon">⚡</span>
                Start Migration
              </button>
            </div>
          )}

          {pullLoading && (
            <div className="po-status-row po-status-row--running">
              <div className="po-spinner" />
              <span>Sending pull request…</span>
            </div>
          )}

          {pullResult && !pullLoading && (
            <div className="po-initiated-banner">
              <span className="po-initiated-icon">✓</span>
              <div>
                <p className="po-initiated-title">Pull request accepted</p>
                {pullResult.pullActionId && (
                  <p className="po-initiated-id">Action ID: <code>{pullResult.pullActionId}</code></p>
                )}
              </div>
            </div>
          )}

          {pullError && (
            <div className="po-error-banner">
              <span>✗</span>
              <div>
                <strong>Pull failed</strong>
                <p>{pullError}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Step 4: Live status ── */}
        {(scaLoading || scaDetails || scaError) && (
          <section className="po-card">
            <div className="po-card-header">
              <span className="po-step-badge">4</span>
              <h2>Migration Status</h2>
              {scaLoading && <div className="po-pulse-dot" />}
              {isDone && <StatusChip state={finalState} />}
            </div>

            {/* Polling */}
            {scaLoading && !scaDetails && (
              <div className="po-status-row po-status-row--polling">
                <div className="po-spinner" />
                <span>Polling every {POLL_INTERVAL / 1000}s — waiting for completion…</span>
              </div>
            )}

            {/* Results */}
            {scaDetails && (
              <>
                {/* Big status banner */}
                {finalState && (
                  <div className="po-result-banner" style={{ background: finalMeta.bg, borderColor: finalMeta.border }}>
                    <span className="po-result-icon" style={{ color: finalMeta.color }}>{finalMeta.icon}</span>
                    <div>
                      <p className="po-result-state" style={{ color: finalMeta.color }}>{finalState}</p>
                      {scaDetails.status?.message && (
                        <p className="po-result-msg">{scaDetails.status.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata grid */}
                <div className="po-meta-grid">
                  {scaDetails.id && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Action ID</span>
                      <code className="po-meta-value">{scaDetails.id}</code>
                    </div>
                  )}
                  {scaDetails.action && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Action</span>
                      <span className="po-meta-value">{scaDetails.action}</span>
                    </div>
                  )}
                  {scaDetails.startTime && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Started</span>
                      <span className="po-meta-value">{new Date(scaDetails.startTime).toLocaleString()}</span>
                    </div>
                  )}
                  {scaDetails.endTime && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Finished</span>
                      <span className="po-meta-value">{new Date(scaDetails.endTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Object summary pills */}
                {scaDetails.objects?.length > 0 && (
                  <div className="po-obj-summary">
                    <span className="po-obj-pill po-obj-pill--total">{scaDetails.objects.length} total</span>
                    {completedObjs > 0 && <span className="po-obj-pill po-obj-pill--ok">{completedObjs} completed</span>}
                    {warningObjs  > 0 && <span className="po-obj-pill po-obj-pill--warn">{warningObjs} warning</span>}
                    {failedObjs   > 0 && <span className="po-obj-pill po-obj-pill--fail">{failedObjs} failed</span>}
                  </div>
                )}

                {/* Object results table */}
                {scaDetails.objects?.length > 0 && (
                  <div className="po-table-wrap">
                    <table className="po-table">
                      <thead>
                        <tr>
                          <th style={{ width: 120 }}>Status</th>
                          <th>Path</th>
                          <th style={{ width: 140 }}>Type</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scaDetails.objects.map((obj, i) => {
                          const sm = getStatusMeta(obj.status?.state);
                          return (
                            <tr key={obj.target?.id || i} style={{ background: sm.bg }}>
                              <td>
                                <StatusChip state={obj.status?.state} />
                              </td>
                              <td className="po-path-cell">
                                {obj.target?.path?.join(' / ')}
                              </td>
                              <td>
                                <span className="po-type-chip">{obj.target?.type}</span>
                              </td>
                              <td className="po-msg-cell">{obj.status?.message || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {scaDetails.raw && (
                  <pre className="po-raw"><code>{scaDetails.raw}</code></pre>
                )}
              </>
            )}

            {scaError && (
              <div className="po-error-banner">
                <span>✗</span>
                <div>
                  <strong>Status polling error</strong>
                  <p>{scaError}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default PullOperatorPage;
