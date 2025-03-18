import React, { useState, useEffect } from 'react';
import './ProcessPage.css';

function ProcessPage({ selectedAssets, sessionId, serverUrl, onGoBack }) {
  const [dependencies, setDependencies] = useState({});
  const [dependenciesLoading, setDependenciesLoading] = useState({});
  const [dependenciesError, setDependenciesError] = useState({});
  const [allDependenciesLoaded, setAllDependenciesLoaded] = useState(false);
  const [filteredDependencies, setFilteredDependencies] = useState({});
  const [pullRequestStatus, setPullRequestStatus] = useState(null);
  const [pullRequestLoading, setPullRequestLoading] = useState(false);
  const [pullRequestError, setPullRequestError] = useState('');
  const [pullStatus, setPullStatus] = useState(null);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullError, setPullError] = useState('');

  const allowedTypes = new Set([
    'DTEMPLATE', 'MAPPING', 'MTT', 'DSS', 'DMASK', 'DRS', 'DMAPPLET',
    'MAPPLET', 'BSERVICE', 'HSCHEMA', 'PCS', 'FWCONFIG', 'CUSTOMSOURCE',
    'MI_TASK', 'WORKFLOW', 'TASKFLOW', 'UDF', 'MCT'
  ]);

  const handleRenderDependencies = async () => {
    setDependencies({});
    setDependenciesLoading({});
    setDependenciesError({});
    setAllDependenciesLoaded(false);

    if (!selectedAssets || selectedAssets.length === 0) {
      return;
    }

    const allFetchedDependencies = {};
    const queue = [...selectedAssets.map(asset => ({ id: asset.id, name: asset.name, type: asset.type, level: 0 }))];
    const visited = new Set(selectedAssets.map(asset => asset.id));
    const maxLevels = 5;

    while (queue.length > 0) {
      const current = queue.shift();
      const { id, name, type, level } = current;

      if (level > maxLevels) {
        console.warn(`Reached maximum dependency level (${maxLevels}) for asset ${name} (${id}). Further dependencies might not be fetched.`);
        continue;
      }

      setDependenciesLoading((prev) => ({ ...prev, [id]: true }));
      setDependenciesError((prev) => ({ ...prev, [id]: '' }));

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
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
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
        allFetchedDependencies[id].references.push(...references);

        references.forEach((ref) => {
          if (!visited.has(ref.id)) {
            visited.add(ref.id);
            queue.push({ id: ref.id, name: ref.path.split('/').pop(), type: ref.documentType, level: level + 1 });
          }
        });
      } catch (error) {
        console.error(`Error fetching dependencies for ${name} (${id}):`, error);
        setDependenciesError((prev) => ({ ...prev, [id]: error.message }));
      } finally {
        setDependenciesLoading((prev) => ({ ...prev, [id]: false }));
      }
    }

    // Post-process to remove duplicate references (based on ID) for each parent
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
      uniqueDependencies[parentId] = { ...allFetchedDependencies[parentId], references: uniqueRefs };
    }

    setDependencies(uniqueDependencies);
    setAllDependenciesLoaded(true);
    setTimeout(filterDependencies, 0);
  };

  const filterDependencies = () => {
    const filtered = {};
    for (const parentId in dependencies) {
      const depInfo = dependencies[parentId];
      const filteredRefs = depInfo.references.filter(ref => {
        const type = ref.documentType;
        return allowedTypes.has(type);
      });
      if (filteredRefs.length > 0 || selectedAssets.some(asset => asset.id === parentId)) {
        filtered[parentId] = { ...depInfo, references: filteredRefs };
      }
    }
    setFilteredDependencies(filtered);
  };

  const handleCreatePullRequest = async () => {
    setPullRequestLoading(true);
    setPullRequestStatus(null);
    setPullRequestError('');
    try {
      console.log('Calling API to create pull request with:', selectedAssets, dependencies);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockPullRequest = { id: 'PR-123', url: 'https://example.com/pull/123' };
      setPullRequestStatus(mockPullRequest);
    } catch (error) {
      console.error('Error creating pull request:', error);
      setPullRequestError('Failed to create pull request.');
    } finally {
      setPullRequestLoading(false);
    }
  };

  const handlePullChanges = async () => {
    setPullLoading(true);
    setPullStatus(null);
    setPullError('');
    try {
      console.log('Calling API to perform VCS pull');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setPullStatus('VCS pull operation completed successfully.');
    } catch (error) {
      console.error('Error performing VCS pull:', error);
      setPullError('Failed to perform VCS pull.');
    } finally {
      setPullLoading(false);
    }
  };

  return (
    <div className="process-container">
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
            className={`action-button render-dependencies-button ${Object.values(dependenciesLoading).some(Boolean) ? 'disabled-button' : ''}`}
            disabled={Object.values(dependenciesLoading).some(Boolean)}
          >
            {Object.values(dependenciesLoading).some(Boolean) ? 'Rendering...' : 'Render Dependencies'}
          </button>
          {Object.keys(dependenciesError).length > 0 && (
            Object.entries(dependenciesError).map(([assetId, error]) => (
              error ? (
                <p key={assetId} className="status-message error-message dependency-error">
                  Error fetching dependencies for {selectedAssets.find(a => a.id === assetId)?.name}: {error}
                </p>
              ) : null
            ))
          )}
          {Object.keys(dependencies).length > 0 && allDependenciesLoaded && (
            <div className="dependencies-container">
              {Object.values(dependencies).map((depInfo) => (
                <div key={depInfo.parent.id} className="dependency-item-container">
                  <h4 className="dependency-parent-title">Dependencies for: {depInfo.parent.name} ({depInfo.parent.type})</h4>
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
                    <p className="no-dependencies">No dependencies found for this asset.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid-item">
          <h3 className="grid-item-title">Filter Dependencies</h3>
          {Object.keys(filteredDependencies).length > 0 ? (
            <div className="filtered-dependencies-container">
              {Object.values(filteredDependencies).map((depInfo) => (
                <div key={depInfo.parent.id} className="dependency-item-container">
                  <h4 className="dependency-parent-title">Filtered Dependencies for: {depInfo.parent.name} ({depInfo.parent.type})</h4>
                  <table className="dependencies-table">
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Type</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depInfo.references.map((ref) => {
                        const type = ref.documentType;
                        if (allowedTypes.has(type)) {
                          return (
                            <tr key={ref.id}>
                              <td>{ref.path}</td>
                              <td>{ref.documentType}</td>
                              <td>{ref.id}</td>
                            </tr>
                          );
                        }
                        return null;
                      })}
                      {selectedAssets.some(asset => asset.id === depInfo.parent.id) && depInfo.references.filter(ref => allowedTypes.has(ref.documentType)).length === 0 && (
                        <tr><td colSpan="3">No filtered dependencies found.</td></tr>
                      )}
                      {!selectedAssets.some(asset => asset.id === depInfo.parent.id) && depInfo.references.filter(ref => allowedTypes.has(ref.documentType)).length === 0 && (
                        <tr><td colSpan="3">No filtered dependencies found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <p className="status-message">Please render dependencies first to filter.</p>
          )}
        </div>

        <div className="grid-item">
          <h3 className="grid-item-title">Frame Pull Request</h3>
          {pullStatus ? (
            <p className="status-message">Pull operation completed: {pullStatus}</p>
          ) : (
            <button
              onClick={handlePullChanges}
              className={`action-button ${pullLoading || !pullRequestStatus ? 'disabled-button' : ''}`}
              disabled={pullLoading || !pullRequestStatus}
            >
              {pullLoading ? 'Pulling Changes...' : 'Pull Changes'}
            </button>
          )}
          {pullError && <p className="status-message error-message">{pullError}</p>}
          {!pullRequestStatus && !pullError && (
            <p className="status-message">Please create a pull request first.</p>
          )}
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