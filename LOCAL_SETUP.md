# 🚀 Local Development of n8n Backup Manager

This document describes how to run the application locally for development **without Docker** (using Node.js).

---

## Requirements

| Tool | Version    | Check                 |
|------------|-----------|----------------------|
| Node.js    | ≥ 18.x    | `node --version`     |
| npm        | ≥ 9.x     | `npm --version`      |
| Docker     | Any       | Needed for backups   |

> **Note regarding Docker and n8n:** 
> - **For UI development**, Docker is optional. You can edit code and see interface changes without it.
> - **For creating actual backups**, the local n8n Backup Manager can connect **only to a local Docker Desktop**, where your test n8n must be installed. 
> - ⚠️ **A local copy cannot connect to a remote VPS** (where your production n8n is installed) because it has no access to the server's Docker socket. For production n8n, install the Backup Manager directly on the VPS.

---

## First Run

### 1. Clone the repository (if not already done)

```bash
git clone https://github.com/aleksnero/n8n-backup-manager.git
cd n8n-backup-manager
```

### 2. Install dependencies

A single command installs packages for the root, server, and client:

```bash
npm run install:all
```

> Details: This installs `concurrently` in the root, and then the server and client dependencies.

### 3. Create a `.env` file

Copy the template and edit it:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# or Linux/macOS
cp .env.example .env
```

Open `.env` and configure:

```env
PORT=3000
JWT_SECRET=any-long-random-string-for-token-signing
```

> `JWT_SECRET` can be any string (minimum 16 characters). For example: `my-local-dev-secret-2025`

---

## Starting the Application

```bash
npm run dev
```

This will run in parallel:
- **SERVER** → `http://localhost:3000` (Node.js + Express)
- **CLIENT** → `http://localhost:5173` (Vite dev server with HMR)

Open in your browser: **http://localhost:5173**

### Terminal Output

```
[SERVER] Server running on port 3000
[CLIENT] VITE v5.x ready in 500ms
[CLIENT]   ➜  Local:   http://localhost:5173/
```

---

## Authentication

On the first run, the server automatically creates an administrator:

| Field    | Value     |
|----------|-----------|
| Login    | `admin`   |
| Password | `admin`   |

> ⚠️ Change your password after the first login in **Settings → Change Password**.

---

## Project Structure

```
n8n-backup-manager/
├── package.json          ← root (npm run dev)
├── .env                  ← local environment variables (not in git)
├── .env.example          ← template
├── client/               ← React + Vite (frontend)
│   ├── src/
│   │   ├── pages/        ← pages (Dashboard, Backups, Settings...)
│   │   ├── components/   ← shared components (ConfirmModal, Layout...)
│   │   └── context/      ← React Context (Auth, Language, Toast)
│   └── vite.config.js    ← proxy /api → :3000
└── server/               ← Node.js + Express (backend)
    ├── index.js          ← entry point
    ├── routes/           ← API routes
    ├── services/         ← business logic
    └── data/             ← SQLite database (created automatically)
```

---

## How the proxy works

In development mode, Vite (`:5173`) proxies all `/api/*` requests to the server (`:3000`):

```
Browser :5173 → /api/backups → Vite proxy → localhost:3000/api/backups
```

This is configured in `client/vite.config.js` and does not require code changes.

---

## Common Issues

### ❌ `Error: listen EADDRINUSE :::3000`
Port 3000 is occupied. Stop the other process or change `PORT=3001` in `.env`.

### ❌ `Cannot find module 'concurrently'`
Root dependencies are not installed. Run:
```bash
npm install
```

### ❌ The page shows "Loading..." forever
The server did not start. Check the terminal output — look for errors in the `[SERVER]` lines.

### ❌ 401 Unauthorized on any request
Clear your browser's `localStorage` or open the page in incognito mode.

### ❌ Docker commands fail (backup crashes)
In local development mode, the Docker socket might be inaccessible. Ensure Docker Desktop is running.

---

## Useful Commands

```bash
# Server only (no client)
npm start --prefix server

# Reset admin password
node server/reset_password.js

# Check database state
node server/check_db.js
```

---

## Differences from Production (Docker)

| Aspect           | Local (dev)               | Production (Docker)          |
|------------------|---------------------------|------------------------------|
| Start Command    | `npm run dev`             | `docker compose up -d`       |
| Client           | Vite HMR `:5173`          | Built files served via Express |
| Hot Reload       | ✅ Yes                    | ❌ No                        |
| Docker for backup| required on host          | inside the stack             |
| Environment Vars | `.env` in root            | `docker-compose.yml`         |
