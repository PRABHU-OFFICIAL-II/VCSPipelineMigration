# VCS Pipeline Migration Tool

A browser-based automation tool for migrating Informatica Intelligent Data Management Cloud (IDMC) assets between environments using the Source Control (VCS) Pull API.

---

## Why this tool exists

Informatica imposes a **50 MB request size limit** on all Platform Services that use the underlying Migration Service architecture. When a pull operation exceeds this limit, it throws a `Request Size Overflow Exception` and fails entirely.

This tool works around that constraint by letting you:

- Browse and cherry-pick **exactly** the assets you need (no full-repo load)
- Automatically resolve the **full dependency tree** for every selected asset
- Frame a precise pull request payload against a specific **commit hash**
- Map source connections / runtimes to their target-environment equivalents
- Execute the pull and monitor its status — all from one UI

---

## Live deployment

| Environment | URL | CORS proxy |
|---|---|---|
| **Vercel** (recommended) | `https://vcs-pipeline-migration.vercel.app` | Built-in serverless function — no browser flags needed |
| **Docker** (local/offline) | `http://localhost` | Bundled Node.js proxy — requires `--disable-web-security` flag |

---

## Important notes

> **50 MB limit still applies.** Exceeding it will throw a `Request Size Overflow Exception`. Select only the assets you need.

> **Docker users:** open the tool with one of these commands to bypass your browser's CORS policy:
> ```
> chrome.exe --disable-web-security --user-data-dir="C:\chrome_dev"
> edge.exe   --disable-web-security --user-data-dir="C:\edge_dev"
> ```
> Run via **Win + R** (Run panel) or a terminal.

> **Connection names:** if Connection names are the same in both environments, remove the `objectSpecification` block from the framed payload and use a Generic Framed Request. If names differ, fill in the source → target mapping in the UI before framing.

> **If the issue persists after using this tool,** believe in GOD and email him at ppenthoi@informatica.com.

---

## Docker quick-start

```bash
# Load the image from the distributed tar file
docker load -i vcs-pull-tool.tar

# Run the container (serves on http://localhost)
docker run -p 80:80 --name my-vcs-app vcs-pull-tool:latest
```

### Container management

| Action | Command |
|---|---|
| Stop | `docker stop my-vcs-app` |
| Start again | `docker start my-vcs-app` |
| Remove container | `docker rm my-vcs-app` |
| Remove image | `docker rmi vcs-pull-tool:latest` |

---

## Workflow — step by step

The tool guides you through a **4-step linear flow** shown in the progress bar at the top of every page.

### Step 1 — Login (DEV / Source)

Authenticate to your **source** Informatica environment.

**Option A — Username & Password:**  
Enter your username, password, and Region URL (e.g. `https://dm-us.informaticacloud.com`). The tool calls `/ma/api/v2/user/login` and stores the returned `icSessionId` for all subsequent API calls.

**Option B — SSO / Federated Login:**  
1. Enter your POD URL and click **Launch SSO Login** — a popup opens your Informatica portal
2. Complete your organisation's SSO flow (Okta, Azure AD, Ping, etc.) in the popup
3. Once logged in, open DevTools in the popup (`F12` → **Application** → **Cookies**), find the cookie named `USER_SESSION`, and copy its value
4. Paste it into the Session ID field and click **Verify Session** — the tool validates the token live against the API before proceeding

Session is persisted in `sessionStorage` so a page refresh does not require re-login.

---

### Step 2 — Select Assets

Browse the full project tree of your source environment.

- Click **List Projects** to load all top-level projects (paginated, up to 200 per page)
- Expand any project to see its folders and assets
- Expand folders to see nested assets
- Use checkboxes to select individual assets, entire folders, or full projects
- Use the **search bar** to filter projects by name
- A **selection counter** badge tracks how many assets are selected
- Click **Process N Assets →** to advance

---

### Step 3 — Process Assets

