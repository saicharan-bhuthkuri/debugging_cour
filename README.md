# ⚡ Debugging Course & Lab Exam Platform

> A modern, real-time automated coding examination and competition platform designed for computer labs, university hackathons, and technical assessments.

[![Runtime](https://img.shields.io/badge/Runtime-Bun_v1.3+-F472B6?style=flat&logo=bun)](https://bun.com)
[![Frontend](https://img.shields.io/badge/Frontend-SvelteKit_5-FF3E00?style=flat&logo=svelte)](https://svelte.dev)
[![Engine](https://img.shields.io/badge/Execution-WebAssembly_WASI-654FF0?style=flat&logo=webassembly)](https://webassembly.org)
[![Database](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat&logo=sqlite)](https://sqlite.org)
[![Styling](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38B2AC?style=flat&logo=tailwindcss)](https://tailwindcss.com)

---

## 📖 Overview

**debugging_cour** is an all-in-one assessment engine combining centralized computer lab terminal administration with an isolated in-process **WebAssembly/WASI C compiler runner**. It enables instructors and contest organizers to manage synchronized lab competitions without complex container orchestration (Docker/Kubernetes).

The platform supports multi-language coding examinations and typing challenges:
1. **Multi-Language Code Debugging (C & Python)**: Contestants debug broken code snippets in either standard C (C99) or Python (Python 3) across multiple difficulty levels, evaluated against hidden test cases with millisecond execution feedback.
2. **Speed & Accuracy Typing**: Real-time typing challenges with live WPM, accuracy metrics, and attempt restrictions.

---

## ✨ Key Features

### 🖥️ Real-Time Lab & Terminal Control
- **WebSocket Synchronization**: Workstation terminals connect with unique PC codes and stream statuses (`online`, `booked`, `exam`, `offline`).
- **Dynamic Candidate Assignment**: Assign registered participants to specific lab PCs remotely using 5-digit OTP verification.
- **Synchronized Remote Start**: Launch or conclude exam sessions across all lab systems simultaneously with a single click.

### 🛡️ Dual-Language Isolated Sandboxes (C & Python)
- **WebAssembly C Sandbox (`wcc-lib`)**:
  - Full standard C runtime supporting standard formatted I/O (`scanf`, `sscanf`, `printf`), math (`<math.h>`), strings (`<string.h>`), dynamic memory (`malloc`/`free`), sorting (`qsort`), and algorithms.
  - Compiles student source code once to WebAssembly and evaluates multiple test cases sequentially in milliseconds (<150ms per submission) with zero native GCC/Clang dependencies needed.
- **Isolated Python Runner (`py-runner.ts`)**:
  - Secure subprocess execution with temporary file isolation, standard I/O streaming, and strict process timeout enforcement to kill infinite loops.
  - Normalized line endings and comprehensive error/traceback reporting.
- **Safety & Throttling**: Execution timeouts (default 5000ms), concurrency throttling, and memory isolation to prevent server starvation.

### 📝 Dual Examination Tracks
- **Debugging & Fixing Challenges**:
  - Multi-language support: Dynamic syntax highlighting and language badge switching (`C99` vs `Python 3`) in **CodeMirror 6**.
  - Dynamic file tabs: Automatic switching between `solution.c` and `solution.py`.
  - Admin management: Filter, create, edit, and organize questions and levels by programming language.
  - Multiple modes: Full code edit, buggy line identification, or code insertion.
  - Server-side test case evaluation with granular per-case pass/fail feedback.
- **Typing Test**:
  - Live speed (WPM) and accuracy calculation.
  - Multi-attempt support with previous attempt shadow comparison.
  - Real-time WPM consistency charting.

### 🔒 Enterprise-Grade Security & Integrity
- **Academic Integrity**: Student terminals only receive public question prompts. Answer keys (`answer_meta`) and internal grading test cases remain strictly server-side.
- **Cryptographic Security**: Passwords are automatically hashed with **Argon2id**; JWT tokens use environment secrets and 12-hour expiration timestamps.
- **Exam Guard**: Fullscreen locking, window blur detection, and progressive warning flags for unpermitted tab switching.
- **Role-Based Access**: Granular roles (`member`, `lead`, `admin`, `superadmin`) with privilege escalation guards.

### 📊 Comprehensive Admin Dashboard
- **Live Leaderboard & Results**: View submissions, scores, and candidate breakdowns in real time.
- **Terminal Grid**: Interactive workstation grid showing live screen status, battery/network state, and active sessions.
- **Audit Logs**: Filterable timeline of participant activities, tab switches, and submissions.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   ┌─────────────────────┐         ┌─────────────────────┐   │
│   │   Student Terminal  │         │   Admin Dashboard   │   │
│   │   (CodeMirror 6)    │         │  (Live Monitoring)  │   │
│   └──────────┬──────────┘         └──────────┬──────────┘   │
└──────────────┼───────────────────────────────┼──────────────┘
               │  HTTP REST / WebSocket        │
┌──────────────▼───────────────────────────────▼──────────────┐
│                    Bun Application Server                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Router & Auth (Argon2id + Jose JWT)                │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │  WebSocket Terminal Hub (ws_server.ts)              │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │  WCC Runner Engine (WebAssembly & WASI Workers)     │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │ SQLite (WAL Mode)
┌──────────────────────────────▼──────────────────────────────┐
│                  Local Persistent Storage                   │
│   systems  •  users  •  questions  •  sessions  •  logs     │
└─────────────────────────────────────────────────────────────┘
```

| Component | Technologies |
| :--- | :--- |
| **Backend Runtime** | [Bun](https://bun.com) (v1.3+) |
| **Language** | TypeScript (Strict mode) |
| **Database** | SQLite via Bun SQL (`PRAGMA journal_mode = WAL`) |
| **Compiler Sandbox** | WebAssembly (WASI), Web Workers (`wcc-lib`) |
| **Authentication** | Argon2id password hashing, JWT (`jose`) |
| **Frontend Framework** | [SvelteKit 2](https://svelte.dev) + Svelte 5 (Runes) |
| **Build Tool & Styling**| [Vite 7](https://vite.dev), [Tailwind CSS v4](https://tailwindcss.com) |
| **Code Editor** | [CodeMirror 6](https://codemirror.net) (C/C++, Python, JS modes) |

---

## 📁 Repository Structure

```
├── main.ts               # Core backend HTTP server & route controllers
├── db.ts                 # SQLite schema, migrations, indexing & database methods
├── py-runner.ts          # Python isolated execution engine & batch test evaluator
├── ws_server.ts          # Real-time WebSocket connection manager & terminal hub
├── bun-env.d.ts          # Bun TypeScript environment declarations
├── tsconfig.json         # Strict TypeScript configuration
├── run.bat               # Windows launcher script for both dev servers
│
├── scripts/
│   └── seed_questions.ts # Seeder for C and Python curriculum exam questions & levels
│
├── wcc-lib/              # WebAssembly C compiler execution engine
│   ├── index.ts          # Public TypeScript API for WccRunner
│   ├── wcc-runner.js     # Runner orchestrator
│   ├── wasi_worker.js    # WASI Web Worker isolated environment
│   └── wccfiles.zip      # Bundled compiler runtime libraries
│
└── frontend/             # SvelteKit 2 client web application
    ├── src/
    │   ├── lib/          # Shared components, API client, WS store, ExamGuard
    │   └── routes/
    │       ├── login/    # Candidate & terminal login page
    │       ├── debug/    # C & Python code debugging workspace
    │       ├── typing/   # Typing speed competition interface
    │       ├── admin/    # Administrative dashboard & management suite
    │       └── thankyou/ # Post-exam submission screen
    └── package.json
```

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have [Bun](https://bun.com) installed (v1.3 or higher):
```bash
curl -fsSL https://bun.sh/install | bash   # Linux/macOS
powershell -c "irm bun.sh/install.ps1 | iex" # Windows
```

Verify installation:
```bash
bun --version
```

### 2. Install Dependencies
Clone the repository and install packages for both root and frontend:
```bash
# Clone repository
git clone https://github.com/saicharan-bhuthkuri/debugging_cour.git
cd debugging_cour

# Install backend dependencies
bun install

# Install frontend dependencies
cd frontend
bun install
cd ..
```

### 3. Launch Development Servers

#### Option A: Windows Batch Script (Recommended)
Double-click [`run.bat`](./run.bat) or run:
```cmd
run.bat
```

#### Option B: Terminal Command
```bash
# In Terminal 1 (Backend - Port 3000):
bun run --hot main.ts

# In Terminal 2 (Frontend - Port 5173):
cd frontend
bun run dev -- --host
```

---

## 🌐 Access Points & Default Credentials

| Portal | URL | Description |
| :--- | :--- | :--- |
| **Candidate Terminal** | [http://localhost:5173/login](http://localhost:5173/login) | Terminal registration and candidate OTP login |
| **Admin Dashboard** | [http://localhost:5173/admin/login](http://localhost:5173/admin/login) | Management portal for proctors and admins |
| **Backend REST API** | [http://localhost:3000](http://localhost:3000) | JSON API & WebSocket upgrade server |

### Default Superadmin Credentials
- **Username**: `fayaz`
- **Password**: `bankai`

*(Upon first login, the default password is automatically upgraded to a secure Argon2id hash).*

---

## 📡 Lab Deployment (LAN Access)

To deploy across a physical computer lab network:
1. Identify the host machine's IP address on the local network (displayed in server console, e.g. `http://192.168.1.100:5173`).
2. On student terminals, open the browser to `http://<SERVER_IP>:5173/login`.
3. Enter the assigned system number (e.g. `PC-01`, `PC-02`) to register the workstation.
4. From the admin dashboard, assign candidates to terminals and start the examination.

---

## ⚙️ Environment Variables

Create an optional `.env` file in the project root to configure runtime settings:

```env
# Server Port (Default: 3000)
PORT=3000

# Secret key for signing JWT tokens (Change in production!)
JWT_SECRET=super_secret_production_key_change_me
```

---

## 🧪 Verification & Health Checks

Run automated type checking, linting, and evaluation tests:

```bash
# 1. Type check backend
bunx tsc --noEmit

# 2. Check frontend templates & components
cd frontend
bun run check
cd ..

# 3. Test isolated Python runner engine
bun run test_py_suite.ts

# 4. Test end-to-end dual-language (C & Python) API evaluation
bun run test_dual_eval_api.ts

# 5. (Optional) Re-seed C and Python exam curriculum questions
bun run scripts/seed_questions.ts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
