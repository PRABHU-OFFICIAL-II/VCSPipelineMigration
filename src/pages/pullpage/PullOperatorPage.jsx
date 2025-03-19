// PullOperatorPage.js
import React from 'react';

function PullOperatorPage({ framedPullRequest, onGoBack }) {
  return (
    <div className="pull-operator-container">
      <h1>Pull Rendering</h1>

      <h2>Framed Pull Request Data:</h2>
      {framedPullRequest ? (
        <div className="framed-data-display">
          <pre>
            <code>
              {JSON.stringify(framedPullRequest, null, 2)}
            </code>
          </pre>
        </div>
      ) : (
        <p>No framed pull request data received.</p>
      )}

      {onGoBack && (
        <button onClick={onGoBack} className="go-back-button">
          Go Back
        </button>
      )}

    </div>
  );
}

export default PullOperatorPage;