Four sequential operations, each in its own numbered card:

#### Card 1 — Selected Assets
A review table of everything you selected: path, asset type (colour-coded badge), and asset ID.

#### Card 2 — Resolve Dependencies
Click **Render Dependencies** to recursively fetch the full dependency tree for every selected asset.

- Traverses up to **5 levels deep** using `GET /public/core/v3/objects/{id}/references?refType=Uses`
- Parallel fetching per BFS level for speed
- Filters to allowed types only: `DTEMPLATE`, `MAPPING`, `MTT`, `DSS`, `DMASK`, `DRS`, `DMAPPLET`, `MAPPLET`, `BSERVICE`, `HSCHEMA`, `PCS`, `FWCONFIG`, `CUSTOMSOURCE`, `MI_TASK`, `WORKFLOW`, `TASKFLOW`, `UDF`, `MCT`, `SAAS_CONNECTION`
- Shows a warning if the 5-level depth limit is reached
- Results grouped by parent asset, deduped across the full tree

#### Card 3 — Select Commit
Click **Get Commit History** to load the commit log for the source project via `GET /public/core/v3/commitHistory?q=path=='<project>'`.

- Displays hash, author, and date for each commit
- Click any row to select that commit — the hash auto-fills into the Frame Pull Request input
- Or type a known hash directly

#### Card 4 — Frame Pull Request
Builds the final API payload:

**Connection / Runtime mappings** (shown when needed):  
Any `SAAS_CONNECTION` or `SAAS_RUNTIME_ENVIRONMENT` assets found in your selection or dependencies appear here. Enter the corresponding **target environment** name for each before framing. Fields are highlighted amber until filled.

**Payload construction rules:**
- `SAAS_CONNECTION` → goes into `objectSpecification` with `type: "Connection"`, source and target paths
- `SAAS_RUNTIME_ENVIRONMENT` → goes into `objectSpecification` with `type: "AgentGroup"`, source and target paths
- All other asset types → go into the `objects` array with their path and type
- `objectSpecification` is omitted entirely if there are no connections or runtimes to map
- `MCT` assets are normalised to `MTT`; `MAPPING` assets are normalised to `DTEMPLATE`

After framing, the JSON payload is displayed with syntax highlighting. You can:
- **Edit** — toggle into a raw textarea to modify any field directly; **Save** validates JSON before applying
- **Copy** — copy payload to clipboard
- **Export** — download as `pull-request-<hash>.json`

Click **Proceed to Execute Pull ⚡** to advance.

---

### Step 4 — Execute Pull

#### Card 1 — Target Environment Login
Authenticate to your **target** (PROD) environment. Same Username/Password and SSO options as Step 1. The card collapses to a "Connected ✓" state after successful login.

#### Card 2 — Migration Payload
A summary chip shows the object count, connection mapping count, and truncated commit hash. Expand to view the full JSON.

#### Card 3 — Execute Pull
Click **⚡ Start Migration** to POST the framed payload to `POST /public/core/v3/pull` on the target environment.

#### Card 4 — Migration Status
Appears automatically after the pull is initiated. Polls `GET /public/core/v3/sourceControlAction/{pullActionId}?expand=objects` every 4 seconds (up to 20 attempts) until a terminal state is reached.

Displays:
- Overall status banner (COMPLETED / WARNING / FAILED) with colour coding
- Action metadata grid (action ID, start time, end time)
- Object summary pills (total / completed / warning / failed counts)
- Per-object results table with status, path, type, and message

Completed migration runs are saved to `localStorage` (last 50 entries) for audit purposes.

---

## Architecture

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 + Vite 6 | SPA — all UI, state, API orchestration |
| Dev proxy | Vite plugin (inline middleware) | Forwards `/api-proxy/*` server-side to bypass browser CORS |
| Production proxy (Vercel) | Node.js serverless function at `/api/proxy` | Same forwarding logic, runs as Vercel Edge Function |
| Production proxy (Docker) | `proxy-server.cjs` on port 3001 | Standalone Node HTTP server; nginx routes `/api-proxy/` to it |
| Container runtime | Docker + nginx + node:20-alpine | Two-stage build: Vite build → nginx serves static files + proxy sidecar |

