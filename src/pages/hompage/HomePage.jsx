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

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      const apiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=type=='PROJECT'`;

      const response = await fetch(apiUrl, requestOptions);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to fetch projects: ${response.status} - ${text}`
        );
      }
      const data = await response.json();
      setProjects(data.objects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, serverUrl]);

  const fetchProjectDetails = useCallback(async (projectPath) => {
    // Toggle collapse/expand if already loaded
    if (projectDetails[projectPath]) {
      setExpandedProject((prev) => (prev === projectPath ? null : projectPath));
      return;
    }

    setDetailsLoading((prev) => ({ ...prev, [projectPath]: true }));
    setDetailsError((prev) => ({ ...prev, [projectPath]: "" }));

    try {
      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      // Fetch direct children of the project
      const apiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${projectPath}'`;

      const response = await fetch(apiUrl, requestOptions);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to fetch details for ${projectPath}: ${response.status} - ${text}`
        );
      }
      const data = await response.json();
      setProjectDetails((prev) => ({ ...prev, [projectPath]: data.objects }));
      setExpandedProject(projectPath); // Always expand when new data is fetched
    } catch (error) {
      console.error(`Error fetching details for ${projectPath}:`, error);
      setDetailsError((prev) => ({ ...prev, [projectPath]: error.message }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [projectPath]: false }));
    }
  }, [sessionId, serverUrl, projectDetails, expandedProject]);

  const fetchFolderDetails = useCallback(async (folderPath) => {
    // Toggle collapse/expand
    setExpandedFolder((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));

    // If folder details are already loaded, just toggle visibility
    if (projectDetails[folderPath]) {
      return;
    }

    setDetailsLoading((prev) => ({ ...prev, [folderPath]: true }));
    setDetailsError((prev) => ({ ...prev, [folderPath]: "" }));

    try {
      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      const apiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${folderPath}'`;

      const response = await fetch(apiUrl, requestOptions);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to fetch details for ${folderPath}: ${response.status} - ${text}`
        );
      }
      const data = await response.json();
      setProjectDetails((prev) => ({ ...prev, [folderPath]: data.objects }));
    } catch (error) {
      console.error(`Error fetching details for ${folderPath}:`, error);
      setDetailsError((prev) => ({ ...prev, [folderPath]: error.message }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  }, [sessionId, serverUrl, projectDetails]);

  const getAssetName = useCallback((path, parentPath) => {
    if (path && parentPath && path.startsWith(parentPath + "/")) {
      return path.substring(parentPath.length + 1);
    }
    return path;
  }, []);

  // Helper function to recursively get all descendant asset IDs of a given parent (project or folder)
  // It traverses the projectDetails state to find all assets nested under the given parent's path.
  // IMPORTANT: This only works for data that is ALREADY LOADED in `projectDetails`.
  // If a folder is not expanded and its details haven't been fetched, its contents won't be included.
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
          if (child.type && child.type !== 'Project') { // Include Folders in the traversal
            descendantIds.add(child.id); // Add both assets and folders for selection
            if (child.type === 'Folder' && allProjectDetails[child.path]) { // Only queue if folder details are already loaded
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
        updatedCheckedItems[project.id] = isChecked; // Select/deselect the project itself

        // Get all descendant IDs for this project that are CURRENTLY LOADED
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

      // Get all direct children (folders and assets) of this project that are CURRENTLY LOADED
      const directProjectChildren = projectDetails[projectPath] || [];

      directProjectChildren.forEach((item) => {
        // Select/deselect the direct child itself (whether it's a folder or an asset)
        updatedCheckedItems[item.id] = isChecked;

        // If the direct child is a folder AND its contents are loaded,
        // recursively get and update its descendant assets/folders.
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

      // Get all direct children (assets and sub-folders) of this folder that are CURRENTLY LOADED
      const directFolderChildren = projectDetails[folderPath] || [];

      directFolderChildren.forEach((item) => {
        // Select/deselect the direct child itself (whether it's a folder or an asset)
        updatedCheckedItems[item.id] = isChecked;

        // If the direct child is a folder AND its contents are loaded,
        // recursively get and update its descendant assets/folders.
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


  // Helper to determine if all *loaded* children of a project are checked for the project's "select all" checkbox
  const areAllProjectChildrenChecked = useCallback((projectPath) => {
    const children = projectDetails[projectPath]?.filter(item => item.type !== "Project") || [];
    if (children.length === 0) return false; // If no children, it's not "all checked"

    return children.every(item => {
      // Check the item itself
      if (!checkedItems[item.id]) return false;

      // If it's a folder, also check if all its currently loaded descendants are checked
      if (item.type === 'Folder' && expandedFolder[item.path]) {
        const folderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
        return folderDescendantIds.every(id => checkedItems[id]);
      }
      return true; // It's an asset and it's checked
    });
  }, [projectDetails, checkedItems, expandedFolder, getAllDescendantAssetIds]);

  // Helper to determine if all *loaded* children of a folder are checked for the folder's "select all" checkbox
  const areAllFolderChildrenChecked = useCallback((folderPath) => {
    const children = projectDetails[folderPath]?.filter(item => item.type !== "Project") || [];
    if (children.length === 0) return false;

    return children.every(item => {
      // Check the item itself
      if (!checkedItems[item.id]) return false;

      // If it's a folder, also check if all its currently loaded descendants are checked
      if (item.type === 'Folder' && expandedFolder[item.path]) {
        const subFolderDescendantIds = getAllDescendantAssetIds(item.path, projectDetails);
        return subFolderDescendantIds.every(id => checkedItems[id]);
      }
      return true; // It's an asset and it's checked
    });
  }, [projectDetails, checkedItems, expandedFolder, getAllDescendantAssetIds]);


  const handleProcessClick = () => {
    const selectedAssets = [];
    // Iterate over projects to find checked projects
    projects.forEach(project => {
      if (checkedItems[project.id]) {
        selectedAssets.push({
          name: project.path,
          id: project.id,
          type: project.type,
        });
      }
    });

    // Iterate over projectDetails to find checked assets/folders (including nested ones)
    // This approach ensures we capture all checked items regardless of their depth
    for (const pathKey in projectDetails) {
      projectDetails[pathKey]?.forEach(item => {
        if (checkedItems[item.id] && !selectedAssets.some(asset => asset.id === item.id)) {
          selectedAssets.push({
            name: item.path, // Use item.path for full path
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
            <h3>Total Projects: {projects.length}</h3>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>
                    <input
                      type="checkbox"
                      onChange={handleCheckAllProjects}
                      // Determine if all top-level projects (and their loaded children) are checked
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
                          // Stop propagation to prevent row click from toggling details
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
                          <td colSpan="7"> {/* Adjusted colSpan to match parent table headers */}
                            <div className="project-details">
                              <h4>Details for {project.path}:</h4>
                              {detailsLoading[project.path] ? (
                                <div className="loading-indicator">
                                  <ClipLoader
                                    color="#28a745"
                                    size={30}
                                    loading={detailsLoading[project.path]}
                                    aria-label="loading-indicator"
                                  />
                                  <p>Loading contents...</p>
                                </div>
                              ) : detailsError[project.path] ? (
                                <p className="error-message">
                                  Error loading details:{" "}
                                  {detailsError[project.path]}
                                </p>
                              ) : projectDetails[project.path].length > 0 ? (
                                <table>
                                  <thead>
                                    <tr>
                                      <th></th> {/* Empty header for expand/collapse icon */}
                                      <th>
                                        <input
                                          type="checkbox"
                                          onChange={(e) =>
                                            handleCheckAllInProject(
                                              project.path, e // Pass event here
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
                                      // .filter((item) => item.type !== "Project") // Filter out projects if they appear here
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
                                                    e.stopPropagation(); // Prevent folder click from toggling project details
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
                                                // Stop propagation to prevent row click from toggling details
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
                                                  colSpan="7" // Adjusted colSpan
                                                  style={{
                                                    paddingLeft: "30px",
                                                  }}
                                                >
                                                  {detailsLoading[item.path] ? (
                                                    <div
                                                      className="loading-indicator"
                                                      style={{
                                                        marginLeft: "30px",
                                                      }}
                                                    >
                                                      {" "}
                                                      <ClipLoader
                                                        color="#f8c146"
                                                        size={20} // Smaller loader for nested
                                                        loading={
                                                          detailsLoading[
                                                          item.path
                                                          ]
                                                        }
                                                        aria-label="loading-indicator"
                                                      />
                                                      <p>Loading contents...</p>
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
                                                    <table>
                                                      <thead>
                                                        <tr>
                                                          <th></th> {/* Empty header for visual alignment */}
                                                          <th>
                                                            <input
                                                              type="checkbox"
                                                              onChange={(e) =>
                                                                handleCheckAllInFolder(
                                                                  item.path, e // Pass event here
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
                                                          // .filter(
                                                          //   (subItem) =>
                                                          //     subItem.type !==
                                                          //     "Folder" // Filter out sub-folders if you only want assets here, but `getAllDescendantAssetIds` will include them
                                                          // )
                                                          .map((subItem) => (
                                                            <tr
                                                              key={subItem.id}
                                                            >
                                                              <td></td> {/* Empty cell for alignment */}
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
                                                              {/* Added Data */}
                                                              <td>
                                                                {new Date(
                                                                  subItem.updateTime
                                                                ).toLocaleString()}
                                                              </td>{" "}
                                                              {/* Added Data */}
                                                              <td>
                                                                {subItem.sourceControl
                                                                  ? "Enabled"
                                                                  : "Disabled"}
                                                              </td>
                                                            </tr>
                                                          ))}
                                                      </tbody>
                                                    </table>
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