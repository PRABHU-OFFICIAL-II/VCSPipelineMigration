import React, { useState, useEffect } from "react";
import PullOperatorPage from "../pullpage/PullOperatorPage";
import "./ProcessPage.css";
import { formatJSONWithHighlighting } from "../../utils/formatJSONWithHighlighting";

function ProcessPage({ selectedAssets, sessionId, serverUrl, onGoBack }) {
  const [dependencies, setDependencies] = useState({});
  const [dependenciesLoading, setDependenciesLoading] = useState({});
  const [dependenciesError, setDependenciesError] = useState({});
  const [allDependenciesLoaded, setAllDependenciesLoaded] = useState(false);
  const [commitHash, setCommitHash] = useState("");
  const [framedPullRequestData, setFramedPullRequestData] = useState(null);
  const [commitHashError, setCommitHashError] = useState("");
  const [isPullOperatorVisible, setIsPullOperatorVisible] = useState(false);

  const [commitHistory, setCommitHistory] = useState([]);
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const [commitHistoryError, setCommitHistoryError] = useState("");
  const [hasFetchedCommitHistory, setHasFetchedCommitHistory] = useState(false);

  // State for manual editing
  const [isEditingFramedData, setIsEditingFramedData] = useState(false);
  const [editableFramedData, setEditableFramedData] = useState("");

  const allowedTypes = new Set([
    "DTEMPLATE",
    "MAPPING",
    "MTT",
    "DSS",
    "DMASK",
    "DRS",
    "DMAPPLET",
    "MAPPLET",
    "BSERVICE",
    "HSCHEMA",
    "PCS",
    "FWCONFIG",
    "CUSTOMSOURCE",
    "MI_TASK",
    "WORKFLOW",
    "TASKFLOW",
    "UDF",
    "MCT",
    "SAAS_CONNECTION", // Keep SAAS_CONNECTION for dependency fetching, as it's still needed for objectSpecification
    // Removed "SAAS_RUNTIME_ENVIRONMENT" from allowedTypes for dependency fetching
  ]);

  // Effect to update editableFramedData when framedPullRequestData changes
  useEffect(() => {
    if (framedPullRequestData) {
      setEditableFramedData(JSON.stringify(framedPullRequestData, null, 2));
    } else {
      setEditableFramedData("");
    }
  }, [framedPullRequestData]);

  const handleGetCommitHistory = async () => {
    setCommitHistoryLoading(true);
    setCommitHistoryError("");
    setCommitHistory([]);
    setHasFetchedCommitHistory(true);

    if (!selectedAssets || selectedAssets.length === 0 || !selectedAssets[0].name) {
      setCommitHistoryError("No selected assets or missing asset path to fetch commit history.");
      setCommitHistoryLoading(false);
      return;
    }

    const projectPath = selectedAssets[0].name.split('/')[0];

    if (!sessionId || !serverUrl || !projectPath) {
      setCommitHistoryError("Missing session ID, server URL, or project path to fetch commit history.");
      setCommitHistoryLoading(false);
      return;
    }

    const myHeaders = new Headers();
    myHeaders.append("INFA-SESSION-ID", sessionId);

    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };

    try {
      const response = await fetch(
        `${serverUrl}/public/core/v3/commitHistory?q=path=='${projectPath}'`,
        requestOptions
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`
        );
      }
      const result = await response.json();
      setCommitHistory(result.commits || []);
    } catch (error) {
      console.error("Error fetching commit history:", error);
      setCommitHistoryError(error.message);
    } finally {
      setCommitHistoryLoading(false);
    }
  };

  const handleSelectCommit = (hash) => {
    setCommitHash(hash);
  };

  const handleRenderDependencies = async () => {
    setDependencies({});
    setDependenciesLoading({});
    setDependenciesError({});
    setAllDependenciesLoaded(false);

    if (!selectedAssets || selectedAssets.length === 0) {
      return;
    }

    const allFetchedDependencies = {};
    const queue = [
      ...selectedAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        level: 0,
      })),
    ];
    const visited = new Set(selectedAssets.map((asset) => asset.id));
    const maxLevels = 5;

    while (queue.length > 0) {
      const current = queue.shift();
      const { id, name, type, level } = current;

      if (level > maxLevels) {
        console.warn(
          `Reached maximum dependency level (${maxLevels}) for asset ${name} (${id}). Further dependencies might not be fetched.`
        );
        continue;
      }

      setDependenciesLoading((prev) => ({ ...prev, [id]: true }));
      setDependenciesError((prev) => ({ ...prev, [id]: "" }));

      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      try {
        const response = await fetch(
          `${serverUrl}/public/core/v3/objects/${id}/references?refType=Uses`,
          requestOptions
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, body: ${errorText}`
          );
        }
        const result = await response.json();
        const references = result.references.map((ref) => ({
          path: ref.path,
          documentType: ref.documentType,
          id: ref.id,
        }));

        if (!allFetchedDependencies[id]) {
          allFetchedDependencies[id] = {
            parent: { name: name, type: type, id: id },
            references: [],
          };
        }

        // Filter references based on allowedTypes set
        const filteredReferences = references.filter((ref) =>
          allowedTypes.has(ref.documentType.toUpperCase())
        );
        allFetchedDependencies[id].references.push(...filteredReferences);

        filteredReferences.forEach((ref) => {
          if (!visited.has(ref.id)) {
            visited.add(ref.id);
            queue.push({
              id: ref.id,
              name: ref.path.split("/").pop(),
              type: ref.documentType, // This is documentType from API
              level: level + 1,
            });
          }
        });
      } catch (error) {
        console.error(
          `Error fetching dependencies for ${name} (${id}):`,
          error
        );
        setDependenciesError((prev) => ({ ...prev, [id]: error.message }));
      } finally {
        setDependenciesLoading((prev) => ({ ...prev, [id]: false }));
      }
    }

    const uniqueDependencies = {};
    for (const parentId in allFetchedDependencies) {
      const uniqueRefs = [];
      const seenRefIds = new Set();
      for (const ref of allFetchedDependencies[parentId].references) {
        if (!seenRefIds.has(ref.id)) {
          uniqueRefs.push(ref);
          seenRefIds.add(ref.id);
        }
      }
      uniqueDependencies[parentId] = {
        ...allFetchedDependencies[parentId],
        references: uniqueRefs,
      };
    }

    setDependencies(uniqueDependencies);
    setAllDependenciesLoaded(true);
  };

  const handleFramePullRequest = () => {
    if (!commitHash) {
      setCommitHashError("Commit Hash is mandatory.");
      return;
    }
    setCommitHashError("");
    setIsEditingFramedData(false); // Disable editing when framing new data

    const objectsToInclude = [];
    const objectSpecifications = []; // New array for objectSpecification

    // Collect all unique assets from selectedAssets and dependencies
    const allAssetsRaw = [
      ...selectedAssets,
      // Dependencies: map ref.documentType to 'type' for consistent access
      ...Object.values(dependencies).flatMap((depInfo) =>
        depInfo.references.map(ref => ({
          id: ref.id,
          name: ref.path,
          type: ref.documentType, // Use documentType from API for 'type'
        }))
      ),
    ];

    const uniqueAssets = new Map();
    allAssetsRaw.forEach(asset => {
      // Prioritize selectedAssets if there's an ID conflict
      if (asset && asset.id && !uniqueAssets.has(asset.id)) {
        uniqueAssets.set(asset.id, asset);
      } else if (!asset || !asset.id) {
        console.warn("Skipping asset during uniqueAssets population due to missing ID:", asset);
      }
    });

    // Manually add SAAS_RUNTIME_ENVIRONMENT if selected initially,
    // as it's not fetched via dependencies now.
    // This assumes SAAS_RUNTIME_ENVIRONMENT will always be part of selectedAssets
    // or known by other means if it's not a dependency.
    selectedAssets.forEach(asset => {
        if (asset.type && asset.type.toUpperCase() === "SAAS_RUNTIME_ENVIRONMENT") {
            const assetPathArray = Array.isArray(asset.name) ? asset.name : asset.name.split("/");
            objectSpecifications.push({
                source: {
                    path: assetPathArray,
                    type: "AgentGroup",
                },
                target: {
                    path: ["<target_runtime_environment_name>"],
                    type: "AgentGroup",
                },
            });
            // Remove from uniqueAssets so it's not processed again in the main loop
            uniqueAssets.delete(asset.id);
        }
    });

    uniqueAssets.forEach((asset) => {
      // CRITICAL: Add a direct check for asset.type before using it
      if (!asset || !asset.type) {
        console.error("Skipping asset in framing due to missing 'type' property:", asset);
        return; // Skip this iteration if asset or asset.type is undefined/null
      }

      const assetTypeUpper = asset.type.toUpperCase();
      const assetPathArray = Array.isArray(asset.name)
        ? asset.name
        : (typeof asset.name === 'string' ? asset.name.split("/") : []);

      if (assetTypeUpper === "SAAS_CONNECTION") {
        objectSpecifications.push({
          source: {
            path: assetPathArray,
            type: "Connection",
          },
          target: {
            path: ["<target_connection_name>"], // Placeholder as requested
            type: "Connection",
          },
        });
      }
      // SAAS_RUNTIME_ENVIRONMENT is now handled separately above, or assumed to be only in objectSpecification
      // if it's not a dependency. If it comes from selectedAssets, it's added there.
      else {
        // Handle other asset types for the 'objects' array
        objectsToInclude.push({
          path: assetPathArray,
          type:
            assetTypeUpper === "MCT"
              ? "MTT"
              : assetTypeUpper === "MAPPING"
              ? "DTEMPLATE"
              : assetTypeUpper,
        });
      }
    });

    const framedData = {
      commitHash: commitHash,
      objects: objectsToInclude,
    };

    if (objectSpecifications.length > 0) {
      framedData.objectSpecification = objectSpecifications;
    }

    setFramedPullRequestData(framedData);
    console.log("Framed Pull Request Data:", framedData);
  };

  const handleToggleEdit = () => {
    setIsEditingFramedData(!isEditingFramedData);
    if (!isEditingFramedData && framedPullRequestData) {
      setEditableFramedData(JSON.stringify(framedPullRequestData, null, 2));
    }
  };

  const handleSaveEditedData = () => {
    try {
      const parsedData = JSON.parse(editableFramedData);
      setFramedPullRequestData(parsedData);
      setIsEditingFramedData(false);
      // Optional: Add a success message
    } catch (error) {
      alert("Invalid JSON format. Please correct it before saving.");
      console.error("Error parsing edited JSON:", error);
      // Optional: Display error message on UI
    }
  };

  const handleProceedToPull = () => {
    if (framedPullRequestData) {
      // Ensure we use the potentially edited data
      try {
        const dataToSend = isEditingFramedData ? JSON.parse(editableFramedData) : framedPullRequestData;
        setIsPullOperatorVisible(true);
        // If you need to pass the "edited" data to PullOperatorPage, make sure to use dataToSend
        // For now, PullOperatorPage expects framedPullRequest, so update it if it's edited.
        if (isEditingFramedData) {
             setFramedPullRequestData(dataToSend); // Update main state with edited data
        }
      } catch (error) {
        alert("Cannot proceed: Invalid JSON in edited data. Please save valid JSON first.");
        console.error("Error parsing framed data before proceeding:", error);
        return; // Stop proceeding if JSON is invalid
      }
    } else {
      console.warn("Framed pull request data is not available.");
    }
  };

  const handleGoBackToProcess = () => {
    setIsPullOperatorVisible(false);
  };

  return (
    <div className="process-container">
      {!isPullOperatorVisible ? (
        <>
          <h1 className="process-title">Process Assets</h1>

          <div className="grid-container">
            <div className="grid-item">
              <h3 className="grid-item-title">Processed Objects</h3>
              {selectedAssets && selectedAssets.length > 0 ? (
                <table className="assets-table">
                  <thead>
                    <tr>
                      <th>Asset Name</th>
                      <th>Asset Type</th>
                      <th>Asset Id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAssets.map((asset) => (
                      <tr key={asset.id}>
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
                className={`action-button render-dependencies-button ${
                  Object.values(dependenciesLoading).some(Boolean)
                    ? "disabled-button"
                    : ""
                }`}
                disabled={Object.values(dependenciesLoading).some(Boolean)}
              >
                {Object.values(dependenciesLoading).some(Boolean)
                  ? "Rendering..."
                  : "Render Dependencies"}
              </button>
              {Object.keys(dependenciesError).length > 0 &&
                Object.entries(dependenciesError).map(([assetId, error]) =>
                  error ? (
                    <p
                      key={assetId}
                      className="status-message error-message dependency-error"
                    >
                      Error fetching dependencies for{" "}
                      {selectedAssets.find((a) => a.id === assetId)?.name}:{" "}
                      {error}
                    </p>
                  ) : null
                )}
              {Object.keys(dependencies).length > 0 && allDependenciesLoaded && (
                <div className="dependencies-container">
                  {Object.values(dependencies).map((depInfo) => (
                    <div
                      key={depInfo.parent.id}
                      className="dependency-item-container"
                    >
                      <h4 className="dependency-parent-title">
                        Dependencies for: {depInfo.parent.name} (
                        {depInfo.parent.type})
                      </h4>
                      {depInfo.references.length > 0 ? (
                        <table className="dependencies-table">
                          <thead>
                            <tr>
                              <th>Path</th>
                              <th>Type</th>
                              <th>ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {depInfo.references.map((ref) => (
                              <tr key={ref.id}>
                                <td>{ref.path}</td>
                                <td>{ref.documentType}</td>
                                <td>{ref.id}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-dependencies">
                          No dependencies found for this asset.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commit History Section - Updated table structure */}
            <div className="grid-item">
              <h3 className="grid-item-title">Commit History</h3>
              <button
                onClick={handleGetCommitHistory}
                className={`action-button get-commit-history-button ${
                  commitHistoryLoading ? "disabled-button" : ""
                }`}
                disabled={
                  commitHistoryLoading ||
                  !sessionId ||
                  !serverUrl ||
                  !selectedAssets.length
                }
              >
                {commitHistoryLoading ? "Fetching..." : "Get Commit History"}
              </button>

              {hasFetchedCommitHistory && (
                <>
                  {commitHistoryLoading && (
                    <p className="status-message">Fetching commit history...</p>
                  )}
                  {commitHistoryError && (
                    <p className="status-message error-message">
                      Error: {commitHistoryError}
                    </p>
                  )}
                  {!commitHistoryLoading && !commitHistoryError && (
                    <>
                      {commitHistory.length > 0 ? (
                        <div className="commit-history-container">
                          <table className="commit-history-table">
                            <thead>
                              <tr>
                                <th>Commit Hash</th>
                                <th>Username</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {commitHistory.map((commit) => (
                                <tr
                                  key={commit.hash}
                                  onClick={() =>
                                    handleSelectCommit(commit.hash)
                                  }
                                  className="commit-row"
                                >
                                  <td>{commit.hash}</td>
                                  <td>{commit.username}</td>
                                  <td>
                                    {new Date(commit.date).toLocaleString(
                                      "en-US",
                                      {
                                        month: "2-digit",
                                        day: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                        hour12: true,
                                      }
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="status-message">
                          No commit history found for the selected project.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="grid-item">
              <h3 className="grid-item-title">Frame Pull Request</h3>
              <div>
                <label htmlFor="commitHash">Commit Hash:</label>
                <input
                  type="text"
                  id="commitHash"
                  value={commitHash}
                  onChange={(e) => setCommitHash(e.target.value)}
                  required
                  placeholder="Enter or select a commit hash"
                />
                {commitHashError && (
                  <p className="status-message error-message">
                    {commitHashError}
                  </p>
                )}
              </div>
              <button
                onClick={handleFramePullRequest}
                className={`action-button`}
                disabled={!commitHash}
              >
                Frame Pull Request
              </button>

              {framedPullRequestData && (
                <div className="framed-data-display-container">
                  {isEditingFramedData ? (
                    <textarea
                      className="framed-data-textarea"
                      value={editableFramedData}
                      onChange={(e) => setEditableFramedData(e.target.value)}
                    />
                  ) : (
                    <div className="framed-data-display">
                      <pre>
                        <code
                          dangerouslySetInnerHTML={{
                            __html: formatJSONWithHighlighting(
                              framedPullRequestData
                            ),
                          }}
                        />
                      </pre>
                    </div>
                  )}
                  <div className="framed-data-actions">
                    <button
                      onClick={handleToggleEdit}
                      className="action-button edit-button"
                    >
                      {isEditingFramedData ? "Cancel Edit" : "Edit Request"}
                    </button>
                    {isEditingFramedData && (
                      <button
                        onClick={handleSaveEditedData}
                        className="action-button save-button"
                      >
                        Save Changes
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {onGoBack && (
              <div className="navigation-buttons">
                <button onClick={onGoBack} className="go-back-button">
                  Go Back
                </button>
                {framedPullRequestData && ( /* Only show proceed if data is framed */
                  <button
                    onClick={handleProceedToPull}
                    className="proceed-to-pull-button"
                    disabled={isEditingFramedData} /* Disable if still editing */
                  >
                    Proceed to Pull Action
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <PullOperatorPage
          framedPullRequest={framedPullRequestData}
          onGoBack={handleGoBackToProcess}
        />
      )}
    </div>
  );
}

export default ProcessPage;