### Key components

| File / Component | Purpose |
|---|---|
| `src/utils/apiClient.js` | `proxyFetch()` — detects Vercel vs local and routes through the right proxy |
| `src/utils/useSessionPersist.js` | Saves/loads `{ sessionId, serverUrl }` to `sessionStorage` |
| `src/utils/useMigrationHistory.js` | Persists migration run history to `localStorage` (capped at 50) |
| `src/components/SSOLoginPanel.jsx` | 3-step guided SSO flow: Launch popup → Detect close → Paste & verify `USER_SESSION` |
| `src/components/ProgressStepper.jsx` | 4-step linear flow indicator shown on every page |
| `src/components/AssetTypeBadge.jsx` | Colour-coded pill badge per Informatica asset type |
| `src/components/Toast.jsx` | Fixed bottom-right notifications (info / success / warning / error) |
| `src/pages/login/LoginDev.jsx` | Step 1 — source environment authentication |
| `src/pages/hompage/HomePage.jsx` | Step 2 — project browser and asset selection |
| `src/pages/processpage/ProcessPage.jsx` | Step 3 — dependency resolution, commit selection, payload framing |
| `src/pages/pullpage/PullOperatorPage.jsx` | Step 4 — target login, pull execution, live status polling |
| `api/proxy.js` | Vercel serverless CORS proxy |
| `proxy-server.cjs` | Docker standalone CORS proxy (port 3001) |
| `vite.config.js` | Vite dev server + inline CORS proxy middleware |
| `nginx.conf` | Docker nginx config — serves SPA + proxies `/api-proxy/` to port 3001 |

---

## Local development

```bash
git clone https://github.com/PRABHU-OFFICIAL-II/VCSPipelineMigration.git
cd VCSPipelineMigration
npm install
npm run dev          # starts at http://localhost:5173 — CORS proxy built in
```

No separate proxy process. The Vite dev server intercepts all `/api-proxy/*` requests and forwards them server-side.

---

## Build & deploy

### Vercel (automatic)

Every push to `master` triggers a Vercel deployment. The serverless function at `api/proxy.js` handles CORS — no browser flags required.

```bash
git push origin master   # Vercel picks it up automatically
```

### Docker (manual build)

```bash
docker build -t vcs-pull-tool:latest .
docker save  -o vcs-pull-tool.tar vcs-pull-tool:latest

# Run
docker run -p 80:80 --name my-vcs-app vcs-pull-tool:latest
```

### GitHub Pages (static fallback)

```bash
npm run deploy:gh
```

Builds with base path `/VCSPipelineMigration/` and pushes to the `gh-pages` branch. **Requires `--disable-web-security` browser flag** — no serverless proxy on GitHub Pages.

---

## Informatica API endpoints used

| Endpoint | Method | Purpose |
|---|---|---|
| `/ma/api/v2/user/login` | POST | Credential-based login |
| `/ma/api/v2/user/getSessionUser` | GET | SSO session token validation |
| `/public/core/v3/objects` | GET | List projects / browse assets |
| `/public/core/v3/objects/{id}/references?refType=Uses` | GET | Fetch asset dependencies |
| `/public/core/v3/commitHistory?q=path=='...'` | GET | Fetch project commit log |
| `/public/core/v3/pull` | POST | Execute pull operation |
| `/public/core/v3/sourceControlAction/{id}?expand=objects` | GET | Poll pull operation status |

---

## Contributing

Contributions, bug reports, and enhancement ideas are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-enhancement`)
3. Commit your changes
4. Open a Pull Request

---

## License

MIT

---

*Open to accept contributions and ideas for enhancement.*
