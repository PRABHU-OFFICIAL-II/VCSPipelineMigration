import React, { useState } from "react";
import './Login.css';
import MainLogo from '../../assets/informatica-logo.png';
import HomePage from "../hompage/HomePage";

function LoginDev() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [regionURL, setRegionUrl] = useState("");
    const [podURL, setPodURL] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [errors, setErrors] = useState({});
    const [icSessionId, setIcSessionId] = useState("");
    const [serverUrl, setServerUrl] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSSOLogin, setIsSSOLogin] = useState(false);

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
    const handleLogin = () => {
        if (validateLogin()) {
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
                redirect: "follow",
                mode: "no-cors"
            };

            const apiUrl = `${regionURL.replace(/\/$/, "")}/ma/api/v2/user/login`;

            fetch(apiUrl, requestOptions)
                .then(async (response) => {
                    if (!response.ok) {
                        const text = await response.text();
                        throw new Error(`Login failed: ${response.status} - ${text}`);
                    }
                    return response.json(); // Parse the response as JSON
                })
                .then((data) => {
                    console.log("Login successful:", data);
                    if (data && data.icSessionId && data.serverUrl) {
                        setIcSessionId(data.icSessionId);
                        setServerUrl(data.serverUrl);
                        setIsLoggedIn(true);
                        console.log("icSessionId stored:", data.icSessionId);
                        console.log("Server Url stored :", data.serverUrl);

                    } else {
                        console.error("icSessionId not found in the login response.");
                        console.error("Server URL not found in the login response.");
                    }
                })
                .catch((error) => {
                    console.error("Login error:", error);
                    setErrors({ ...errors, login: error.message });
                });
        }
    };

    if (isLoggedIn) {
        return <HomePage sessionId={icSessionId} serverUrl={serverUrl} />;
    }

    if (isSSOLogin) {
        return <HomePage sessionId={sessionId} serverUrl={serverUrl} />;
    }

    // SSO Button Click Handler
    const handleSSOLogin = () => {
        if (validateSSO()) {
            console.log("Logging in with SSO:", { sessionId, podURL });
            setIcSessionId(sessionId);
            setServerUrl(`${podURL}/saas`);
            setIsSSOLogin(true);
        }
    };

    return (
        <div className="container">
            <div className="header">
                <img src={MainLogo} alt="Informatica Logo" className="logo" />
                <h2>Login to DEV Environment</h2>
            </div>

            {/* Native Login */}
            <div className="login-box-native">
                <div className="input-group">
                    <label>Username <span className="required">*</span></label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    {errors.username && <span className="error">{errors.username}</span>}
                </div>
                <div className="input-group">
                    <label>Password <span className="required">*</span></label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                    />
                    {errors.regionURL && <span className="error">{errors.regionURL}</span>}
                </div>
                <div className="button-group">
                    <button className="login-btn" onClick={handleLogin}>Log In</button>
                </div>
            </div>

            <div className="divider">
                <hr />
                <span>OR</span>
                <hr />
            </div>

            {/* SSO Login */}
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
                    <button className="sso-btn" onClick={handleSSOLogin}>Proceed to next action (SSO)</button>
                </div>
            </div>
        </div>
    );
}

export default LoginDev;