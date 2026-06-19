import React, { useState } from "react";
import './LoginProd.css';
import MainLogo from '../../assets/informatica-logo.png';
import { ClipLoader } from 'react-spinners';
import { proxyFetch } from '../../utils/apiClient';

function LoginProd({ onLoginSuccess }) {
    const [username, setUsername]   = useState("");
    const [password, setPassword]   = useState("");
    const [regionURL, setRegionUrl] = useState("");
    const [podURL, setPodURL]       = useState("");
    const [sessionId, setSessionId] = useState("");
    const [errors, setErrors]       = useState({});
    const [loading, setLoading]     = useState(false);

    const validateLogin = () => {
        const e = {};
        if (!username.trim())  e.username  = "Username is required";
        if (!password.trim())  e.password  = "Password is required";
        if (!regionURL.trim()) e.regionURL = "Region URL is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateSSO = () => {
        const e = {};
        if (!sessionId.trim()) e.sessionId = "Session ID is required";
        if (!podURL.trim())    e.podURL    = "POD URL is required";
        setErrors(e);
        return Object.keys(e).length === 0;
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
                onLoginSuccess(data.icSessionId, data.serverUrl);
            } else {
                throw new Error("Session details missing in login response.");
            }
        } catch (error) {
            setErrors({ login: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSSOLogin = () => {
        if (!validateSSO()) return;
        onLoginSuccess(sessionId, `${podURL}/saas`);
    };

    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') action();
    };

    return (
        <div className="lp-wrap">

            {/* ── Gradient header ── */}
            <div className="lp-header">
                <div className="lp-logo-pill">
                    <img src={MainLogo} alt="Informatica" className="lp-logo" />
                </div>
                <h2 className="lp-title">VCS Pipeline Migration</h2>
                <p className="lp-tagline">Authenticate to continue to the target environment</p>
                <span className="lp-env-badge">TARGET · PROD</span>
            </div>

            <div className="lp-body">

                {errors.login && (
                    <div className="lp-alert">
                        <span className="lp-alert-icon">✗</span>
                        <span>{errors.login}</span>
                    </div>
                )}

                {/* ── Native login ── */}
                <div className="lp-section-label">
                    <span className="lp-dot" />
                    Username &amp; Password
                </div>

                <div className="lp-fields lp-fields--3col">
                    <div className="lp-field">
                        <label>Username <span className="lp-req">*</span></label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                            disabled={loading}
                            autoComplete="username"
                            placeholder="your@email.com"
                        />
                        {errors.username && <p className="lp-err">{errors.username}</p>}
                    </div>
                    <div className="lp-field">
                        <label>Password <span className="lp-req">*</span></label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                            disabled={loading}
                            autoComplete="current-password"
                            placeholder="••••••••"
                        />
                        {errors.password && <p className="lp-err">{errors.password}</p>}
                    </div>
                    <div className="lp-field">
                        <label>Region URL <span className="lp-req">*</span></label>
                        <input
                            type="text"
                            value={regionURL}
                            onChange={(e) => setRegionUrl(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                            disabled={loading}
                            placeholder="https://dm-us.informaticacloud.com"
                        />
                        {errors.regionURL && <p className="lp-err">{errors.regionURL}</p>}
                    </div>
                </div>

                <button className="lp-btn-primary" onClick={handleLogin} disabled={loading}>
                    {loading
                        ? <><ClipLoader color="#fff" size={14} /> Signing in…</>
                        : 'Log In to PROD →'
                    }
                </button>

                {/* ── Divider ── */}
                <div className="lp-divider">
                    <span className="lp-divider-line" />
                    <span className="lp-divider-text">OR</span>
                    <span className="lp-divider-line" />
                </div>

                {/* ── SSO ── */}
                <div className="lp-section-label lp-section-label--sso">
                    <span className="lp-dot lp-dot--teal" />
                    SSO / Session Token
                </div>

                <div className="lp-sso-box">
                    <div className="lp-fields lp-fields--2col">
                        <div className="lp-field">
                            <label>Session ID <span className="lp-req">*</span></label>
                            <input
                                type="text"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, handleSSOLogin)}
                                placeholder="icSessionId from SSO"
                            />
                            {errors.sessionId && <p className="lp-err">{errors.sessionId}</p>}
                        </div>
                        <div className="lp-field">
                            <label>POD URL <span className="lp-req">*</span></label>
                            <input
                                type="text"
                                value={podURL}
                                onChange={(e) => setPodURL(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, handleSSOLogin)}
                                placeholder="https://na2.dm-us.informaticacloud.com"
                            />
                            {errors.podURL && <p className="lp-err">{errors.podURL}</p>}
                        </div>
                    </div>
                    <button className="lp-btn-sso" onClick={handleSSOLogin}>
                        Proceed with SSO →
                    </button>
                </div>

            </div>
        </div>
    );
}

export default LoginProd;
