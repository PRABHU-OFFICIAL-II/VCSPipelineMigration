import React, { useState } from "react";
import './LoginProd.css';
import MainLogo from '../../assets/informatica-logo.png';
import { ClipLoader } from 'react-spinners';
import SSOLoginPanel from '../../components/SSOLoginPanel';
import { proxyFetch } from '../../utils/apiClient';

function LoginProd({ onLoginSuccess }) {
    const [username, setUsername]   = useState("");
    const [password, setPassword]   = useState("");
    const [regionURL, setRegionUrl] = useState("");
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

    const handleKeyDown = (e, fn) => { if (e.key === 'Enter') fn(); };

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

                {/* ── SSO panel ── */}
                <div className="lp-section-label lp-section-label--sso">
                    <span className="lp-dot lp-dot--teal" />
                    SSO / Federated Login
                </div>

                <div className="lp-sso-box">
                    <SSOLoginPanel
                        onSuccess={(userSession, serverUrl) => onLoginSuccess(userSession, serverUrl)}
                        accentColor="teal"
                    />
                </div>

            </div>
        </div>
    );
}

export default LoginProd;
