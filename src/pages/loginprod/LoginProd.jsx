import React, { useState } from "react";
import './LoginProd.css';
import MainLogo from '../../assets/informatica-logo.png';

function LoginProd({ onLoginSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [regionURL, setRegionUrl] = useState("");
    const [podURL, setPodURL] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Validation function
    const validateLogin = () => {
        let newErrors = {};
        if (!username.trim()) newErrors.username = "Username is required";
        if (!password.trim()) newErrors.password = "Password is required";
        if (!regionURL.trim()) newErrors.regionURL = "Region URL is mandatory for Login";
        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const validateSSO = () => {
        let newErrors = {};
        if (!sessionId.trim()) newErrors.sessionId = "Session ID is required";
        if (!podURL.trim()) newErrors.podURL = "POD URL is mandatory for Login";
        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    // Login Button Click Handler
    const handleLogin = async () => {
        if (validateLogin()) {
            setLoading(true);
            setErrors({});
            console.log("Logging in with:", { username, password, regionURL });

            const myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/json");

            const raw = JSON.stringify({
                "username": username,
                "password": password
            });

            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: raw,
                redirect: "follow"
            };

            const apiUrl = `${regionURL.replace(/\/$/, "")}/ma/api/v2/user/login`;

            try {
                const response = await fetch(apiUrl, requestOptions);
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Login failed: ${response.status} - ${text}`);
                }
                const data = await response.json();
                console.log("Login successful:", data);
                if (data && data.icSessionId && data.serverUrl) {
                    onLoginSuccess(data.icSessionId, data.serverUrl);
                } else {
                    console.error("icSessionId or serverUrl not found in the login response.");
                    setErrors({ login: "Login successful, but session details are missing." });
                }
            } catch (error) {
                console.error("Login error:", error);
                setErrors({ login: error.message });
            } finally {
                setLoading(false);
            }
        }
    };

    // SSO Button Click Handler
    const handleSSOLogin = () => {
        if (validateSSO()) {
            console.log("Logging in with SSO:", { sessionId, podURL });
            onLoginSuccess(sessionId, `${podURL}/saas`);
        }
    };

    return (
        <div className="container">
            <div className="header">
                <img src={MainLogo} alt="Informatica Logo" className="logo" />
                <h2>Login to PROD Environment</h2>
            </div>

            {errors.login && <div className="error-message">{errors.login}</div>}

            {/* Native Login */}
            <div className="login-box-native">
                <div className="input-group">
                    <label>Username <span className="required">*</span></label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                    />
                    {errors.username && <span className="error">{errors.username}</span>}
                </div>
                <div className="input-group">
                    <label>Password <span className="required">*</span></label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />
                    {errors.password && <span className="error">{errors.password}</span>}
                </div>
                <div className="input-group">
                    <label>Region URL <span className="required">*</span></label>
                    <input
                        type="text"
                        placeholder="https://dm-us.informaticacloud.com"
                        value={regionURL}
                        onChange={(e) => setRegionUrl(e.target.value)}
                        disabled={loading}
                    />
                    {errors.regionURL && <span className="error">{errors.regionURL}</span>}
                </div>
                <div className="button-group">
                    <button className="login-btn" onClick={handleLogin} disabled={loading}>
                        {loading ? 'Logging In...' : 'Log In'}
                    </button>
                </div>
            </div>

            <div className="divider">
                <hr />
                <span>OR</span>
                <hr />
            </div>

            <div className="login-box-sso">
                <div className="input-group">
                    <label>For SSO, please put the Session Id <span className="required">*</span></label>
                    <input
                        type="text"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                    />
                    {errors.sessionId && <span className="error">{errors.sessionId}</span>}
                </div>
                <div className="input-group">
                    <label>POD URL <span className="required">*</span></label>
                    <input
                        type="text"
                        placeholder="https://na2.dm-us.informaticacloud.com"
                        value={podURL}
                        onChange={(e) => setPodURL(e.target.value)}
                    />
                    {errors.podURL && <span className="error">{errors.podURL}</span>}
                </div>
                <div className="sso-button">
                    <button className="sso-btn" onClick={handleSSOLogin}>Proceed with SSO</button>
                </div>
            </div>
        </div>
    );
}

export default LoginProd;