import React, { useState } from 'react';
import LoginProd from '../loginprod/LoginProd';
import './PullOperatorPage.css';

function PullOperatorPage({ framedPullRequest, onGoBack }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [pullResult, setPullResult] = useState(null);
    const [pullError, setPullError] = useState('');
    const [pullLoading, setPullLoading] = useState(false);
    const [sourceControlActionDetails, setSourceControlActionDetails] = useState(null);
    const [sourceControlActionError, setSourceControlActionError] = useState('');
    const [sourceControlActionLoading, setSourceControlActionLoading] = useState(false);
    const [showScaDetailsAfterDelay, setShowScaDetailsAfterDelay] = useState(false);
    const [delayLoading, setDelayLoading] = useState(false);

    const handleLoginSuccess = (sessionIdFromLogin, serverUrlFromLogin) => {
        setSessionId(sessionIdFromLogin);
        setServerUrl(serverUrlFromLogin);
        setIsLoggedIn(true);
    };

    const handleStartPullAndGetStatus = async () => {
        if (!sessionId || !serverUrl || !framedPullRequest) {
            alert('Session ID, Server URL, or Framed Pull Request data is missing.');
            return;
        }

        setPullLoading(true);
        setPullResult(null);
        setPullError('');
        setSourceControlActionDetails(null);
        setSourceControlActionError('');
        setSourceControlActionLoading(true);
        setShowScaDetailsAfterDelay(false);
        setDelayLoading(false);

        const myHeaders = new Headers();
        myHeaders.append("INFA-SESSION-ID", sessionId);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify(framedPullRequest);

        const pullRequestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        try {
            const pullResponse = await fetch(`${serverUrl}/public/core/v3/pull`, pullRequestOptions);
            const pullResultText = await pullResponse.text();
            let pullResultJSON;
            try {
                pullResultJSON = JSON.parse(pullResultText);
                setPullResult(pullResultJSON);

                // Fetch source control action details after a delay
                if (pullResultJSON && pullResultJSON.pullActionId) {
                    setDelayLoading(true);
                    setTimeout(async () => {
                        const scaHeaders = new Headers();
                        scaHeaders.append("INFA-SESSION-ID", sessionId);

                        const scaRequestOptions = {
                            method: "GET",
                            headers: scaHeaders,
                            redirect: "follow"
                        };

                        try {
                            const scaResponse = await fetch(
                                `${serverUrl}/public/core/v3/sourceControlAction/${pullResultJSON.pullActionId}?expand=objects`,
                                scaRequestOptions
                            );
                            const scaResultText = await scaResponse.text();
                            try {
                                const scaResultJSON = JSON.parse(scaResultText);
                                setSourceControlActionDetails(scaResultJSON);
                            } catch (e) {
                                setSourceControlActionError('Error parsing Source Control Action details.');
                                console.error('Error parsing Source Control Action details:', e);
                                setSourceControlActionDetails({ raw: scaResultText });
                            }
                        } catch (error) {
                            setSourceControlActionError('Error fetching Source Control Action details.');
                            console.error('Error fetching Source Control Action details:', error);
                        } finally {
                            setSourceControlActionLoading(false);
                            setShowScaDetailsAfterDelay(true);
                            setDelayLoading(false);
                        }
                    }, 10000);
                } else {
                    setSourceControlActionLoading(false);
                }
            } catch {
                setPullResult(pullResultText);
                setSourceControlActionLoading(false);
                setDelayLoading(false);
            }
        } catch (error) {
            console.error(error);
            setPullError(error.message);
            setSourceControlActionLoading(false);
            setDelayLoading(false);
        } finally {
            setPullLoading(false);
        }
    };

    return (
        <div className="pull-operator-container">
            <h1>Pull Operator</h1>

            <div className="pull-operator-content">
                {!isLoggedIn ? (
                    <LoginProd onLoginSuccess={handleLoginSuccess} />
                ) : null}

                <div className="pull-actions-container">
                    <h2>Pull Actions</h2>
                    {isLoggedIn && framedPullRequest && (
                        <div className="framed-data-display">
                            <h3>Framed Pull Request Data:</h3>
                            <pre>
                                <code>{JSON.stringify(framedPullRequest, null, 2)}</code>
                            </pre>
                        </div>
                    )}

                    {isLoggedIn && framedPullRequest && (
                        <button onClick={handleStartPullAndGetStatus} disabled={pullLoading || sourceControlActionLoading || delayLoading}>
                            {pullLoading || sourceControlActionLoading || delayLoading ? 'Processing...' : 'Start Pull and Get Status'}
                        </button>
                    )}

                    <div className="pull-status-container">
                        {pullResult && (
                            <div className="pull-result">
                                <strong>Pull Status:</strong>
                                {typeof pullResult === 'object' && pullResult !== null ? (
                                    <div className="pull-status-details">
                                        {pullResult.pullActionId && (
                                            <p><strong>Pull Action ID:</strong> {pullResult.pullActionId}</p>
                                        )}
                                        {pullResult.status && (
                                            <div className="status-info">
                                                <p>
                                                    <strong>State:</strong>{' '}
                                                    <span
                                                        className={`status-state ${pullResult.status.state
                                                            .toLowerCase()
                                                            .replace(/_/g, '-')}`}
                                                    >
                                                        {pullResult.status.state}
                                                    </span>
                                                </p>
                                                {pullResult.status.message && (
                                                    <p>
                                                        <strong>Message:</strong> {pullResult.status.message}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <pre>{pullResult}</pre>
                                )}
                            </div>
                        )}
                        {pullError && <div className="error-message"><strong>Pull Error:</strong> {pullError}</div>}
                    </div>

                    <div className="source-control-action-details-container">
                        {delayLoading && !sourceControlActionError && !sourceControlActionDetails && (
                            <div className="progress-indicator">
                                <p>Fetching Source Control Action Details in <span id="countdown">10</span> seconds...</p>
                                {/* You can add a visual spinner here if you have one */}
                            </div>
                        )}

                        {!delayLoading && showScaDetailsAfterDelay && sourceControlActionDetails && (
                            <div className="source-control-action-details">
                                <strong>Source Control Action Details:</strong>
                                <p><strong>Pull Action ID:</strong> {sourceControlActionDetails.id}</p>
                                <p><strong>Action:</strong> {sourceControlActionDetails.action}</p>
                                <p><strong>Start Time:</strong> {new Date(sourceControlActionDetails.startTime).toLocaleString()}</p>
                                <p><strong>End Time:</strong> {new Date(sourceControlActionDetails.endTime).toLocaleString()}</p>
                                {sourceControlActionDetails.status && (
                                    <div className="status-info">
                                        <p>
                                            <strong>Status:</strong>{' '}
                                            <span
                                                className={`status-state ${sourceControlActionDetails.status.state
                                                    .toLowerCase()
                                                    .replace(/_/g, '-')}`}
                                            >
                                                {sourceControlActionDetails.status.state}
                                            </span>
                                        </p>
                                        {sourceControlActionDetails.status.message && (
                                            <p>
                                                <strong>Message:</strong> {sourceControlActionDetails.status.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {sourceControlActionDetails.objects && sourceControlActionDetails.objects.length > 0 && (
                                    <div className="objects-details">
                                        <strong>Objects:</strong>
                                        <ul>
                                            {sourceControlActionDetails.objects.map((obj) => (
                                                <li key={obj.target.id}>
                                                    <p><strong>Path:</strong> {obj.target.path.join(' > ')}</p>
                                                    <p><strong>Type:</strong> {obj.target.type}</p>
                                                    <p>
                                                        <strong>State:</strong>{' '}
                                                        <span
                                                            className={`status-state ${obj.status.state
                                                                .toLowerCase()
                                                                .replace(/_/g, '-')}`}
                                                        >
                                                            {obj.status.state}
                                                        </span>
                                                    </p>
                                                    <p><strong>Message:</strong> {obj.status.message}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {sourceControlActionDetails.raw && (
                                    <pre>
                                        <code>{sourceControlActionDetails.raw}</code>
                                    </pre>
                                )}
                            </div>
                        )}
                        {sourceControlActionError && (
                            <div className="error-message">
                                <strong>Source Control Action Error:</strong> {sourceControlActionError}
                            </div>
                        )}
                    </div>

                    {onGoBack && (
                        <button onClick={onGoBack} className="go-back-button">
                            Go Back
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PullOperatorPage;