import React, { useState, useCallback } from "react";
import "./HomePage.css";
import { BiCaretDown, BiCaretUp } from "react-icons/bi";
import { ClipLoader } from "react-spinners";
import ProcessPage from "../processpage/ProcessPage";

function HomePage({ sessionId, serverUrl }) {
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

  /**
   * Helper function to recursively fetch all pages for a given API URL 
   * using the API's 'count' field to reliably limit the number of pages fetched.
   */
  const fetchAllPages = useCallback(async (baseUrl) => {
    let allObjects = [];
    let skip = 0;
    const pageSize = 200; // Fixed page size
    let totalCount = -1; // Sentinel value to check if count has been fetched

    // Ensure the URL includes $count=true to get the total count
    const countBaseUrl = `${baseUrl}&$count=true`;

    const myHeaders = new Headers();
    myHeaders.append("INFA-SESSION-ID", sessionId);

    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };

    while (true) {
      // The API call uses $top (pageSize) and $skip to fetch the next chunk
      const url = `${countBaseUrl}?limit=200&skip=${skip}`;
      
      const response = await fetch(url, requestOptions);
      if (!response.ok) {
        console.error(`Failed to fetch paginated data at skip=${skip}: ${response.status}`);
        break; 
      }

      const data = await response.json();
      const currentObjects = data.objects || [];

      // Capture total count on the first successful iteration
      if (totalCount === -1) {
        totalCount = data.count !== undefined ? data.count : currentObjects.length; 
        if (totalCount === 0) break; 
      }
      
      allObjects.push(...currentObjects);

      // Termination Condition: Stop if we've collected the expected total count, 
      // or if the server returned an empty array before the count was reached (safe fallback).
      if (allObjects.length >= totalCount || currentObjects.length === 0) {
        break;
      }
      
      // Increment skip for the next page
      skip += pageSize; 
    }
    return allObjects;
  }, [sessionId]);

  /**
   * NEW RECURSIVE CORE: Fetches the full hierarchy for a given path and returns the collected data.
   * This function does NOT update component state, preventing re-renders during recursion.
   */
  const fetchEntireHierarchy = useCallback(async (path) => {
    let collectedDetails = {};
    let collectedExpandedFolders = {};

    // Inner recursive function that updates the local collectedDetails/expandedFolders
    const recursiveFetch = async (currentPath) => {
      const baseUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${currentPath}'`;

      // 1. Fetch all assets/folders in the current path (all pages) using the count limiter
      const currentLevelObjects = await fetchAllPages(baseUrl);

      // 2. Store the current level's objects in the local collection
      collectedDetails[currentPath] = currentLevelObjects;
      
      // 3. Recursively fetch contents of all sub-folders
      for (const item of currentLevelObjects) {
        if (item.type === 'Folder') {
          // Mark the folder as expanded for the UI state
          collectedExpandedFolders[item.path] = true;
          // Recursive call
          await recursiveFetch(item.path);
        }
      }
    };
    
    // Start recursion for the initial path
    try {
        await recursiveFetch(path);
    } catch (e) {
        console.error("Error during recursive fetch:", e);
    }

    // Return the final collected data
    return { collectedDetails, collectedExpandedFolders };
  }, [serverUrl, fetchAllPages]);

  /**
   * MODIFIED: Fetches ALL projects by iterating through pages using fetchAllPages.
   */
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=type=='PROJECT'`;

      const allProjects = await fetchAllPages(baseUrl); 
      setProjects(allProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [serverUrl, fetchAllPages]);


  /**
   * MODIFIED: Triggers the full recursive fetch for a project.
   */
  const fetchProjectDetails = useCallback(async (projectPath) => {
    const isExpanded = expandedProject === projectPath;
    
    // Toggle collapse/expand if already fully loaded
    if (projectDetails[projectPath]) {
      setExpandedProject((prev) => (prev === projectPath ? null : projectPath));
      if (!isExpanded) {
         setExpandedProject(projectPath);
      }
      return;
    }

    setDetailsLoading((prev) => ({ ...prev, [projectPath]: true }));
    setDetailsError((prev) => ({ ...prev, [projectPath]: "" }));
    
    try {
        // Fetch ALL recursively outside of React state updates
        const { collectedDetails, collectedExpandedFolders } = await fetchEntireHierarchy(projectPath);

        // Update state in one go after all fetching is complete
        setProjectDetails(prev => ({ ...prev, ...collectedDetails }));
        setExpandedFolder(prev => ({ ...prev, ...collectedExpandedFolders }));
        setExpandedProject(projectPath);

    } catch (error) {
        console.error(`Error fetching details for ${projectPath}:`, error);
        setDetailsError((prev) => ({ ...prev, [projectPath]: error.message }));
    } finally {
        setDetailsLoading((prev) => ({ ...prev, [projectPath]: false }));
    }
  }, [expandedProject, projectDetails, fetchEntireHierarchy]);


  /**
   * MODIFIED: Triggers the full recursive fetch for a folder.
   */
  const fetchFolderDetails = useCallback(async (folderPath) => {
    const isExpanded = expandedFolder[folderPath];
    // Toggle visibility first
    setExpandedFolder((prev) => ({ ...prev, [folderPath]: !isExpanded }));

    // If folder details are already loaded, we just toggled visibility, so we are done.
    if (projectDetails[folderPath]) {
      return;
    }

    setDetailsLoading((prev) => ({ ...prev, [folderPath]: true }));
    setDetailsError((prev) => ({ ...prev, [folderPath]: "" }));
    
    try {
        // Fetch ALL recursively outside of React state updates
        const { collectedDetails, collectedExpandedFolders } = await fetchEntireHierarchy(folderPath);

        // Update state in one go after all fetching is complete
        setProjectDetails(prev => ({ ...prev, ...collectedDetails }));
        setExpandedFolder(prev => ({ ...prev, ...collectedExpandedFolders }));

    } catch (error) {
        console.error(`Error fetching details for ${folderPath}:`, error);
        setDetailsError((prev) => ({ ...prev, [folderPath]: error.message }));
    } finally {
        setDetailsLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  }, [projectDetails, expandedFolder, fetchEntireHierarchy]);


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

      if (visitedPaths.has(currentPath)) {
        continue;
      }
      visitedPaths.add(currentPath);

      if (allProjectDetails[currentPath]) {
        allProjectDetails[currentPath].forEach(child => {
          if (child.type && child.type !== 'Project') {
            descendantIds.add(child.id);
            if (child.type === 'Folder' && allProjectDetails[child.path]) {
              queue.push(child.path);
            }
          }
        });
      }
    }
    return Array.from(descendantIds);
  }, []);

  const handleCheckboxChange = useCallback((itemId) => {
    setCheckedItems((prevCheckedItems) => ({
      ...prevCheckedItems,
      [itemId]: !prevCheckedItems[itemId],
    }));
  }, []);

  const handleCheckAllProjects = useCallback((event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prevCheckedItems) => {
      const updatedCheckedItems = { ...prevCheckedItems };

      projects.forEach((project) => {
        updatedCheckedItems[project.id] = isChecked; 
        const projectDescendantIds = getAllDescendantAssetIds(project.path, projectDetails);
        projectDescendantIds.forEach(id => {
          updatedCheckedItems[id] = isChecked;
        });
      });
      return updatedCheckedItems;
    });
  }, [projects, projectDetails, getAllDescendantAssetIds]);

  const handleCheckAllInProject = useCallback((projectPath, event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prevCheckedItems) => {
      const updatedCheckedItems = { ...prevCheckedItems };
      const directProjectChildren = projectDetails[projectPath] || [];

      directProjectChildren.forEach((item) => {
        updatedCheckedItems[item.id] = isChecked;
        if (item.type === 'Folder' && projectDetails[item.path]) {
          const folderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
          folderDescendantIds.forEach(id => {
            updatedCheckedItems[id] = isChecked;
          });
        }
      });
      return updatedCheckedItems;
    });
  }, [projectDetails, getAllDescendantAssetIds]);

  const handleCheckAllInFolder = useCallback((folderPath, event) => {
    const isChecked = event.target.checked;
    setCheckedItems((prevCheckedItems) => {
      const updatedCheckedItems = { ...prevCheckedItems };
      const directFolderChildren = projectDetails[folderPath] || [];

      directFolderChildren.forEach((item) => {
        updatedCheckedItems[item.id] = isChecked;
        if (item.type === 'Folder' && projectDetails[item.path]) {
          const subFolderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
          subFolderDescendantIds.forEach(id => {
            updatedCheckedItems[id] = isChecked;
          });
        }
      });
      return updatedCheckedItems;
    });
  }, [projectDetails, getAllDescendantAssetIds]);

  const areAllProjectChildrenChecked = useCallback((projectPath) => {
    const children = projectDetails[projectPath]?.filter(item => item.type !== "Project") || [];
    if (children.length === 0) return false; 

    return children.every(item => {
      if (!checkedItems[item.id]) return false;
      if (item.type === 'Folder' && expandedFolder[item.path]) {
        const folderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
        return folderDescendantIds.every(id => checkedItems[id]);
      }
      return true; 
    });
  }, [projectDetails, checkedItems, expandedFolder, getAllDescendantAssetIds]);

  const areAllFolderChildrenChecked = useCallback((folderPath) => {
    const children = projectDetails[folderPath]?.filter(item => item.type !== "Project") || [];
    if (children.length === 0) return false;

    return children.every(item => {
      if (!checkedItems[item.id]) return false;
      if (item.type === 'Folder' && expandedFolder[item.path]) {
        const subFolderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
        return subFolderDescendantIds.every(id => checkedItems[id]);
      }
      return true; 
    });
  }, [projectDetails, checkedItems, expandedFolder, getAllDescendantAssetIds]);


  const handleProcessClick = () => {
    const selectedAssets = [];
    projects.forEach(project => {
      if (checkedItems[project.id]) {
        selectedAssets.push({
          name: project.path,
          id: project.id,
          type: project.type,
        });
      }
    });

    for (const pathKey in projectDetails) {
      projectDetails[pathKey]?.forEach(item => {
        if (checkedItems[item.id] && !selectedAssets.some(asset => asset.id === item.id)) {
          selectedAssets.push({
            name: item.path, 
            id: item.id,
            type: item.type,
          });
        }
      });
    }

    console.log("Selected Assets for Processing:", selectedAssets);
    setCheckedAssets(selectedAssets);
    setIsProcessing(true);
  };

  const handleResetSelection = useCallback(() => {
    setCheckedItems({});
  }, []);


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
    <div className="homepage-container">
      <header className="homepage-header">
        <h1>Welcome to VCS Pipeline Migration tool</h1>
      </header>

      <div className="homepage-content">
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="list-projects-button"
        >
          {loading ? (
            <ClipLoader
              color="#007bff"
              size={20}
              loading={loading}
              aria-label="loading-indicator"
            />
          ) : (
            "List Projects"
          )}
        </button>

        {loading && (
          <div className="loading-indicator">
            <p>Fetching Projects...</p>
          </div>
        )}

        {error && <p className="error-message">Error: {error}</p>}

        {projects.length > 0 && (
          <div className="projects-list">
            <h3>Total Projects Found: {projects.length}</h3>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>
                    <input
                      type="checkbox"
                      onChange={handleCheckAllProjects}
                      checked={
                        projects.length > 0 &&
                        projects.every(project => checkedItems[project.id] && areAllProjectChildrenChecked(project.path))
                      }
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
                {projects.map((project) => (
                  <React.Fragment key={project.id}>
                    <tr
                      onClick={() => fetchProjectDetails(project.path)}
                      className="project-row"
                    >
                      <td>
                        {projectDetails[project.path] ? (
                          expandedProject === project.path ? (
                            <BiCaretUp />
                          ) : (
                            <BiCaretDown />
                          )
                        ) : (
                          <BiCaretDown />
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={checkedItems[project.id] || false}
                          onChange={() => handleCheckboxChange(project.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>{project.path}</td>
                      <td>{project.updatedBy}</td>
                      <td>{new Date(project.updateTime).toLocaleString()}</td>
                      <td>{project.sourceControl ? "Enabled" : "Disabled"}</td>
                      <td>
                        {project.sourceControl && project.sourceControl.hash
                          ? project.sourceControl.hash
                          : "-"}
                      </td>
                    </tr>
                    {expandedProject === project.path &&
                      projectDetails[project.path] && (
                        <tr className="project-details-row">
                          <td colSpan="7">
                            <div className="project-details">
                              <h4>Details for {project.path}:</h4>
                              {/* Loading check for the current path's details */}
                              {detailsLoading[project.path] && projectDetails[project.path].length === 0 ? (
                                <div className="loading-indicator">
                                  <ClipLoader
                                    color="#28a745"
                                    size={30}
                                    loading={detailsLoading[project.path]}
                                    aria-label="loading-indicator"
                                  />
                                  <p>Loading ALL contents recursively...</p>
                                </div>
                              ) : detailsError[project.path] ? (
                                <p className="error-message">
                                  Error loading details:{" "}
                                  {detailsError[project.path]}
                                </p>
                              ) : projectDetails[project.path].length > 0 ? (
                                <>
                                  <p style={{margin: '10px 0', padding: '5px', fontSize: '14px', borderTop: '1px solid #eee', borderBottom: '1px solid #eee'}}>
                                    Total Items in this Project Level: **{projectDetails[project.path].length}**
                                  </p>
                                  <table>
                                  <thead>
                                    <tr>
                                      <th></th>
                                      <th>
                                        <input
                                          type="checkbox"
                                          onChange={(e) =>
                                            handleCheckAllInProject(
                                              project.path, e 
                                            )
                                          }
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
                                    {projectDetails[project.path]
                                      .map((item) => (
                                        <React.Fragment key={item.id}>
                                          <tr
                                            className={
                                              item.type === "Folder"
                                                ? "folder-row"
                                                : ""
                                            }
                                          >
                                            <td>
                                              {item.type === "Folder" && (
                                                <span
                                                  onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    fetchFolderDetails(item.path);
                                                  }}
                                                  style={{ cursor: "pointer" }}
                                                >
                                                  {expandedFolder[item.path] ? (
                                                    <BiCaretUp />
                                                  ) : (
                                                    <BiCaretDown />
                                                  )}
                                                </span>
                                              )}
                                            </td>
                                            <td>
                                              <input
                                                type="checkbox"
                                                checked={
                                                  checkedItems[item.id] || false
                                                }
                                                onChange={() =>
                                                  handleCheckboxChange(item.id)
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                            </td>
                                            <td>
                                              {getAssetName(
                                                item.path,
                                                project.path
                                              )}
                                            </td>
                                            <td>{item.type}</td>
                                            <td>{item.updatedBy}</td>
                                            <td>
                                              {new Date(
                                                item.updateTime
                                              ).toLocaleString()}
                                            </td>
                                            <td>
                                              {item.sourceControl
                                                ? "Enabled"
                                                : "Disabled"}
                                            </td>
                                          </tr>
                                          {item.type === "Folder" &&
                                            expandedFolder[item.path] &&
                                            projectDetails[item.path] && (
                                              <tr>
                                                <td
                                                  colSpan="7" 
                                                  style={{
                                                    paddingLeft: "30px",
                                                  }}
                                                >
                                                  {/* Folder contents section */}
                                                  {detailsLoading[item.path] && projectDetails[item.path].length === 0 ? (
                                                    <div
                                                      className="loading-indicator"
                                                      style={{
                                                        marginLeft: "30px",
                                                      }}
                                                    >
                                                      {" "}
                                                      <ClipLoader
                                                        color="#f8c146"
                                                        size={20} 
                                                        loading={
                                                          detailsLoading[
                                                          item.path
                                                          ]
                                                        }
                                                        aria-label="loading-indicator"
                                                      />
                                                      <p>Loading ALL contents recursively...</p>
                                                    </div>
                                                  ) : detailsError[
                                                    item.path
                                                  ] ? (
                                                    <p className="error-message">
                                                      Error loading contents:{" "}
                                                      {detailsError[item.path]}
                                                    </p>
                                                  ) : projectDetails[item.path]
                                                    .length > 0 ? (
                                                    <>
                                                      <p style={{margin: '10px 0', padding: '5px', fontSize: '14px', borderTop: '1px solid #eee', borderBottom: '1px solid #eee'}}>
                                                        Total Items in this Folder Level: **{projectDetails[item.path].length}**
                                                      </p>
                                                      <table>
                                                        <thead>
                                                          <tr>
                                                            <th></th> 
                                                            <th>
                                                              <input
                                                                type="checkbox"
                                                                onChange={(e) =>
                                                                  handleCheckAllInFolder(
                                                                    item.path, e 
                                                                  )
                                                                }
                                                                checked={areAllFolderChildrenChecked(item.path)}
                                                              />
                                                            </th>{" "}
                                                            <th>Asset Name</th>
                                                            <th>Type</th>
                                                            <th>Updated By</th>{" "}
                                                            <th>Update Time</th>{" "}
                                                            <th>Source Control</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {projectDetails[
                                                            item.path
                                                          ]
                                                            .map((subItem) => (
                                                              <tr
                                                                key={subItem.id}
                                                              >
                                                                <td></td> 
                                                                <td>
                                                                  <input
                                                                    type="checkbox"
                                                                    checked={
                                                                      checkedItems[
                                                                      subItem.id
                                                                      ] || false
                                                                    }
                                                                    onChange={() =>
                                                                      handleCheckboxChange(
                                                                        subItem.id
                                                                      )
                                                                    }
                                                                    onClick={(e) => e.stopPropagation()}
                                                                  />
                                                                </td>
                                                                <td>
                                                                  {getAssetName(
                                                                    subItem.path,
                                                                    item.path
                                                                  )}
                                                                </td>
                                                                <td>
                                                                  {subItem.type}
                                                                </td>
                                                                <td>
                                                                  {
                                                                    subItem.updatedBy
                                                                  }
                                                                </td>{" "}
                                                                <td>
                                                                  {new Date(
                                                                    subItem.updateTime
                                                                  ).toLocaleString()}
                                                                </td>{" "}
                                                                <td>
                                                                  {subItem.sourceControl
                                                                    ? "Enabled"
                                                                    : "Disabled"}
                                                                </td>
                                                              </tr>
                                                            ))}
                                                        </tbody>
                                                      </table>
                                                    </>
                                                  ) : (
                                                    <p>
                                                      No assets found in this
                                                      folder.
                                                    </p>
                                                  )}
                                                </td>
                                              </tr>
                                            )}
                                        </React.Fragment>
                                      ))}
                                  </tbody>
                                </table>
                                </>
                              ) : (
                                <p>
                                  No folders or assets found within this
                                  project.
                                </p>
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

        {Object.keys(checkedItems).length > 0 && (
          <>
            <button onClick={handleProcessClick} className="process-button">
              Process
            </button>
            <button onClick={handleResetSelection} className="reset-button">
              Reset Selection
            </button>
          </>
        )}

        {projects.length === 0 && !loading && !error && (
          <p>No projects found. Click 'List Projects' to fetch them.</p>
        )}
      </div>
    </div>
  );
}

export default HomePage;