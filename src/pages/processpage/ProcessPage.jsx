import React, { useState, useEffect, useMemo } from "react";
import PullOperatorPage from "../pullpage/PullOperatorPage";
import "./ProcessPage.css";
import { formatJSONWithHighlighting } from "../../utils/formatJSONWithHighlighting";
import ProgressStepper from "../../components/ProgressStepper";
import AssetTypeBadge from "../../components/AssetTypeBadge";
import Toast from "../../components/Toast";
import { proxyFetch } from "../../utils/apiClient";

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
  const [isEditingFramedData, setIsEditingFramedData] = useState(false);
  const [editableFramedData, setEditableFramedData] = useState("");
  const [depthWarning, setDepthWarning] = useState(false);
  const [toast, setToast] = useState(null);
  const [connectionMappings, setConnectionMappings] = useState({});

  const allowedTypes = new Set([
    "DTEMPLATE","MAPPING","MTT","DSS","DMASK","DRS","DMAPPLET","MAPPLET",
    "BSERVICE","HSCHEMA","PCS","FWCONFIG","CUSTOMSOURCE","MI_TASK",
    "WORKFLOW","TASKFLOW","UDF","MCT","SAAS_CONNECTION",
  ]);

  const pendingMappings = useMemo(() => {
    const entries = [];
    const seen = new Set();
    const add = (asset, kind) => {
      const key = Array.isArray(asset.name) ? asset.name.join("/") : asset.name;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ key, name: asset.name, type: kind });
    };
    selectedAssets.forEach((asset) => {
      const t = (asset.type || "").toUpperCase();
      if (t === "SAAS_CONNECTION") add(asset, "Connection");
      if (t === "SAAS_RUNTIME_ENVIRONMENT") add(asset, "AgentGroup");
    });
    Object.values(dependencies).forEach((dep) => {
      dep.references.forEach((ref) => {
        if ((ref.documentType || "").toUpperCase() === "SAAS_CONNECTION")
          add({ name: ref.path, id: ref.id }, "Connection");
      });
    });
    return entries;
  }, [selectedAssets, dependencies]);

  useEffect(() => {
    if (framedPullRequestData) setEditableFramedData(JSON.stringify(framedPullRequestData, null, 2));
    else setEditableFramedData("");
  }, [framedPullRequestData]);

  const handleGetCommitHistory = async () => {
    setCommitHistoryLoading(true);
    setCommitHistoryError("");
    setCommitHistory([]);
    setHasFetchedCommitHistory(true);
    if (!selectedAssets?.length || !selectedAssets[0].name) {
      setCommitHistoryError("No selected assets or missing asset path.");
      setCommitHistoryLoading(false);
      return;
    }
    const projectPath = selectedAssets[0].name.split("/")[0];
    if (!sessionId || !serverUrl || !projectPath) {
      setCommitHistoryError("Missing session ID, server URL, or project path.");
      setCommitHistoryLoading(false);
      return;
    }
    try {
      const response = await proxyFetch(
        `${serverUrl}/public/core/v3/commitHistory?q=path=='${projectPath}'`,
        { method: "GET", headers: { "INFA-SESSION-ID": sessionId }, redirect: "follow" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      setCommitHistory(result.commits || []);
      setToast({ message: `Loaded ${(result.commits || []).length} commit(s)`, type: "success" });
    } catch (err) {
      setCommitHistoryError(err.message);
      setToast({ message: err.message, type: "error" });
    } finally {
      setCommitHistoryLoading(false);
    }
  };

  const handleSelectCommit = (hash) => {
    setCommitHash(hash);
    setToast({ message: `Commit selected: ${hash.substring(0, 12)}…`, type: "info" });
  };

  const handleRenderDependencies = async () => {
    setDependencies({});
    setDependenciesLoading({});
    setDependenciesError({});
    setAllDependenciesLoaded(false);
    setDepthWarning(false);
    if (!selectedAssets?.length) return;

    const allFetchedDependencies = {};
    const queue = selectedAssets.map((a) => ({ id: a.id, name: a.name, type: a.type, level: 0 }));
    const visited = new Set(selectedAssets.map((a) => a.id));
    const maxLevels = 5;
    let hitDepthLimit = false;
    const headers = { "INFA-SESSION-ID": sessionId };

    while (queue.length > 0) {
      const batch = queue.splice(0, queue.length);
      const results = await Promise.all(
        batch.map(async ({ id, name, type, level }) => {
          if (level > maxLevels) { hitDepthLimit = true; return null; }
          setDependenciesLoading((prev) => ({ ...prev, [id]: true }));
          try {
            const response = await proxyFetch(
              `${serverUrl}/public/core/v3/objects/${id}/references?refType=Uses`,
              { method: "GET", headers, redirect: "follow" }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
            const references = (result.references || []).map((ref) => ({
              path: ref.path, documentType: ref.documentType, id: ref.id,
            }));
            const filtered = references.filter((ref) => allowedTypes.has(ref.documentType.toUpperCase()));
            return { id, name, type, level, filtered };
          } catch (err) {
            setDependenciesError((prev) => ({ ...prev, [id]: err.message }));
            return null;
          } finally {
            setDependenciesLoading((prev) => ({ ...prev, [id]: false }));
          }
        })
      );
      results.filter(Boolean).forEach(({ id, name, type, level, filtered }) => {
        if (!allFetchedDependencies[id])
          allFetchedDependencies[id] = { parent: { name, type, id }, references: [] };
        allFetchedDependencies[id].references.push(...filtered);
        filtered.forEach((ref) => {
          if (!visited.has(ref.id)) {
            visited.add(ref.id);
            queue.push({ id: ref.id, name: ref.path.split("/").pop(), type: ref.documentType, level: level + 1 });
          }
        });
      });
    }

    const uniqueDeps = {};
    for (const parentId in allFetchedDependencies) {
      const seen = new Set();
      const uniqueRefs = allFetchedDependencies[parentId].references.filter((ref) => {
        if (seen.has(ref.id)) return false;
        seen.add(ref.id);
        return true;
      });
      uniqueDeps[parentId] = { ...allFetchedDependencies[parentId], references: uniqueRefs };
    }
    setDependencies(uniqueDeps);
    setAllDependenciesLoaded(true);
    if (hitDepthLimit) setDepthWarning(true);
    const total = Object.values(uniqueDeps).reduce((acc, d) => acc + d.references.length, 0);
    setToast({ message: `Dependencies resolved: ${total} unique reference(s)`, type: "success" });
  };

  const handleFramePullRequest = () => {
    if (!commitHash) { setCommitHashError("Commit Hash is mandatory."); return; }
    const unmapped = pendingMappings.filter((m) => !connectionMappings[m.key]?.trim());
    if (unmapped.length > 0) {
      setToast({ message: `Fill in target name(s) for: ${unmapped.map((m) => m.key).join(", ")}`, type: "warning", duration: 6000 });
      return;
    }
    setCommitHashError("");
    setIsEditingFramedData(false);

    const objectsToInclude = [];
    const objectSpecifications = [];
    const allAssetsRaw = [
      ...selectedAssets,
      ...Object.values(dependencies).flatMap((d) =>
        d.references.map((ref) => ({ id: ref.id, name: ref.path, type: ref.documentType }))
      ),
    ];
    const uniqueAssets = new Map();
    allAssetsRaw.forEach((asset) => {
      if (asset?.id && !uniqueAssets.has(asset.id)) uniqueAssets.set(asset.id, asset);
    });
    selectedAssets.forEach((asset) => {
      if (asset.type?.toUpperCase() === "SAAS_RUNTIME_ENVIRONMENT") {
        const pathArr = Array.isArray(asset.name) ? asset.name : asset.name.split("/");
        const sourceKey = pathArr.join("/");
        const targetName = connectionMappings[sourceKey]?.trim();
        objectSpecifications.push({
          source: { path: pathArr, type: "AgentGroup" },
          target: { path: [targetName || sourceKey], type: "AgentGroup" },
        });
        uniqueAssets.delete(asset.id);
      }
    });
    uniqueAssets.forEach((asset) => {
      if (!asset?.type) return;
      const typeUpper = asset.type.toUpperCase();
      const pathArr = Array.isArray(asset.name) ? asset.name : (typeof asset.name === "string" ? asset.name.split("/") : []);
      if (typeUpper === "SAAS_CONNECTION") {
        const sourceKey = pathArr.join("/");
        const targetName = connectionMappings[sourceKey]?.trim();
        objectSpecifications.push({
          source: { path: pathArr, type: "Connection" },
          target: { path: [targetName || pathArr[pathArr.length - 1]], type: "Connection" },
        });
      } else {
        objectsToInclude.push({
          path: pathArr,
          type: typeUpper === "MCT" ? "MTT" : typeUpper === "MAPPING" ? "DTEMPLATE" : typeUpper,
        });
      }
    });
    const framedData = { commitHash, objects: objectsToInclude };
    if (objectSpecifications.length > 0) framedData.objectSpecification = objectSpecifications;
    setFramedPullRequestData(framedData);
    setToast({ message: "Pull request framed successfully", type: "success" });
  };

  const handleCopyToClipboard = () => {
    const text = isEditingFramedData ? editableFramedData : JSON.stringify(framedPullRequestData, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => setToast({ message: "Copied to clipboard!", type: "success" }))
      .catch(() => setToast({ message: "Failed to copy", type: "error" }));
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(framedPullRequestData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pull-request-${commitHash.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleEdit = () => {
    setIsEditingFramedData(!isEditingFramedData);
    if (!isEditingFramedData && framedPullRequestData)
      setEditableFramedData(JSON.stringify(framedPullRequestData, null, 2));
  };

  const handleSaveEditedData = () => {
    try {
      const parsed = JSON.parse(editableFramedData);
      setFramedPullRequestData(parsed);
      setIsEditingFramedData(false);
      setToast({ message: "Changes saved", type: "success" });
    } catch {
      setToast({ message: "Invalid JSON — please fix before saving", type: "error" });
    }
  };

  const handleProceedToPull = () => {
    if (!framedPullRequestData) return;
    try {
      const dataToSend = isEditingFramedData ? JSON.parse(editableFramedData) : framedPullRequestData;
      if (isEditingFramedData) setFramedPullRequestData(dataToSend);
      setIsPullOperatorVisible(true);
    } catch {
      setToast({ message: "Invalid JSON — save valid JSON before proceeding", type: "error" });
    }
  };

  if (isPullOperatorVisible) {
    return (
      <>
        <ProgressStepper currentStep={3} />
        <PullOperatorPage
          framedPullRequest={framedPullRequestData}
          onGoBack={() => setIsPullOperatorVisible(false)}
        />
        {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />}
      </>
    );
  }

  const isDepLoading = Object.values(dependenciesLoading).some(Boolean);
  const totalDeps = Object.values(dependencies).reduce((acc, d) => acc + d.references.length, 0);

  return (
    <>
      <ProgressStepper currentStep={2} />

      <div className="pp-page">
        {/* ── Page header ── */}
        <div className="pp-header">
          <div className="pp-header-inner">
            <div>
              <h1 className="pp-title">Process Assets</h1>
              <p className="pp-subtitle">
                Resolve dependencies, select a commit, then frame your pull request
              </p>
            </div>
            <button onClick={onGoBack} className="pp-back-btn">← Back</button>
          </div>
        </div>

        <div className="pp-body">

          {/* ── Card 1: Selected Assets ── */}
          <section className="pp-card">
            <div className="pp-card-header">
              <span className="pp-step-badge">1</span>
              <h2>Selected Assets</h2>
              <span className="pp-count-chip">{selectedAssets?.length || 0} asset{selectedAssets?.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="pp-card-body">
              {selectedAssets?.length > 0 ? (
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Asset Path</th>
                        <th>Type</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAssets.map((asset, i) => (
                        <tr key={asset.id}>
                          <td className="pp-idx">{i + 1}</td>
                          <td className="pp-path-cell">{asset.name}</td>
                          <td><AssetTypeBadge type={asset.type} /></td>
                          <td className="pp-id-cell" title={asset.id}>{asset.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="pp-empty">No assets selected.</div>
              )}
            </div>
          </section>

          {/* ── Card 2: Dependencies ── */}
          <section className="pp-card">
            <div className="pp-card-header">
              <span className="pp-step-badge">2</span>
              <h2>Resolve Dependencies</h2>
              {allDependenciesLoaded && (
                <span className="pp-count-chip pp-count-chip--green">{totalDeps} reference{totalDeps !== 1 ? "s" : ""} found</span>
              )}
            </div>
            <div className="pp-card-body">
              <p className="pp-card-hint">
                Fetches the full dependency tree for each selected asset up to 5 levels deep.
              </p>
              <button
                onClick={handleRenderDependencies}
                disabled={isDepLoading}
                className={`pp-action-btn pp-action-btn--green ${isDepLoading ? "pp-action-btn--disabled" : ""}`}
              >
                {isDepLoading ? (
                  <><span className="pp-spinner" /> Resolving…</>
                ) : (
                  <><span>⬡</span> Render Dependencies</>
                )}
              </button>

              {depthWarning && (
                <div className="pp-warning-bar">
                  ⚠ Max depth (5 levels) reached — some transitive dependencies may be missing.
                </div>
              )}

              {Object.entries(dependenciesError).map(([id, err]) =>
                err ? (
                  <div key={id} className="pp-error-bar">
                    ✗ Error for {selectedAssets.find((a) => a.id === id)?.name}: {err}
                  </div>
                ) : null
              )}

              {Object.keys(dependencies).length > 0 && allDependenciesLoaded && (
                <div className="pp-dep-list">
                  {Object.values(dependencies).map((depInfo) => (
                    <div key={depInfo.parent.id} className="pp-dep-group">
                      <div className="pp-dep-group-header">
                        <AssetTypeBadge type={depInfo.parent.type} />
                        <span className="pp-dep-group-name">{depInfo.parent.name}</span>
                        <span className="pp-dep-count">
                          {depInfo.references.length} dep{depInfo.references.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {depInfo.references.length > 0 ? (
                        <div className="pp-table-wrap">
                          <table className="pp-table pp-table--compact">
                            <thead>
                              <tr><th>Path</th><th>Type</th><th>ID</th></tr>
                            </thead>
                            <tbody>
                              {depInfo.references.map((ref) => (
                                <tr key={ref.id}>
                                  <td className="pp-path-cell">{ref.path}</td>
                                  <td><AssetTypeBadge type={ref.documentType} /></td>
                                  <td className="pp-id-cell" title={ref.id}>{ref.id}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="pp-no-deps">No dependencies found for this asset.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isDepLoading && Object.keys(dependencies).length === 0 && allDependenciesLoaded && (
                <div className="pp-empty-state">
                  <span className="pp-empty-icon">✓</span>
                  <p>No external dependencies found — all assets are self-contained.</p>
                </div>
              )}
            </div>
          </section>

          {/* ── Card 3: Commit History ── */}
          <section className="pp-card">
            <div className="pp-card-header">
              <span className="pp-step-badge">3</span>
              <h2>Select Commit</h2>
              {commitHash && (
                <div className="pp-selected-hash">
                  <span className="pp-hash-dot" />
                  <code>{commitHash.substring(0, 14)}…</code>
                  <button className="pp-clear-btn" onClick={() => setCommitHash("")}>✕</button>
                </div>
              )}
            </div>
            <div className="pp-card-body">
              <p className="pp-card-hint">
                Fetch the commit history for the source project and click a row to select a hash.
              </p>
              <button
                onClick={handleGetCommitHistory}
                disabled={commitHistoryLoading || !sessionId || !serverUrl || !selectedAssets.length}
                className={`pp-action-btn pp-action-btn--teal ${commitHistoryLoading ? "pp-action-btn--disabled" : ""}`}
              >
                {commitHistoryLoading ? (
                  <><span className="pp-spinner" /> Fetching…</>
                ) : (
                  <><span>⟳</span> Get Commit History</>
                )}
              </button>

              {commitHistoryError && (
                <div className="pp-error-bar">✗ {commitHistoryError}</div>
              )}

              {hasFetchedCommitHistory && !commitHistoryLoading && !commitHistoryError && (
                commitHistory.length > 0 ? (
                  <div className="pp-commit-list">
                    {commitHistory.map((commit) => (
                      <div
                        key={commit.hash}
                        onClick={() => handleSelectCommit(commit.hash)}
                        className={`pp-commit-row ${commitHash === commit.hash ? "pp-commit-row--active" : ""}`}
                        title="Click to select this commit"
                      >
                        <div className="pp-commit-dot" />
                        <div className="pp-commit-info">
                          <code className="pp-commit-hash">{commit.hash}</code>
                          <span className="pp-commit-meta">
                            <span className="pp-commit-author">by {commit.username}</span>
                            <span className="pp-commit-date">
                              {new Date(commit.date).toLocaleString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                                hour: "2-digit", minute: "2-digit", hour12: true,
                              })}
                            </span>
                          </span>
                        </div>
                        {commitHash === commit.hash && (
                          <span className="pp-commit-selected-badge">Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pp-empty">No commit history found for this project.</div>
                )
              )}
            </div>
          </section>

          {/* ── Card 4: Frame Pull Request ── */}
          <section className="pp-card">
            <div className="pp-card-header">
              <span className="pp-step-badge">4</span>
              <h2>Frame Pull Request</h2>
              {framedPullRequestData && (
                <span className="pp-count-chip pp-count-chip--blue">
                  {framedPullRequestData.objects?.length || 0} objects
                  {framedPullRequestData.objectSpecification?.length
                    ? ` · ${framedPullRequestData.objectSpecification.length} mappings`
                    : ""}
                </span>
              )}
            </div>
            <div className="pp-card-body">

              {/* Connection mappings */}
              {pendingMappings.length > 0 && (
                <div className="pp-mapping-section">
                  <div className="pp-mapping-header">
                    <span className="pp-mapping-icon">⇄</span>
                    <div>
                      <p className="pp-mapping-title">Connection / Runtime Mappings</p>
                      <p className="pp-mapping-sub">Map each source to its target environment equivalent</p>
                    </div>
                  </div>
                  <div className="pp-mapping-rows">
                    {pendingMappings.map((m) => (
                      <div key={m.key} className="pp-mapping-row">
                        <div className="pp-mapping-source">
                          <AssetTypeBadge type={m.type === "Connection" ? "SAAS_CONNECTION" : "SAAS_RUNTIME_ENVIRONMENT"} />
                          <span className="pp-mapping-name" title={m.key}>
                            {Array.isArray(m.name) ? m.name[m.name.length - 1] : m.name.split("/").pop()}
                          </span>
                        </div>
                        <span className="pp-mapping-arrow">→</span>
                        <input
                          type="text"
                          className={`pp-mapping-input ${!connectionMappings[m.key]?.trim() ? "pp-mapping-input--empty" : "pp-mapping-input--filled"}`}
                          placeholder={`Target ${m.type} name`}
                          value={connectionMappings[m.key] || ""}
                          onChange={(e) =>
                            setConnectionMappings((prev) => ({ ...prev, [m.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit hash input */}
              <div className="pp-hash-input-group">
                <label htmlFor="commitHash">
                  Commit Hash <span className="pp-required">*</span>
                </label>
                <div className="pp-hash-input-wrap">
                  <span className="pp-hash-prefix">#</span>
                  <input
                    type="text"
                    id="commitHash"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="Enter or select from commit history above"
                    className={commitHashError ? "pp-hash-input--error" : ""}
                  />
                </div>
                {commitHashError && <p className="pp-field-error">{commitHashError}</p>}
              </div>

              <button
                onClick={handleFramePullRequest}
                disabled={!commitHash}
                className={`pp-action-btn pp-action-btn--blue ${!commitHash ? "pp-action-btn--disabled" : ""}`}
              >
                <span>⊞</span> Frame Pull Request
              </button>

              {/* Framed payload */}
              {framedPullRequestData && (
                <div className="pp-payload-section">
                  <div className="pp-payload-toolbar">
                    <span className="pp-payload-label">Payload</span>
                    <div className="pp-payload-actions">
                      <button onClick={handleToggleEdit} className="pp-tool-btn pp-tool-btn--gray">
                        {isEditingFramedData ? "✕ Cancel" : "✎ Edit"}
                      </button>
                      {isEditingFramedData && (
                        <button onClick={handleSaveEditedData} className="pp-tool-btn pp-tool-btn--green">
                          ✓ Save
                        </button>
                      )}
                      <button onClick={handleCopyToClipboard} className="pp-tool-btn pp-tool-btn--purple">
                        ⎘ Copy
                      </button>
                      <button onClick={handleExportJSON} className="pp-tool-btn pp-tool-btn--orange">
                        ↓ Export
                      </button>
                    </div>
                  </div>
                  {isEditingFramedData ? (
                    <textarea
                      className="pp-payload-editor"
                      value={editableFramedData}
                      onChange={(e) => setEditableFramedData(e.target.value)}
                      spellCheck={false}
                    />
                  ) : (
                    <div className="pp-payload-viewer">
                      <pre>
                        <code
                          dangerouslySetInnerHTML={{
                            __html: formatJSONWithHighlighting(framedPullRequestData),
                          }}
                        />
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Footer actions ── */}
          {framedPullRequestData && (
            <div className="pp-footer">
              <button onClick={onGoBack} className="pp-footer-back">← Back to Assets</button>
              <button
                onClick={handleProceedToPull}
                disabled={isEditingFramedData}
                className="pp-footer-proceed"
              >
                Proceed to Execute Pull ⚡
              </button>
            </div>
          )}

        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />
      )}
    </>
  );
}

export default ProcessPage;
