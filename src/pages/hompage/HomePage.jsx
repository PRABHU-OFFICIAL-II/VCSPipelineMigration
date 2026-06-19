import React, { useState, useCallback, useMemo } from "react";
import "./HomePage.css";
import { BiCaretDown, BiCaretUp } from "react-icons/bi";
import { ClipLoader } from "react-spinners";
import ProcessPage from "../processpage/ProcessPage";
import ProgressStepper from "../../components/ProgressStepper";
import AssetTypeBadge from "../../components/AssetTypeBadge";
import Toast from "../../components/Toast";
import { proxyFetch } from "../../utils/apiClient";

function HomePage({ sessionId, serverUrl, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState({});
  const [detailsError, setDetailsError] = useState({});
  const [expandedFolder, setExpandedFolder] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkedAssets, setCheckedAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  const fetchAllPages = useCallback(async (baseUrl) => {
    let allObjects = [];
    let skip = 0;
    const pageSize = 200;
    let totalCount = -1;
    const countBaseUrl = `${baseUrl}&$count=true`;
    const myHeaders = new Headers();
    myHeaders.append("INFA-SESSION-ID", sessionId);
    const requestOptions = { method: "GET", headers: myHeaders, redirect: "follow" };

    while (true) {
      const url = `${countBaseUrl}&limit=${pageSize}&skip=${skip}`;
      const response = await proxyFetch(url, requestOptions);
      if (!response.ok) {
        console.error(`Failed to fetch paginated data at skip=${skip}: ${response.status}`);
        break;
      }
      const data = await response.json();
      const currentObjects = data.objects || [];
      if (totalCount === -1) {
        totalCount = data.count !== undefined ? data.count : currentObjects.length;
        if (totalCount === 0) break;
      }
      allObjects.push(...currentObjects);
      if (allObjects.length >= totalCount || currentObjects.length === 0) break;
      skip += pageSize;
    }
    return allObjects;
  }, [sessionId]);

  const fetchSingleLevelDetails = useCallback(async (path) => {
    const baseUrl = `${serverUrl.replace(/\/$/, "")}/public/core/v3/objects?q=location=='${path}'`;
    return fetchAllPages(baseUrl);
  }, [serverUrl, fetchAllPages]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = `${serverUrl.replace(/\/$/, "")}/public/core/v3/objects?q=type=='PROJECT'`;
      const allProjects = await fetchAllPages(baseUrl);
      setProjects(allProjects);
      setToast({ message: `Loaded ${allProjects.length} project(s)`, type: 'success' });
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err.message);
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [serverUrl, fetchAllPages]);

  const fetchProjectDetails = useCallback(async (projectPath) => {
    if (projectDetails[projectPath]) {
      setExpandedProject((prev) => (prev === projectPath ? null : projectPath));
      return;
    }
    setDetailsLoading((prev) => ({ ...prev, [projectPath]: true }));
    setDetailsError((prev) => ({ ...prev, [projectPath]: "" }));
    try {
      const collectedDetails = await fetchSingleLevelDetails(projectPath);
      setProjectDetails((prev) => ({ ...prev, [projectPath]: collectedDetails }));
      setExpandedProject(projectPath);
    } catch (err) {
      console.error(`Error fetching details for ${projectPath}:`, err);
      setDetailsError((prev) => ({ ...prev, [projectPath]: err.message }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [projectPath]: false }));
    }
  }, [projectDetails, fetchSingleLevelDetails]);

  const fetchFolderDetails = useCallback(async (folderPath) => {
    const isExpanded = expandedFolder[folderPath];
    setExpandedFolder((prev) => ({ ...prev, [folderPath]: !isExpanded }));
    if (projectDetails[folderPath]) return;
    setDetailsLoading((prev) => ({ ...prev, [folderPath]: true }));
    setDetailsError((prev) => ({ ...prev, [folderPath]: "" }));
    try {
      const collectedDetails = await fetchSingleLevelDetails(folderPath);
      setProjectDetails((prev) => ({ ...prev, [folderPath]: collectedDetails }));
    } catch (err) {
      console.error(`Error fetching details for ${folderPath}:`, err);
      setDetailsError((prev) => ({ ...prev, [folderPath]: err.message }));
      setExpandedFolder((prev) => ({ ...prev, [folderPath]: false }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  }, [projectDetails, expandedFolder, fetchSingleLevelDetails]);

  const getAssetName = useCallback((path, parentPath) => {
    if (path && parentPath && path.startsWith(parentPath + "/")) {
      return path.substring(parentPath.length + 1);
    }
    return path;
  }, []);

  const getAllDescendantAssetIds = useCallback((parentPath, allProjectDetails) => {
    const descendantIds = new Set();
    const queue = [parentPath];
    const visitedPaths = new Set();
    while (queue.length > 0) {
      const currentPath = queue.shift();
      if (visitedPaths.has(currentPath)) continue;
      visitedPaths.add(currentPath);
      if (allProjectDetails[currentPath]) {
        allProjectDetails[currentPath].forEach((child) => {
          if (child.type && child.type !== "Project") {
            descendantIds.add(child.id);
            if (child.type === "Folder" && allProjectDetails[child.path]) {
              queue.push(child.path);
            }
          }
        });
      }
    }
    return Array.from(descendantIds);
  }, []);

  const handleCheckboxChange = useCallback((itemId) => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const handleCheckAllProjects = useCallback((event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prev) => {
      const updated = { ...prev };
      projects.forEach((project) => {
        updated[project.id] = isChecked;
        getAllDescendantAssetIds(project.path, projectDetails).forEach((id) => {
          updated[id] = isChecked;
        });
      });
      return updated;
    });
  }, [projects, projectDetails, getAllDescendantAssetIds]);

  const handleCheckAllInProject = useCallback((projectPath, event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prev) => {
      const updated = { ...prev };
      (projectDetails[projectPath] || []).forEach((item) => {
        updated[item.id] = isChecked;
        if (item.type === "Folder" && projectDetails[item.path]) {
          getAllDescendantAssetIds(item.path, projectDetails).forEach((id) => {
            updated[id] = isChecked;
          });
        }
      });
      return updated;
    });
  }, [projectDetails, getAllDescendantAssetIds]);

  const handleCheckAllInFolder = useCallback((folderPath, event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prev) => {
      const updated = { ...prev };
      (projectDetails[folderPath] || []).forEach((item) => {
        updated[item.id] = isChecked;
        if (item.type === "Folder" && projectDetails[item.path]) {
          getAllDescendantAssetIds(item.path, projectDetails).forEach((id) => {
            updated[id] = isChecked;
          });
        }
      });
      return updated;
    });
  }, [projectDetails, getAllDescendantAssetIds]);

  const areAllProjectChildrenChecked = useCallback((projectPath) => {
    const children = (projectDetails[projectPath] || []).filter((item) => item.type !== "Project");
    if (children.length === 0) return false;
    return children.every((item) => {
      if (!checkedItems[item.id]) return false;
      if (item.type === "Folder" && projectDetails[item.path]) {
        return getAllDescendantAssetIds(item.path, projectDetails).every((id) => checkedItems[id]);
      }
      return true;
    });
  }, [projectDetails, checkedItems, getAllDescendantAssetIds]);

  const areAllFolderChildrenChecked = useCallback((folderPath) => {
    const children = (projectDetails[folderPath] || []).filter((item) => item.type !== "Project");
    if (children.length === 0) return false;
    return children.every((item) => {
      if (!checkedItems[item.id]) return false;
      if (item.type === "Folder" && projectDetails[item.path]) {
        return getAllDescendantAssetIds(item.path, projectDetails).every((id) => checkedItems[id]);
      }
      return true;
    });
  }, [projectDetails, checkedItems, getAllDescendantAssetIds]);

  const selectedCount = useMemo(
    () => Object.values(checkedItems).filter(Boolean).length,
    [checkedItems]
  );

  const handleProcessClick = () => {
    const selectedAssets = [];
    projects.forEach((project) => {
      if (checkedItems[project.id]) {
        selectedAssets.push({ name: project.path, id: project.id, type: project.type });
      }
    });
    for (const pathKey in projectDetails) {
      projectDetails[pathKey]?.forEach((item) => {
        if (checkedItems[item.id] && !selectedAssets.some((a) => a.id === item.id)) {
          selectedAssets.push({ name: item.path, id: item.id, type: item.type });
        }
      });
    }
    setCheckedAssets(selectedAssets);
    setIsProcessing(true);
  };

  const handleResetSelection = useCallback(() => setCheckedItems({}), []);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.path?.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  if (isProcessing) {
    return (
      <ProcessPage
        selectedAssets={checkedAssets}
        serverUrl={serverUrl}
        sessionId={sessionId}
        onGoBack={() => setIsProcessing(false)}
      />
    );
  }

  return (
    <>
      <ProgressStepper currentStep={1} />
      <div className="homepage-container">
        <header className="homepage-header">
          <div className="homepage-header-row">
            <div>
              <h1>VCS Pipeline Migration</h1>
              <p className="homepage-subtitle">Browse and select assets from the source environment</p>
            </div>
            <button className="logout-button" onClick={onLogout}>Logout</button>
          </div>
        </header>

        <div className="homepage-content">
          <div className="homepage-toolbar">
            <button onClick={fetchProjects} disabled={loading} className="list-projects-button">
              {loading ? <ClipLoader color="#fff" size={18} /> : "List Projects"}
            </button>

            {projects.length > 0 && (
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter projects by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery("")}>&#x2715;</button>
                )}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="selection-summary">
                <span className="selection-badge">{selectedCount}</span>
                <span>asset{selectedCount !== 1 ? 's' : ''} selected</span>
                <button onClick={handleResetSelection} className="clear-selection-btn">Clear All</button>
              </div>
            )}
          </div>

          {error && <p className="error-message">Error: {error}</p>}

          {loading && (
            <div className="skeleton-list">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-row" />
              ))}
            </div>
          )}

          {!loading && filteredProjects.length > 0 && (
            <div className="projects-list">
              <h3>
                {searchQuery
                  ? `${filteredProjects.length} of ${projects.length} projects`
                  : `Total Projects Found: ${projects.length}`}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        onChange={handleCheckAllProjects}
                        checked={
                          projects.length > 0 &&
                          projects.every((p) => checkedItems[p.id] && areAllProjectChildrenChecked(p.path))
                        }
                        title="Select all projects"
                      />
                    </th>
                    <th>Path</th>
                    <th>Updated By</th>
                    <th>Update Time</th>
                    <th>Source Control</th>
                    <th>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <React.Fragment key={project.id}>
                      <tr onClick={() => fetchProjectDetails(project.path)} className="project-row">
                        <td style={{ textAlign: 'center' }}>
                          {detailsLoading[project.path] && !projectDetails[project.path]
                            ? <ClipLoader color="#007bff" size={14} />
                            : expandedProject === project.path
                            ? <BiCaretUp />
                            : <BiCaretDown />
                          }
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={checkedItems[project.id] || false}
                            onChange={() => handleCheckboxChange(project.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td><strong>{project.path}</strong></td>
                        <td>{project.updatedBy}</td>
                        <td>{new Date(project.updateTime).toLocaleString()}</td>
                        <td>
                          <AssetTypeBadge type={project.sourceControl ? "Enabled" : "Disabled"} />
                        </td>
                        <td className="hash-cell">
                          {project.sourceControl?.hash || "—"}
                        </td>
                      </tr>

                      {expandedProject === project.path && projectDetails[project.path] && (
                        <tr className="project-details-row">
                          <td colSpan="7">
                            <div className="project-details">
                              <div className="project-details-header">
                                <h4>Contents of: {project.path}</h4>
                                <span className="item-count">
                                  {projectDetails[project.path].length} item(s)
                                  {projectDetails[project.path].some(i => i.type === 'Folder') && (
                                    <span className="unloaded-hint"> — expand folders to load their contents</span>
                                  )}
                                </span>
                              </div>
                              {detailsError[project.path] ? (
                                <p className="error-message">Error: {detailsError[project.path]}</p>
                              ) : projectDetails[project.path].length > 0 ? (
                                <table>
                                  <thead>
                                    <tr>
                                      <th style={{ width: 28 }}></th>
                                      <th style={{ width: 32 }}>
                                        <input
                                          type="checkbox"
                                          onChange={(e) => handleCheckAllInProject(project.path, e)}
                                          checked={areAllProjectChildrenChecked(project.path)}
                                        />
                                      </th>
                                      <th>Asset Name</th>
                                      <th>Type</th>
                                      <th>Updated By</th>
                                      <th>Update Time</th>
                                      <th>Source Control</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {projectDetails[project.path].map((item) => (
                                      <React.Fragment key={item.id}>
                                        <tr className={item.type === "Folder" ? "folder-row" : ""}>
                                          <td style={{ textAlign: 'center' }}>
                                            {item.type === "Folder" && (
                                              <span
                                                onClick={(e) => { e.stopPropagation(); fetchFolderDetails(item.path); }}
                                                style={{ cursor: "pointer" }}
                                              >
                                                {detailsLoading[item.path] && !projectDetails[item.path]
                                                  ? <ClipLoader color="#f8c146" size={14} />
                                                  : expandedFolder[item.path]
                                                  ? <BiCaretUp />
                                                  : <BiCaretDown />
                                                }
                                              </span>
                                            )}
                                          </td>
                                          <td>
                                            <input
                                              type="checkbox"
                                              checked={checkedItems[item.id] || false}
                                              onChange={() => handleCheckboxChange(item.id)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </td>
                                          <td>{getAssetName(item.path, project.path)}</td>
                                          <td><AssetTypeBadge type={item.type} /></td>
                                          <td>{item.updatedBy}</td>
                                          <td>{new Date(item.updateTime).toLocaleString()}</td>
                                          <td>{item.sourceControl ? "Enabled" : "Disabled"}</td>
                                        </tr>

                                        {item.type === "Folder" && expandedFolder[item.path] && projectDetails[item.path] && (
                                          <tr>
                                            <td colSpan="7" className="folder-contents-cell">
                                              {detailsError[item.path] ? (
                                                <p className="error-message" style={{ margin: "12px 16px" }}>Error: {detailsError[item.path]}</p>
                                              ) : projectDetails[item.path].length > 0 ? (
                                                <div className="folder-contents-inner">
                                                  <table>
                                                    <thead>
                                                      <tr>
                                                        <th style={{ width: 28 }}></th>
                                                        <th style={{ width: 32 }}>
                                                          <input
                                                            type="checkbox"
                                                            onChange={(e) => handleCheckAllInFolder(item.path, e)}
                                                            checked={areAllFolderChildrenChecked(item.path)}
                                                          />
                                                        </th>
                                                        <th>Asset Name</th>
                                                        <th>Type</th>
                                                        <th>Updated By</th>
                                                        <th>Update Time</th>
                                                        <th>Source Control</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {projectDetails[item.path].map((subItem) => (
                                                        <tr key={subItem.id}>
                                                          <td></td>
                                                          <td>
                                                            <input
                                                              type="checkbox"
                                                              checked={checkedItems[subItem.id] || false}
                                                              onChange={() => handleCheckboxChange(subItem.id)}
                                                              onClick={(e) => e.stopPropagation()}
                                                            />
                                                          </td>
                                                          <td>{getAssetName(subItem.path, item.path)}</td>
                                                          <td><AssetTypeBadge type={subItem.type} /></td>
                                                          <td>{subItem.updatedBy}</td>
                                                          <td>{new Date(subItem.updateTime).toLocaleString()}</td>
                                                          <td>{subItem.sourceControl ? "Enabled" : "Disabled"}</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p style={{ margin: "12px 16px", fontSize: "13px", color: "#6c757d" }}>No assets found in this folder.</p>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p>No folders or assets found within this project.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedCount > 0 && (
            <div className="action-bar">
              <button onClick={handleProcessClick} className="process-button">
                Process {selectedCount} Asset{selectedCount !== 1 ? 's' : ''} →
              </button>
              <button onClick={handleResetSelection} className="reset-button">
                Reset Selection
              </button>
            </div>
          )}

          {projects.length === 0 && !loading && !error && (
            <div className="empty-state">
              <p>No projects loaded yet. Click <strong>List Projects</strong> to fetch them.</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}

export default HomePage;
