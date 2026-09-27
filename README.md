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

The platform supports two simultaneous competition tracks:
1. **C Code Debugging**: Contestants debug broken code snippets across multiple difficulty levels, evaluated against hidden test cases.
2. **Speed & Accuracy Typing**: Real-time typing challenges with live WPM, accuracy metrics, and attempt restrictions.

---

## ✨ Key Features

### 🖥️ Real-Time Lab & Terminal Control
- **WebSocket Synchronization**: Workstation terminals connect with unique PC codes and stream statuses (`online`, `booked`, `exam`, `offline`).
- **Dynamic Candidate Assignment**: Assign registered participants to specific lab PCs remotely using 5-digit OTP verification.
- **Synchronized Remote Start**: Launch or conclude exam sessions across all lab systems simultaneously with a single click.

### 🛡️ Isolated WebAssembly C Sandbox (`wcc-lib`)
- **Universal C Compatibility**: Full standard C runtime supporting standard formatted I/O (`scanf`, `sscanf`, `fscanf`, `printf`), math (`<math.h>`), strings (`<string.h>`), dynamic memory (`malloc`/`free`/`calloc`/`realloc`), sorting (`qsort`), and algorithms.
- **Single-Compile Multi-Execution (`execBatch`)**: Compiles student source code once to WebAssembly and evaluates multiple test cases sequentially in milliseconds (<150ms per submission).
- **Fast & Isolated**: Runs completely inside an in-memory WASI virtual filesystem with zero native GCC/Clang dependencies needed on host or client machines.
- **Safety & Throttling**: Built-in execution timeouts, automatic missing header injection guards (`<stdio.h>`, `<stdlib.h>`), and semaphore concurrency queuing to prevent server resource starvation.

### 📝 Two Examination Tracks
- **Debugging Challenges**:
  - Multiple modes: Full code edit, buggy line identification, or code insertion.
  - Interactive syntax highlighting and themes powered by **CodeMirror 6**.
  - Server-side test case evaluation with granular feedback.
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
├── ws_server.ts          # Real-time WebSocket connection manager & terminal hub
├── bun-env.d.ts          # Bun TypeScript environment declarations
├── tsconfig.json         # Strict TypeScript configuration
├── run.bat               # Windows launcher script for both dev servers
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
    │       ├── debug/    # C Code debugging workspace
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

Run automated type checking and linting to ensure code integrity:

```bash
# 1. Type check backend
bunx tsc --noEmit

# 2. Check frontend templates & components
cd frontend
bun run check
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
