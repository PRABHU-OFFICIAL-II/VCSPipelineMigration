import React, { useState } from "react";
import "./ProcessPage.css"; // Make sure this is still imported

function ProcessPage({ selectedAssets, onGoBack }) {
  const [dependencies, setDependencies] = useState(null);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependenciesError, setDependenciesError] = useState("");
  const [pullRequestStatus, setPullRequestStatus] = useState(null);
  const [pullRequestLoading, setPullRequestLoading] = useState(false);
  const [pullRequestError, setPullRequestError] = useState("");
  const [pullStatus, setPullStatus] = useState(null);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullError, setPullError] = useState("");

  const handleRenderDependencies = async () => {
    setDependenciesLoading(true);
    setDependenciesError("");
    try {
      console.log("Calling API to render dependencies for:", selectedAssets);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const mockDependencies = {
        [selectedAssets[0]?.name || "Asset"]: ["DependencyA", "DependencyB"],
        [selectedAssets[1]?.name || "AnotherAsset"]: ["DependencyC"],
      };
      setDependencies(mockDependencies);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      setDependenciesError("Failed to fetch dependencies.");
    } finally {
      setDependenciesLoading(false);
    }
  };

  const handleCreatePullRequest = async () => {
    setPullRequestLoading(true);
    setPullRequestStatus(null);
    setPullRequestError("");
    try {
      console.log(
        "Calling API to create pull request with:",
        selectedAssets,
        dependencies
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockPullRequest = {
        id: "PR-123",
        url: "https://example.com/pull/123",
      };
      setPullRequestStatus(mockPullRequest);
    } catch (error) {
      console.error("Error creating pull request:", error);
      setPullRequestError("Failed to create pull request.");
    } finally {
      setPullRequestLoading(false);
    }
  };

  const handlePullChanges = async () => {
    setPullLoading(true);
    setPullStatus(null);
    setPullError("");
    try {
      console.log("Calling API to perform VCS pull");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setPullStatus("VCS pull operation completed successfully.");
    } catch (error) {
      console.error("Error performing VCS pull:", error);
      setPullError("Failed to perform VCS pull.");
    } finally {
      setPullLoading(false);
    }
  };

  return (
    <div className="process-container">
      <h1 className="process-title">Process Assets</h1>

      <div className="grid-container">
        <div className="row">
          <div className="grid-item">
            <h3 className="grid-item-title">Processed Objects</h3>
            {selectedAssets && selectedAssets.length > 0 ? (
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Asset Type</th>
                    <th>Asset ID</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAssets.map((asset) => (
                    <tr key={asset.id}>
                      {" "}
                      <td>{asset.name}</td>
                      <td>{asset.type}</td>
                      <td>{asset.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="status-message">No assets were processed.</p>
            )}
          </div>
          <div className="grid-item">
            <h3 className="grid-item-title">Render Dependencies</h3>
            <button
              onClick={handleRenderDependencies}
              className={`action-button ${
                dependenciesLoading ? "disabled-button" : ""
              }`}
              disabled={dependenciesLoading}
            >
              {dependenciesLoading ? "Rendering..." : "Render Dependencies"}
            </button>
            {dependenciesError && (
              <p className="status-message error-message">
                {dependenciesError}
              </p>
            )}
            {dependencies && (
              <p className="status-message">Dependencies rendered.</p>
            )}
          </div>
        </div>

        <div className="row">
          <div className="grid-item">
            <h3 className="grid-item-title">Frame Pull Request</h3>
            {pullRequestStatus ? (
              <p className="status-message">
                Pull Request Created:{" "}
                <a
                  href={pullRequestStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pullRequestStatus.id}
                </a>
              </p>
            ) : (
              <button
                onClick={handleCreatePullRequest}
                className={`action-button ${
                  pullRequestLoading || !dependencies ? "disabled-button" : ""
                }`}
                disabled={pullRequestLoading || !dependencies}
              >
                {pullRequestLoading ? "Creating PR..." : "Create Pull Request"}
              </button>
            )}
            {pullRequestError && (
              <p className="status-message error-message">{pullRequestError}</p>
            )}
            {!dependencies && !pullRequestError && (
              <p className="status-message">
                Please render dependencies first.
              </p>
            )}
          </div>
          <div className="grid-item">
            <h3 className="grid-item-title">Pulling - VCS Pull Operation</h3>
            {pullStatus ? (
              <p className="status-message">
                Pull operation completed: {pullStatus}
              </p>
            ) : (
              <button
                onClick={handlePullChanges}
                className={`action-button ${
                  pullLoading || !pullRequestStatus ? "disabled-button" : ""
                }`}
                disabled={pullLoading || !pullRequestStatus}
              >
                {pullLoading ? "Pulling Changes..." : "Pull Changes"}
              </button>
            )}
            {pullError && (
              <p className="status-message error-message">{pullError}</p>
            )}
            {!pullRequestStatus && !pullError && (
              <p className="status-message">
                Please create a pull request first.
              </p>
            )}
          </div>
        </div>
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
