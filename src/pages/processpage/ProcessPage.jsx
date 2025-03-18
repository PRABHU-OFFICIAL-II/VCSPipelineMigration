import React from 'react';
import './ProcessPage.css'; // Import the CSS file

function ProcessPage({ selectedAssets, onGoBack }) {
  return (
    <div className="process-container">
      <h1 className="process-title">Processing Assets</h1>
      <div className="assets-list-container">
        {selectedAssets && selectedAssets.length > 0 ? (
          <ul className="assets-list">
            {selectedAssets.map((asset, index) => (
              <li key={index} className="assets-list-item">
                <strong>Name:</strong> {asset.name}
                <br />
                <strong>ID:</strong> {asset.id}
                <br />
                <strong>Type:</strong> {asset.type}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-assets-message">No assets selected for processing.</p>
        )}
      </div>
      {onGoBack && (
        <button onClick={onGoBack} className="go-back-button">
          Go Back
        </button>
      )}
    </div>
  );
}

export default ProcessPage;