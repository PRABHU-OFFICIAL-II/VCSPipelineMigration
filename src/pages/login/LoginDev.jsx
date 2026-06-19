import React, { useState } from "react";
import './Login.css';
import MainLogo from '../../assets/informatica-logo.png';
import HomePage from "../hompage/HomePage";
import ProgressStepper from '../../components/ProgressStepper';
import Toast from '../../components/Toast';
import SSOLoginPanel from '../../components/SSOLoginPanel';
import { useSessionPersist } from '../../utils/useSessionPersist';
import { ClipLoader } from 'react-spinners';
import { proxyFetch } from '../../utils/apiClient';

function LoginDev() {
    const { session, saveSession, clearSession } = useSessionPersist();

    const [username, setUsername]   = useState("");
    const [password, setPassword]   = useState("");
    const [regionURL, setRegionUrl] = useState("");
    const [errors, setErrors]       = useState({});
    const [loading, setLoading]     = useState(false);
    const [toast, setToast]         = useState(null);

    if (session) {
        return (
            <HomePage
                sessionId={session.sessionId}
                serverUrl={session.serverUrl}
                onLogout={clearSession}
            />
        );
    }

    const validateLogin = () => {
        const newErrors = {};
        if (!username.trim()) newErrors.username = "Username is required";
        if (!password.trim()) newErrors.password = "Password is required";
        if (!regionURL.trim()) newErrors.regionURL = "Region URL is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateLogin()) return;
        setLoading(true);
        setErrors({});
        const apiUrl = `${regionURL.replace(/\/$/, "")}/ma/api/v2/user/login`;
        try {
            const response = await proxyFetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                redirect: "follow",
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Login failed (${response.status}): ${text}`);
            }
            const data = await response.json();
            if (data?.icSessionId && data?.serverUrl) {
                saveSession(data.icSessionId, data.serverUrl);
                setToast({ message: 'Logged in successfully!', type: 'success' });
            } else {
                throw new Error("Session details missing in login response.");
            }
        } catch (error) {
            setErrors({ login: error.message });
            setToast({ message: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSSOSuccess = (userSession, serverUrl) => {
        saveSession(userSession, serverUrl);
        setToast({ message: 'SSO session verified — welcome!', type: 'success' });
    };

    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') action();
    };

    return (
        <>
            <ProgressStepper currentStep={0} />
            <div className="ld-wrapper">
                <div className="ld-card">

                    {/* ── Card header ── */}
                    <div className="ld-header">
                        <div className="ld-logo-pill">
                            <img src={MainLogo} alt="Informatica" className="ld-logo" />
                        </div>
                        <h1 className="ld-title">VCS Pipeline Migration</h1>
                        <p className="ld-tagline">Authenticate to continue to the source environment</p>
                        <span className="ld-env-badge">SOURCE · DEV</span>
                    </div>

                    <div className="ld-body">

                        {errors.login && (
                            <div className="ld-alert ld-alert--error">
                                <span className="ld-alert-icon">✗</span>
                                <span>{errors.login}</span>
                            </div>
                        )}

                        {/* ── Native login ── */}
                        <div className="ld-section-header">
                            <span className="ld-section-dot" />
                            Username &amp; Password
                        </div>

                        <div className="ld-field">
                            <label>Username <span className="ld-req">*</span></label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                                disabled={loading}
                                autoComplete="username"
                                placeholder="your@email.com"
                            />
                            {errors.username && <p className="ld-field-err">{errors.username}</p>}
                        </div>

                        <div className="ld-field">
                            <label>Password <span className="ld-req">*</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                                disabled={loading}
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                            {errors.password && <p className="ld-field-err">{errors.password}</p>}
                        </div>

                        <div className="ld-field">
                            <label>Region URL <span className="ld-req">*</span></label>
                            <input
                                type="text"
                                value={regionURL}
                                onChange={(e) => setRegionUrl(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                                disabled={loading}
                                placeholder="https://dm-us.informaticacloud.com"
                            />
                            {errors.regionURL && <p className="ld-field-err">{errors.regionURL}</p>}
                        </div>

                        <button className="ld-btn-primary" onClick={handleLogin} disabled={loading}>
                            {loading
                                ? <><ClipLoader color="#fff" size={15} /> Signing in…</>
                                : 'Log In →'
                            }
                        </button>

                        {/* ── Divider ── */}
                        <div className="ld-divider">
                            <span className="ld-divider-line" />
                            <span className="ld-divider-text">OR</span>
                            <span className="ld-divider-line" />
                        </div>

                        {/* ── SSO panel ── */}
                        <div className="ld-section-header ld-section-header--sso">
                            <span className="ld-section-dot ld-section-dot--teal" />
                            SSO / Federated Login
                        </div>

                        <div className="ld-sso-box">
                            <SSOLoginPanel
                                onSuccess={handleSSOSuccess}
                                accentColor="teal"
                            />
                        </div>

                    </div>
                </div>
            </div>

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </>
    );
}

export default LoginDev;
