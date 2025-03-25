import React, { useState } from "react";
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

  const fetchProjects = async () => {
    setLoading(true);
    setError("");
    setProjects([]);

    try {
      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      const initialApiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=type=='PROJECT'&top=200&skip=0`;

      const initialResponse = await fetch(initialApiUrl, requestOptions);
      if (!initialResponse.ok) {
        const text = await initialResponse.text();
        throw new Error(
          `Failed to fetch initial project data: ${initialResponse.status} - ${text}`
        );
      }
      const initialData = await initialResponse.json();
      const totalCount = initialData.count;
      let allProjects = [...initialData.objects];

      if (totalCount > 200) {
        const numPages = Math.ceil(totalCount / 200);

        for (let i = 1; i < numPages; i++) {
          const skip = i * 200;
          const paginatedApiUrl = `${serverUrl.replace(
            /\/$/,
            ""
          )}/public/core/v3/objects?q=type=='PROJECT'&top=200&skip=${skip}`;

          const paginatedResponse = await fetch(
            paginatedApiUrl,
            requestOptions
          );
          if (!paginatedResponse.ok) {
            const text = await paginatedResponse.text();
            throw new Error(
              `Failed to fetch project data for page ${i + 1}: ${
                paginatedResponse.status
              } - ${text}`
            );
          }
          const paginatedData = await paginatedResponse.json();
          allProjects = [...allProjects, ...paginatedData.objects];
        }
      }

      setProjects(allProjects);
      setCheckedItems({});
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError(error.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (projectName) => {
    if (projectDetails[projectName]) {
      setExpandedProject(expandedProject === projectName ? null : projectName);
      return;
    }

    setDetailsLoading((prev) => ({ ...prev, [projectName]: true }));
    setDetailsError((prev) => ({ ...prev, [projectName]: "" }));

    try {
      const myHeaders = new Headers();
      myHeaders.append("INFA-SESSION-ID", sessionId);

      const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
      };

      const initialApiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${projectName}'&top=200&skip=0`;

      const initialResponse = await fetch(initialApiUrl, requestOptions);
      if (!initialResponse.ok) {
        const text = await initialResponse.text();
        throw new Error(
          `Failed to fetch initial details for ${projectName}: ${initialResponse.status} - ${text}`
        );
      }
      const initialData = await initialResponse.json();
      const totalCount = initialData.count;
      let allDetails = [...initialData.objects];

      if (totalCount > 200) {
        const numPages = Math.ceil(totalCount / 200);

        for (let i = 1; i < numPages; i++) {
          const skip = i * 200;
          const paginatedApiUrl = `${serverUrl.replace(
            /\/$/,
            ""
          )}/public/core/v3/objects?q=location=='${projectName}'&top=200&skip=${skip}`;

          const paginatedResponse = await fetch(
            paginatedApiUrl,
            requestOptions
          );
          if (!paginatedResponse.ok) {
            const text = await paginatedResponse.text();
            throw new Error(
              `Failed to fetch details for ${projectName}, page ${i + 1}: ${
                paginatedResponse.status
              } - ${text}`
            );
          }
          const paginatedData = await paginatedResponse.json();
          allDetails = [...allDetails, ...paginatedData.objects];
        }
      }

      setProjectDetails((prev) => ({ ...prev, [projectName]: allDetails }));
      setExpandedProject(expandedProject === projectName ? null : projectName);
    } catch (error) {
      console.error(`Error fetching details for ${projectName}:`, error);
      setDetailsError((prev) => ({ ...prev, [projectName]: error.message }));
      setProjectDetails((prev) => ({ ...prev, [projectName]: [] }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [projectName]: false }));
    }
  };

  const fetchFolderDetails = async (folderPath) => {
    setExpandedFolder((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
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

      const initialApiUrl = `${serverUrl.replace(
        /\/$/,
        ""
      )}/public/core/v3/objects?q=location=='${folderPath}'&top=200&skip=0`;

      const initialResponse = await fetch(initialApiUrl, requestOptions);
      if (!initialResponse.ok) {
        const text = await initialResponse.text();
        throw new Error(
          `Failed to fetch initial details for ${folderPath}: ${initialResponse.status} - ${text}`
        );
      }
      const initialData = await initialResponse.json();
      const totalCount = initialData.count;
      let allDetails = [...initialData.objects];

      if (totalCount > 200) {
        const numPages = Math.ceil(totalCount / 200);

        for (let i = 1; i < numPages; i++) {
          const skip = i * 200;
          const paginatedApiUrl = `${serverUrl.replace(
            /\/$/,
            ""
          )}/public/core/v3/objects?q=location=='${folderPath}'&top=200&skip=${skip}`;

          const paginatedResponse = await fetch(
            paginatedApiUrl,
            requestOptions
          );
          if (!paginatedResponse.ok) {
            const text = await paginatedResponse.text();
            throw new Error(
              `Failed to fetch details for ${folderPath}, page ${i + 1}: ${
                paginatedResponse.status
              } - ${text}`
            );
          }
          const paginatedData = await paginatedResponse.json();
          allDetails = [...allDetails, ...paginatedData.objects];
        }
      }

      setProjectDetails((prev) => ({ ...prev, [folderPath]: allDetails }));
    } catch (error) {
      console.error(`Error fetching details for ${folderPath}:`, error);
      setDetailsError((prev) => ({ ...prev, [folderPath]: error.message }));
      setProjectDetails((prev) => ({ ...prev, [folderPath]: [] }));
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  };

  const getAssetName = (path, parentPath) => {
    if (path && parentPath && path.startsWith(parentPath + "/")) {
      return path.substring(parentPath.length + 1);
    }
    return path;
  };

  const handleCheckboxChange = (itemId) => {
    setCheckedItems((prevCheckedItems) => ({
      ...prevCheckedItems,
      [itemId]: !prevCheckedItems[itemId],
    }));
  };

  const handleCheckAllProjects = (event) => {
    const isChecked = event.target.checked;
    const updatedCheckedItems = { ...checkedItems };
    projects.forEach((project) => {
      updatedCheckedItems[project.id] = isChecked;
    });
    setCheckedItems(updatedCheckedItems);
  };

  const handleCheckAllInProject = (projectName, event) => {
    const isChecked = event.target.checked;
    const updatedCheckedItems = { ...checkedItems };
    projectDetails[projectName]?.forEach((item) => {
      if (item.type !== "Project") {
        updatedCheckedItems[item.id] = isChecked;
      }
    });
    setCheckedItems(updatedCheckedItems);
  };

  const handleCheckAllInFolder = (folderPath, event) => {
    const isChecked = event.target.checked;
    const updatedCheckedItems = { ...checkedItems };
    projectDetails[folderPath]?.forEach((item) => {
      if (item.type !== "Folder") {
        updatedCheckedItems[item.id] = isChecked;
      }
    });
    setCheckedItems(updatedCheckedItems);
  };

  const handleProcessClick = () => {
    const selectedAssets = [];
    for (const itemId in checkedItems) {
      if (checkedItems[itemId]) {
        const project = projects.find((p) => p.id === itemId);
        if (project) {
          selectedAssets.push({
            name: project.path,
            id: project.id,
            type: project.type,
          });
          continue;
        }
        for (const projectName in projectDetails) {
          const item = projectDetails[projectName]?.find(
            (i) => i.id === itemId
          );
          if (item) {
            selectedAssets.push({
              name: item.path,
              id: item.id,
              type: item.type,
            });
            break;
          }
        }
      }
    }
    console.log("Selected Assets for Processing:", selectedAssets);
    setCheckedAssets(selectedAssets);
    setIsProcessing(true);
  };

  const handleResetSelection = () => {
    setCheckedItems({});
  };

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
                    <input type="checkbox" onChange={handleCheckAllProjects} />
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
                          <td colSpan="6">
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
                              ) : projectDetails[project.path].length > 1 ? (
                                <table>
                                  <thead>
                                    <tr>
                                      <th></th>
                                      <th>
                                        <input
                                          type="checkbox"
                                          onChange={() =>
                                            handleCheckAllInProject(
                                              project.path
                                            )
                                          }
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
                                      .filter((item) => item.type !== "Project")
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
                                                  onClick={() =>
                                                    fetchFolderDetails(
                                                      item.path,
                                                      project.path
                                                    )
                                                  }
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
                                                  colSpan="6"
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
                                                        size={100}
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
                                                          <th>
                                                            <input
                                                              type="checkbox"
                                                              onChange={() =>
                                                                handleCheckAllInFolder(
                                                                  item.path
                                                                )
                                                              }
                                                            />
                                                          </th>{" "}
                                                          <th>Asset Name</th>
                                                          <th>Type</th>
                                                          <th>
                                                            Updated By
                                                          </th>{" "}
                                                          <th>Update Time</th>{" "}
                                                          <th>
                                                            Source Control
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {projectDetails[
                                                          item.path
                                                        ]
                                                          .filter(
                                                            (subItem) =>
                                                              subItem.type !==
                                                              "Folder"
                                                          )
                                                          .map((subItem) => (
                                                            <tr
                                                              key={subItem.id}
                                                            >
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
