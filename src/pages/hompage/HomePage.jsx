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
      // NOTE: The original code used '?limit=200&skip=${skip}' which might conflict with existing query params.
      // Assuming the API expects '&limit=200&skip=${skip}' when added to 'countBaseUrl'
      const url = `${countBaseUrl}&limit=${pageSize}&skip=${skip}`;

      const response = await fetch(url, requestOptions);
      if (!response.ok) {
        // You might want to throw an error here to be caught by the caller
        console.error(
          `Failed to fetch paginated data at skip=${skip}: ${response.status}`
        );
        break;
      }

      const data = await response.json();
      const currentObjects = data.objects || [];

      // Capture total count on the first successful iteration
      if (totalCount === -1) {
        totalCount =
          data.count !== undefined ? data.count : currentObjects.length;
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
   * MODIFIED CORE: Fetches ONLY the immediate children for a given path (one level deep).
   * It is no longer recursive.
   * * @param {string} path - The parent path (Project or Folder)
   * @returns {Array<Object>} The list of immediate children assets/folders.
   */
  const fetchSingleLevelDetails = useCallback(
    async (path) => {
      const baseUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${path}'`;

      // Fetch all assets/folders in the current path (all pages) using the count limiter
      const currentLevelObjects = await fetchAllPages(baseUrl);

      // Return the fetched objects for the current level
      return currentLevelObjects;
    },
    [serverUrl, fetchAllPages]
  );

  /**
   * MODIFIED: Fetches ALL projects by iterating through pages using fetchAllPages.
   * (No changes needed here)
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
   * MODIFIED: Triggers the SINGLE-LEVEL fetch for a project.
   * Only fetches the immediate children of the project.
   */
  const fetchProjectDetails = useCallback(
    async (projectPath) => {
      const isExpanded = expandedProject === projectPath;

      // Toggle collapse/expand if already loaded
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
        // Fetch only the direct children (one level deep)
        const collectedDetails = await fetchSingleLevelDetails(projectPath);

        // Update state with only the current path's details
        setProjectDetails((prev) => ({ ...prev, [projectPath]: collectedDetails }));

        // We no longer automatically set expanded folders, as they are not pre-fetched.
        setExpandedProject(projectPath);
      } catch (error) {
        console.error(`Error fetching details for ${projectPath}:`, error);
        setDetailsError((prev) => ({ ...prev, [projectPath]: error.message }));
      } finally {
        setDetailsLoading((prev) => ({ ...prev, [projectPath]: false }));
      }
    },
    [expandedProject, projectDetails, fetchSingleLevelDetails]
  );

  /**
   * MODIFIED: Triggers the SINGLE-LEVEL fetch for a folder.
   * Only fetches the immediate children of the folder upon expansion.
   */
  const fetchFolderDetails = useCallback(
    async (folderPath) => {
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
        // Fetch only the direct children (one level deep)
        const collectedDetails = await fetchSingleLevelDetails(folderPath);

        // Update state with only the current path's details
        setProjectDetails((prev) => ({ ...prev, [folderPath]: collectedDetails }));
        // The setExpandedFolder was already updated above to 'true' if we were fetching.
      } catch (error) {
        console.error(`Error fetching details for ${folderPath}:`, error);
        setDetailsError((prev) => ({ ...prev, [folderPath]: error.message }));
        // If fetching fails, turn off the expansion toggle to avoid a broken UI state
        setExpandedFolder((prev) => ({ ...prev, [folderPath]: false }));
      } finally {
        setDetailsLoading((prev) => ({ ...prev, [folderPath]: false }));
      }
    },
    [projectDetails, expandedFolder, fetchSingleLevelDetails]
  );

  // Remaining utility functions (getAssetName, getAllDescendantAssetIds, handleCheckboxChange,
  // handleCheckAllProjects, handleCheckAllInProject, handleCheckAllInFolder, areAllProjectChildrenChecked,
  // areAllFolderChildrenChecked, handleProcessClick, handleResetSelection) remain the SAME.

  const getAssetName = useCallback((path, parentPath) => {
    if (path && parentPath && path.startsWith(parentPath + "/")) {
      return path.substring(parentPath.length + 1);
    }
    return path;
  }, []);

  const getAllDescendantAssetIds = useCallback(
    (parentPath, allProjectDetails) => {
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
          allProjectDetails[currentPath].forEach((child) => {
            if (child.type && child.type !== "Project") {
              descendantIds.add(child.id);
              // This condition is now crucial: it checks for descendants ONLY in already loaded paths
              if (child.type === "Folder" && allProjectDetails[child.path]) {
                queue.push(child.path);
              }
            }
          });
        }
      }
      return Array.from(descendantIds);
    },
    []
  );

  const handleCheckboxChange = useCallback((itemId) => {
    setCheckedItems((prevCheckedItems) => ({
      ...prevCheckedItems,
      [itemId]: !prevCheckedItems[itemId],
    }));
  }, []);

  const handleCheckAllProjects = useCallback(
    (event) => {
      const isChecked = event.target.checked;
      setCheckedItems((prevCheckedItems) => {
        const updatedCheckedItems = { ...prevCheckedItems };

        projects.forEach((project) => {
          updatedCheckedItems[project.id] = isChecked;
          const projectDescendantIds = getAllDescendantAssetIds(
            project.path,
            projectDetails
          );
          projectDescendantIds.forEach((id) => {
            updatedCheckedItems[id] = isChecked;
          });
        });
        return updatedCheckedItems;
      });
    },
    [projects, projectDetails, getAllDescendantAssetIds]
  );

  const handleCheckAllInProject = useCallback(
    (projectPath, event) => {
      const isChecked = event.target.checked;
      setCheckedItems((prevCheckedItems) => {
        const updatedCheckedItems = { ...prevCheckedItems };
        const directProjectChildren = projectDetails[projectPath] || [];

        directProjectChildren.forEach((item) => {
          updatedCheckedItems[item.id] = isChecked;
          if (item.type === "Folder" && projectDetails[item.path]) {
            const folderDescendantIds = getAllDescendantAssetIds(
              item.path,
              projectDetails
            );
            folderDescendantIds.forEach((id) => {
              updatedCheckedItems[id] = isChecked;
            });
          }
        });
        return updatedCheckedItems;
      });
    },
    [projectDetails, getAllDescendantAssetIds]
  );

  const handleCheckAllInFolder = useCallback(
    (folderPath, event) => {
      const isChecked = event.target.checked;
      setCheckedItems((prevCheckedItems) => {
        const updatedCheckedItems = { ...prevCheckedItems };
        const directFolderChildren = projectDetails[folderPath] || [];

        directFolderChildren.forEach((item) => {
          updatedCheckedItems[item.id] = isChecked;
          if (item.type === "Folder" && projectDetails[item.path]) {
            const subFolderDescendantIds = getAllDescendantAssetIds(
              item.path,
              projectDetails
            );
            subFolderDescendantIds.forEach((id) => {
              updatedCheckedItems[id] = isChecked;
            });
          }
        });
        return updatedCheckedItems;
      });
    },
    [projectDetails, getAllDescendantAssetIds]
  );

  const areAllProjectChildrenChecked = useCallback(
    (projectPath) => {
      const children =
        projectDetails[projectPath]?.filter((item) => item.type !== "Project") ||
        [];
      if (children.length === 0) return false;

      return children.every((item) => {
        if (!checkedItems[item.id]) return false;
        // This logic correctly accounts for selected items that have ALREADY been loaded (lazy loading)
        if (item.type === "Folder" && projectDetails[item.path]) {
          const folderDescendantIds = getAllDescendantAssetIds(
            item.path,
            projectDetails
          );
          return folderDescendantIds.every((id) => checkedItems[id]);
        }
        return true;
      });
    },
    [projectDetails, checkedItems, getAllDescendantAssetIds]
  );

  const areAllFolderChildrenChecked = useCallback(
    (folderPath) => {
      const children =
        projectDetails[folderPath]?.filter((item) => item.type !== "Project") ||
        [];
      if (children.length === 0) return false;

      return children.every((item) => {
        if (!checkedItems[item.id]) return false;
        // This logic correctly accounts for selected items that have ALREADY been loaded (lazy loading)
        if (item.type === "Folder" && projectDetails[item.path]) {
          const subFolderDescendantIds = getAllDescendantAssetIds(
            item.path,
            projectDetails
          );
          return subFolderDescendantIds.every((id) => checkedItems[id]);
        }
        return true;
      });
    },
    [projectDetails, checkedItems, getAllDescendantAssetIds]
  );

  const handleProcessClick = () => {
    const selectedAssets = [];
    projects.forEach((project) => {
      if (checkedItems[project.id]) {
        selectedAssets.push({
          name: project.path,
          id: project.id,
          type: project.type,
        });
      }
    });

    for (const pathKey in projectDetails) {
      projectDetails[pathKey]?.forEach((item) => {
        if (
          checkedItems[item.id] &&
          !selectedAssets.some((asset) => asset.id === item.id)
        ) {
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
              color="#ffffff" // Changed color for better visibility on a blue button
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
                        projects.every(
                          (project) =>
                            checkedItems[project.id] &&
                            areAllProjectChildrenChecked(project.path)
                        )
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
                        {/* PROJECT LOADER/TOGGLE ICON LOGIC */}
                        {detailsLoading[project.path] &&
                        !projectDetails[project.path] ? (
                          <ClipLoader color="#007bff" size={15} />
                        ) : projectDetails[project.path] ? (
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
                      <td>
                        {project.sourceControl ? "Enabled" : "Disabled"}
                      </td>
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
                              {/* NOTE: We removed the loading indicator here because it only loads one level deep now */}
                              {detailsError[project.path] ? (
                                <p className="error-message">
                                  Error loading details:{" "}
                                  {detailsError[project.path]}
                                </p>
                              ) : projectDetails[project.path].length > 0 ? (
                                <>
                                  <p
                                    style={{
                                      margin: "10px 0",
                                      padding: "5px",
                                      fontSize: "14px",
                                      borderTop: "1px solid #eee",
                                      borderBottom: "1px solid #eee",
                                    }}
                                  >
                                    Total Items in this Project Level: **
                                    {projectDetails[project.path].length}**
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
                                                project.path,
                                                e
                                              )
                                            }
                                            checked={areAllProjectChildrenChecked(
                                              project.path
                                            )}
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
                                      {projectDetails[project.path].map(
                                        (item) => (
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
                                                      fetchFolderDetails(
                                                        item.path
                                                      );
                                                    }}
                                                    style={{
                                                      cursor: "pointer",
                                                    }}
                                                  >
                                                    {/* FOLDER LOADER/TOGGLE ICON LOGIC */}
                                                    {detailsLoading[
                                                      item.path
                                                    ] &&
                                                    !projectDetails[
                                                      item.path
                                                    ] ? (
                                                      <ClipLoader
                                                        color="#f8c146"
                                                        size={15}
                                                      />
                                                    ) : expandedFolder[
                                                        item.path
                                                      ] ? (
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
                                                    checkedItems[item.id] ||
                                                    false
                                                  }
                                                  onChange={() =>
                                                    handleCheckboxChange(
                                                      item.id
                                                    )
                                                  }
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
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
                                                    {detailsError[item.path] ? (
                                                      <p className="error-message">
                                                        Error loading contents:{" "}
                                                        {
                                                          detailsError[
                                                            item.path
                                                          ]
                                                        }
                                                      </p>
                                                    ) : projectDetails[item.path]
                                                        .length > 0 ? (
                                                      <>
                                                        <p
                                                          style={{
                                                            margin: "10px 0",
                                                            padding: "5px",
                                                            fontSize: "14px",
                                                            borderTop:
                                                              "1px solid #eee",
                                                            borderBottom:
                                                              "1px solid #eee",
                                                          }}
                                                        >
                                                          Total Items in this
                                                          Folder Level: **
                                                          {
                                                            projectDetails[
                                                              item.path
                                                            ].length
                                                          }
                                                          **
                                                        </p>
                                                        <table>
                                                          <thead>
                                                            <tr>
                                                              <th></th>
                                                              <th>
                                                                <input
                                                                  type="checkbox"
                                                                  onChange={(
                                                                    e
                                                                  ) =>
                                                                    handleCheckAllInFolder(
                                                                      item.path,
                                                                      e
                                                                    )
                                                                  }
                                                                  checked={areAllFolderChildrenChecked(
                                                                    item.path
                                                                  )}
                                                                />
                                                              </th>
                                                              <th>Asset Name</th>
                                                              <th>Type</th>
                                                              <th>
                                                                Updated By
                                                              </th>
                                                              <th>
                                                                Update Time
                                                              </th>
                                                              <th>
                                                                Source Control
                                                              </th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {projectDetails[
                                                              item.path
                                                            ].map((subItem) => (
                                                              <tr
                                                                key={
                                                                  subItem.id
                                                                }
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
                                                                    onClick={(
                                                                      e
                                                                    ) =>
                                                                      e.stopPropagation()
                                                                    }
                                                                  />
                                                                </td>
                                                                <td>
                                                                  {getAssetName(
                                                                    subItem.path,
                                                                    item.path
                                                                  )}
                                                                </td>
                                                                <td>
                                                                  {
                                                                    subItem.type
                                                                  }
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
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </>
                              ) : (
                                <p>
                                  No folders or assets found within this project.
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
            <button
              onClick={handleProcessClick}
              className="process-button"
            >
              Process
            </button>
            <button
              onClick={handleResetSelection}
              className="reset-button"
            >
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