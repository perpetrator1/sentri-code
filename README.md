# Sentri Code 🛡️

> **Offline-First, Stress-Free Coding Assessment Platform**  
> An anxiety-free candidate experience featuring an offline built-in Reference Manual, privacy-preserving keystroke dynamics telemetry, client-side & server-side sandboxed execution, and an examiner forensics review workbench.

---

## 💡 Philosophy

Traditional coding assessments rely on intrusive webcam surveillance, artificial time pressure, and syntax memorization.

**Sentri Code is built differently:**
- **No Webcams or Screen Surveillance**: Candidate privacy is respected.
- **Built-in Reference Manual (`Ctrl+K` / `⌘K`)**: Standard language APIs and algorithms are searchable offline, eliminating syntax recall anxiety.
- **Privacy-Preserving Telemetry**: Validates integrity by analyzing cadence, rhythm, cognitive pauses, and edit entropy—without ever storing raw typed characters.
- **Offline Resilient**: Assessments and test executions function 100% offline via IndexedDB and sync automatically upon reconnection.

---

## 🚀 Quick Start

### Option 1: Docker (Single Command — Recommended)

Run both the frontend and backend with a single command:

```bash
docker compose up --build
```

- **Frontend Portal**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/api](http://localhost:4000/api)

---

### Option 2: Local Development

#### Prerequisites
- Node.js 20+ (Node 22+ recommended)
- Python 3 (for local Python code execution)

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Start the Backend API (Port 4000)
```bash
npm run server:dev
```

#### 3. Start the Frontend (Port 3000)
In a separate terminal:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The frontend automatically proxies `/api` requests to the backend.

---

## 👥 Demo Accounts

The platform includes pre-seeded demo credentials and **1-Click Demo Buttons** on the login screen:

| Role | Email | Password | What You Can Access |
| :--- | :--- | :--- | :--- |
| **Candidate** | `candidate@sentri.dev` | `password123` | Warm coding assessment workspace, Monaco editor, reference manual, test runner |
| **Professor / Examiner** | `professor@sentri.dev` | `password123` | Forensic triage dashboard, keystroke heatmap, code replay scrub-bar, verdict submission |
| **Administrator** | `admin@sentri.dev` | `password123` | System management & assessment review |

---

## 🛠️ Key Features & How to Use

### 1. Built-in Reference Manual (`Ctrl+K` or `⌘K`)
- Click **Docs** in the top navigation or press `Ctrl+K` / `F1`.
- Search through built-in standard library operations (Arrays, Maps, Sets, Sorting, Strings).
- Click **Insert Snippet** to inject the boilerplate directly into your Monaco editor at the current cursor offset.

### 2. Dual-Engine Sandboxed Code Execution
- **Online**: Executes in a safe backend container/process with a 2000ms timeout against visible samples and hidden evaluation test cases.
- **Offline**: Automatically switches to an in-browser Web Worker / Pyodide runner without interrupting the exam.

### 3. Keystroke Dynamics Telemetry
- Captures typing cadence and intervals (flight time, dwell time, pause distribution).
- Calculates Shannon entropy and an **Integrity Confidence Index** (0.0 to 1.0) along an anomaly timeline.
- Organic cognitive pauses and refactoring are positively framed—never flagged as cheating.

### 4. Examiner Forensics Workbench
- Log in as `professor@sentri.dev` to open the Examiner Review Dashboard.
- **Replay Slider**: Scrub through candidate code evolution in real-time with 1x, 2x, and 4x speeds.
- **Heatmap Visualizer**: Identifies sudden zero-backspace linear typing vs. organic bursts.
- **Verdict Signing**: Mark candidates as *Verified*, *Flag for Oral Viva*, or *Dismiss Flag*.

### 5. Offline Sync Pipeline
- If internet connectivity drops, submissions are securely queued in IndexedDB (`SentriCodeDB.outbox`).
- When connectivity returns, the background sync manager flushes pending submissions to `/api/submissions/sync-outbox` and displays a confirmation toast.

---

## 📁 Project Structure

```
sentri-code/
├── server/                   # Node.js + Express + SQLite Backend
│   ├── db.ts                 # SQLite schema, tables & auto-seeder
│   ├── index.ts              # Express API server entrypoint
│   ├── middleware/auth.ts    # JWT authentication & RBAC
│   ├── routes/               # API endpoints (auth, problems, execute, submissions, examiner)
│   └── runner/codeRunner.ts  # Sandboxed JS (node:vm) & Python runner
├── src/                      # Vite + React Frontend
│   ├── components/
│   │   ├── auth/             # Login & 1-Click Demo Login views
│   │   ├── candidate/        # TopBar, Workspace, Monaco, Reference Manual, BottomPanel
│   │   ├── examiner/         # ExaminerDashboard & ForensicsWorkbench
│   │   └── common/           # SyncToastContainer & common widgets
│   ├── context/AuthContext.tsx # Role-based authentication state
│   ├── data/                 # Problems & Reference Manual datasets
│   ├── db/index.ts           # Dexie IndexedDB offline storage
│   ├── sandbox/              # Unified code execution runner
│   ├── services/syncManager.ts# Offline-to-online sync manager
│   └── telemetry/            # Keystroke dynamics & sliding window inference
├── Dockerfile.frontend       # Multi-stage frontend Docker build
├── Dockerfile.backend        # Node + Python backend Docker build
├── docker-compose.yml        # Multi-container orchestration
└── tailwind.config.js        # DaisyUI warm themes (cozy & ember)
```

---

## ⌨️ Useful Keyboard Shortcuts

- `Ctrl + K` / `⌘ + K`: Toggle Reference Manual
- `F1`: Quick Documentation Search
- `Esc`: Close open modal / dialog
