# VCS Pipeline Migration Utility

🚀 **Automated CI/CD Asset Migration Across Heterogeneous VCS & CI Platforms**

---

## 📌 Overview

The **VCS Pipeline Migration Utility** is a production-grade automation tool designed to migrate **CI/CD pipeline configurations and associated data assets**—including **Projects, Folders, Data Tasks, and Mappings**—across heterogeneous **Git-based Version Control Systems (VCS)** and **CI/CD platforms**.

The utility ensures:

* **Absolute data fidelity**
* **Version integrity preservation**
* **Configuration consistency**

across **Development, QA, and Production** environments during large-scale migrations.

---

## ✨ Key Features & Technical Highlights

### 🔹 End-to-End CI/CD Asset Migration

* Automated transfer of CI/CD configurations, metadata, and project structures
* Preserves version history, security settings, and environment-specific configurations

### 🔹 High-Performance Migration Engine

* Multi-threaded concurrent processing for faster migrations
* Environment-aware orchestration (Dev / QA / Prod)
* Reduced overall migration effort by **50%+**

### 🔹 Robust API Handling

* Advanced API-level error handling
* Detailed execution and audit logs for traceability
* Graceful handling of partial failures

### 🔹 Recursive Asset Discovery with Pagination

* Recursive traversal of nested projects and folders
* Intelligent pagination using API `count` metadata
* Guarantees **complete retrieval of deeply nested assets**
* Implemented via `fetchAllPages` strategy

### 🔹 Interactive Web UI

* React-based frontend for session management and monitoring
* Dynamic project/folder selection with recursive checkbox behavior
* Real-time visibility into migration progress

---

## 🛠️ Technology Stack

| Component        | Technology                | Responsibility                                  |
| ---------------- | ------------------------- | ----------------------------------------------- |
| Backend Core     | Java (JDK 8+)             | Orchestration, data transformation, concurrency |
| Communication    | REST APIs, JSON           | Source/target system integration                |
| Automation Layer | Shell Scripting, Git      | Environment setup and execution control         |
| Frontend/UI      | React@Vite (JavaScript)   | User interaction and migration monitoring       |

---

## 📦 Getting Started

### ✅ Prerequisites

* Java Development Kit (**JDK 8 or higher**)
* Node.js and npm
* Valid credentials for source and target CI/CD systems
* `serverUrl` for API access
* Active `sessionId` for authentication

---

## 🔧 Installation

### 1️⃣ Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd VCS-Pipeline-Migration-Utility
```

---

### 2️⃣ Frontend Setup (React)

```bash
npm install
npm run dev
```

* Application will be available at: `http://localhost:3000`

---

### 3️⃣ Backend Setup (Java)

Build the backend migration engine:

```bash
No handler required, already auto configured
```

---

### 4️⃣ Configuration

Set the required environment variables for Local Runtime, or else go with the Flow:

```bash
export SERVER_URL=https://<target-ci-server>
export SESSION_ID=<your-session-id>
```

Or configure them via application properties as required.

---

## ⚙️ Usage Workflow

### 🔐 Step 1: Start Application & Authenticate

* Ensure backend services are running
* Validate `sessionId` authentication

---

### 📂 Step 2: Load Projects

* Click **"List Projects"** in the UI
* Automatically retrieves all top-level projects
* Pagination handled internally using API `count`

---

### 🔁 Step 3: Recursive Asset Selection

* Click on a Project or Folder to recursively load:

  * Sub-folders
  * Pipelines
  * Data tasks
  * Mappings

* Use dynamic checkboxes to:

  * Select individual assets
  * Select entire folders
  * Select complete projects

---

### ▶️ Step 4: Execute Migration

* Click **"Process"**
* Selected assets are serialized into a migration manifest
* Multi-threaded migration engine begins execution
* Progress and logs are displayed in real time

---

## 📊 Logging & Monitoring

* Detailed logs for:

  * API requests and responses
  * Asset transformation
  * Migration success/failure states

* Enables:

  * Post-migration audit
  * Failure recovery
  * Compliance validation

---

## 🤝 Contributing

Contributions are welcome! 🚀

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a Pull Request

For bugs or enhancements, please open an issue.

---

## 📜 License

This project is licensed under the **MIT License** (or your chosen license).

---

## 📬 Contact

For questions or collaboration opportunities, feel free to reach out via GitHub issues or discussions.

---

⭐ **If this project helped you, consider giving it a star!**
