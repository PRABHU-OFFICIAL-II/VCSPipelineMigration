import React, { useState } from "react";
import './login.css';
import MainLogo from '../../assets/informatica-logo.png';

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [errors, setErrors] = useState({});

    // Validation function
    const validateLogin = () => {
        let newErrors = {};
        if (!username.trim()) newErrors.username = "Username is required";
        if (!password.trim()) newErrors.password = "Password is required";
        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const validateSSO = () => {
        let newErrors = {};
        if (!sessionId.trim()) newErrors.sessionId = "Session ID is required";
        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    // Login Button Click Handler
    const handleLogin = () => {
        if (validateLogin()) {
            console.log("Logging in with:", { username, password });
            // Call API or perform login logic here
        }
    };

    // SSO Button Click Handler
    const handleSSOLogin = () => {
        if (validateSSO()) {
            console.log("Logging in with SSO:", { sessionId });
            // Call API or perform SSO login logic here
        }
    };

    return (
        <div className="container">
            <div className="header">
                <img src={MainLogo} alt="Informatica Logo" className="logo" />
                <h2>Welcome to IDMC VCS Pipeline Migration Interface</h2>
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
                <div className="button-group">
                    <button className="login-btn" onClick={handleLogin}>Log In</button>
                </div>
            </div>

            {/* Divider */}
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
                <div className="sso-button">
                    <button className="sso-btn" onClick={handleSSOLogin}>Log in using Single Sign-On (SSO)</button>
                </div>
            </div>
        </div>
    );
}

export default Login;
