# n8n Backup Manager

<div align="center">

![n8n Backup Manager](screenshots/banner.png)

[![From Ukraine with Love](https://img.shields.io/badge/From%20Ukraine-with%20Love!-%230057B8?style=for-the-badge&logo=ukraine&labelColor=%23FFD700)](https://stand-with-ukraine.pp.ua)

[![GitHub Release](https://img.shields.io/github/v/release/aleksnero/n8n-backup-manager?color=blue&logo=github)](https://github.com/aleksnero/n8n-backup-manager/releases)
[![GitHub Downloads](https://img.shields.io/github/downloads/aleksnero/n8n-backup-manager/total?color=green&logo=github)](https://github.com/aleksnero/n8n-backup-manager/releases)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-required-blue.svg)

**Automatic backup and restore system for n8n**

[Features](#-features) • [Platform Support](#️-platform-support) • [Installation](#️-installation) • [Usage](#-usage) • [Workflow Snapshots](#-workflow--credentials-snapshots) • [Updates](#-update-system) • [Screenshots](#-screenshots) • [🇺🇦 Українська версія](README.ua.md)

### 🌟 Special Thanks

Huge thanks to the community members who help improve this project through feedback, ideas, and testing:

**[@hoverlover](https://github.com/hoverlover)** • **[@falone](https://github.com/falone)**

*Your help is greatly appreciated!* ❤️

</div>

---

## 🚀 Features

### Core
- ✅ **Automatic Backup** of n8n workflows and database
- ✅ **PostgreSQL & SQLite Support**
- ✅ **Backup Compression** (Gzip)
- ✅ **Backup Encryption** (AES-256)
- ✅ **Flexible Scheduling** (intervals or cron expression)
- ✅ **Backup Retention Policy** (auto-delete old backups)
- ✅ **One-Click Backup & Restore**
- ✅ **Protected Backups** (prevent auto-deletion)
- ✅ **Custom Backup Labels** (name your backups on creation)

### Workflow & Credentials Snapshots *(New in v1.6.0)*
- ✅ **Granular Workflow Snapshots** — back up individual workflows with their credentials
- ✅ **Zero-Downtime Rollback** — restore a single workflow without affecting the entire database
- ✅ **Automatic Scheduling** — snapshots run on their own schedule (interval or cron)
- ✅ **Snapshot Protection & Retention** — protect important snapshots from rotation
- ✅ **Cloud Sync** — snapshots can be uploaded to S3, Google Drive, or OneDrive
- ✅ **Download & Archive** — export snapshots as `.zip` archives

### Integrity & Verification *(New in v1.6.0)*
- ✅ **Semantic Integrity Check** — verifies actual database content (entity counts, schema validation)
- ✅ **Freshness Heuristic** — warns if the database hasn't been modified in a configurable period (default: 30 days)
- ✅ **Delta Anomaly Guard** — warns when workflows or credentials drop by more than 30% compared to the previous backup
- ✅ **Multi-State Integrity Badge** — Dashboard shows ✅ OK / ⚠️ Warning / ❌ Corrupt status with detailed tooltip

### Cloud Storage
- ✅ **S3 Compatible** (AWS, MinIO, DigitalOcean Spaces)
- ✅ **Google Drive** (OAuth2: Client ID + Secret + Refresh Token)
- ✅ **Microsoft OneDrive** (OAuth2: Client ID + Secret + Refresh Token)
- ✅ **Cloud Test Connection** — verify cloud credentials from Settings UI

### Monitoring & Notifications
- ✅ **Telegram Notifications** — alerts on backup success/failure
- ✅ **Backup Size Sparkline** — visual trend chart on Dashboard
- ✅ **Backup Integrity Check** — validate archive health *(Linux only — see below)*
- ✅ **Connection Status Monitoring**
- ✅ **Detailed Logging**
- ✅ **Remote News Feed** — in-app announcements without requiring an update *(can be disabled in Settings)*

### Interface & UX
- ✅ **Web Interface** — responsive, mobile-friendly
- ✅ **Dark / Light Theme**
- ✅ **Multilingual** — English 🇬🇧 and Ukrainian 🇺🇦
- ✅ **PWA Support** — installable as a desktop/mobile app
- ✅ **Password Management**

### System
- ✅ **Automatic Update System** from GitHub
- ✅ **Rollback** capability
- ✅ **Multi-platform Docker Images** (linux/amd64, linux/arm64) on GHCR

---

## 🖥️ Platform Support

This app runs on **Linux** (recommended for production) and **Windows/macOS** (for local development). Most features work on all platforms, but some require Linux-specific tools:

| Feature | Linux 🐧 | Windows 🪟 / macOS 🍎 |
|---|:---:|:---:|
| Backup (PostgreSQL / SQLite) | ✅ | ✅ |
| Restore | ✅ | ✅ |
| Compression & Encryption | ✅ | ✅ |
| Cloud Upload (S3 / GDrive / OneDrive) | ✅ | ✅ |
| Telegram Notifications | ✅ | ✅ |
| Workflow & Credentials Snapshots | ✅ | ✅ |
| Semantic Integrity Check | ✅ | ✅ |
| **Archive Integrity Check** (`tar`) | ✅ | ❌ *hidden automatically* |
| Remote News Feed | ✅ | ✅ |
| Auto-Update via GitHub | ✅ | ✅ |
| PWA Install | ✅ | ✅ |

> [!NOTE]
> **Archive Integrity Check** uses the system `tar` command to verify archive health. On Windows/macOS the feature is automatically hidden — no configuration needed.

> [!TIP]
> **Running locally on Windows or macOS?** See the **[Local Development Guide](LOCAL_SETUP.md)** (or [🇺🇦 Ukrainian](LOCAL_SETUP.ua.md)) for step-by-step setup with Node.js + npm, without Docker.

---

## 📸 Screenshots

### Dashboard
![Dashboard](screenshots/Dashboard_1.6.0.png)
*Main dashboard with system status, backup size trend, and quick actions*

### Backups
![Backups](screenshots/Backups_1.6.0.png)
*Backup management: view, download, restore, integrity check*

### Workflow & Credentials Snapshots
![Workflow & Credentials Snapshots](screenshots/Workflow%20%26%20Credentials%20Snapshots-1_1.6.0.png)
*Granular workflow and credentials snapshots with manual & automatic backups*

![Workflow & Credentials Snapshots Details](screenshots/Workflow%20%26%20Credentials%20Snapshots-2_1.6.0.png)
*Workflow snapshot history, restoration, and download*

### Settings
![Settings - General & Backups](screenshots/Settings_1.4.1-1_1.6.0.png)
*Connection settings, database config, and general preferences*

![Settings - Cloud & Notifications](screenshots/Settings_1.4.1-2_1.6.0.png)
*Cloud providers (S3, Google Drive, OneDrive) and Telegram notifications*

### Updates
![Updates](screenshots/Updates_1.6.0.png)
*Automatic update system from GitHub*

### Logs
![Logs](screenshots/Logs_1.6.0.png)
*Detailed system logs*

---

## 📋 Requirements

- Docker & Docker Compose
- n8n running in a Docker container
- PostgreSQL or SQLite database
- Minimum 1 GB free space for backups

---

## 🛠️ Installation

### Option 1: Quick Start with Pre-built Docker Image (Recommended)

Run n8n Backup Manager using the official pre-built multi-arch image from GitHub Container Registry (`ghcr.io/aleksnero/n8n-backup-manager`) without compiling dependencies locally:

```bash
# 1. Download docker-compose.yml
curl -O https://raw.githubusercontent.com/aleksnero/n8n-backup-manager/main/docker-compose.yml

# 2. Pull image and start container
docker compose pull && docker compose up -d
```

---

### Option 2: Download Release Archive

```bash
# 1. Download and extract the latest release
wget https://github.com/aleksnero/n8n-backup-manager/releases/latest/download/release.zip
unzip release.zip
cd n8n-backup-manager

# 2. Start container
docker compose up -d
```

> [!NOTE]
> If you are using a reverse proxy like **Nginx Proxy Manager**, ensure that this container is in the same network, or add the proxy network to the `docker-compose.yml` file. By default, the example includes the `npm_public` network.

---

### Next Steps

1. **Open in Browser:**
   ```
   http://localhost:3000
   ```

2. **First Time Setup:**
   - Click "First Time Setup"
   - Create an admin account (username & password)
   - Log in

---

### Local Development (Windows / macOS)

> [!TIP]
> See the full **[Local Development Setup Guide](LOCAL_SETUP.md)** (or [🇺🇦 Ukrainian](LOCAL_SETUP.ua.md)) for detailed step-by-step instructions.

**Quick summary:**

```bash
# 1. Clone
git clone https://github.com/aleksnero/n8n-backup-manager.git
cd n8n-backup-manager

# 2. Install all dependencies
npm run install:all

# 3. Configure environment (Windows PowerShell)
Copy-Item .env.example .env

# 4. Start dev servers
npm run dev
```

Open **http://localhost:5173** in your browser.

> [!NOTE]
> Default credentials on first local run: **admin / admin**. Change your password in **Settings → Change Password**.

---

### Advanced Installation (Clone + Docker)

```bash
git clone https://github.com/aleksnero/n8n-backup-manager.git
cd n8n-backup-manager
```

Create a `.env` file (see `.env.example`):

```env
PORT=3000
JWT_SECRET=your_secret_key_here
```

```bash
docker-compose up -d --build
```

---

## 📖 Usage

### Connection Settings

Go to **Settings** and configure:

**For Docker:**
- **n8n Container Name**: Name of your n8n container
- **Database Container Name**: Name of your DB container (e.g., `postgres-1`)
- **Database Type**: PostgreSQL or SQLite

**For PostgreSQL:**
- **Database User**: username
- **Database Password**: password
- **Database Name**: database name

**For SQLite:**
- **Database Path**: path to DB file (e.g., `/home/node/.n8n/database.sqlite`)

**Backup Optimization:**
- **Compression**: Enable Gzip compression to save space
- **Encryption**: Secure your backups with AES-256 (Password required)

---

### Cloud Configuration

Go to **Settings → Cloud** and choose a provider:

| Provider | Fields required |
|---|---|
| **S3 Compatible** | Endpoint, Region, Bucket, Access Key, Secret Key |
| **Google Drive** | Client ID, Client Secret, Refresh Token, Folder ID *(optional)* |
| **Microsoft OneDrive** | Client ID, Client Secret, Refresh Token |

**Getting Google Drive credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (type: Desktop app)
3. Use [Google OAuth Playground](https://developers.google.com/oauthplayground) with scope `https://www.googleapis.com/auth/drive.file` to get a **Refresh Token**

**Getting OneDrive credentials:**
1. Go to [Azure Portal](https://portal.azure.com/) → App registrations → New registration
2. Add `Files.ReadWrite` under Microsoft Graph API permissions
3. Use [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) to generate a **Refresh Token**

> [!TIP]
> **[View Detailed Cloud Setup Guide](CLOUD_SETUP.md)** for complete step-by-step instructions.

---

### Telegram Notifications

Go to **Settings → Notifications**:

1. Enable Telegram notifications
2. Enter your **Bot Token** and **Chat ID**.
3. Click **Send Test Message** to verify the connection.

> [!TIP]
> **[View Detailed Telegram Setup Guide](TELEGRAM_SETUP.md)** for step-by-step instructions on creating a bot and getting your Chat ID.

---

### Scheduling

- **Backup Schedule**: select interval (hours/minutes) or cron expression
- **Max Backups to Keep**: number of most recent backups to retain (excluding protected ones)

---

### Creating Backups

**Automatic:**
- Backups run on the configured schedule.

**Manual:**
1. Go to **Dashboard** or **Backups**.
2. Click **Create Backup**.
3. Optionally enter a **label** (custom name) for this backup.
4. Wait for completion.

---

### Backup Integrity Check *(Linux only)*

Verify that a backup file is not corrupted before restoring it.

1. Go to **Backups**.
2. Click the **shield icon** next to any backup.
3. The system runs `tar --list` (for `.tar.gz`) or file size validation (for `.sql`).
4. Result: ✅ OK / ❌ Corrupt / ⚠️ Linux only

> [!NOTE]
> This feature is only available on Linux. On Windows/macOS the button is not shown.

---

### Semantic Integrity Verification *(New in v1.6.0)*

Beyond simple file-level checks, the system performs **deep semantic analysis** of every backup:

- **Entity Counting** — verifies that workflows and credentials actually exist inside the backup file
- **Freshness Heuristic** — checks when the latest workflow was modified; if all data is older than 30 days (configurable), a ⚠️ warning is raised. This catches situations where backups run against a stale or abandoned database after migration
- **Delta Anomaly Guard** — compares the current backup's entity count with the previous verified backup. If workflow or credential count drops by more than 30% (configurable), a ⚠️ warning is issued. This catches accidental data loss or permission problems during export

Results are displayed as a multi-state badge on the Dashboard:

| Badge | Meaning |
|:---:|---|
| ✅ **OK** | Backup verified, data is fresh and counts are stable |
| ⚠️ **Warning** | Backup is structurally valid, but heuristics detected potential issues |
| ❌ **Corrupt** | Backup failed decryption, decompression, or contains zero entities |

> [!TIP]
> You can adjust thresholds in **Settings**: `integrity_staleness_days` (default: 30) and `integrity_drop_percent` (default: 30).

---

### Restoring

1. Go to **Backups**.
2. Find the desired backup.
3. Click **Restore**.
4. Confirm the action.
5. Wait for restoration to complete.

---

## 📷 Workflow & Credentials Snapshots

Workflow Snapshots are a **granular backup system** that works alongside full database backups. Instead of backing up the entire database, snapshots capture **individual workflows and their associated credentials**, allowing precise rollback of a single workflow without affecting the rest of your n8n instance.

### What gets saved in a snapshot

Each snapshot captures:
- **Workflow definition** (name, nodes, connections, settings, static data)
- **All credentials** used by that workflow (encrypted)
- **Metadata** (creation date, type, custom notes)

Everything is packed into a `.zip` archive and optionally encrypted with the same AES-256 key used for full backups.

### When to use Snapshots vs Full Backups

| Scenario | Use |
|---|---|
| Protect against total database loss | **Full Backup** |
| Roll back a specific broken workflow | **Snapshot** |
| Save a known-good workflow state before editing | **Snapshot** |
| Migrate a workflow to another n8n instance | **Snapshot** (download and restore) |
| Scheduled daily/weekly protection | **Both** (run full backup schedule + snapshot schedule) |

### Creating a Snapshot

**Manual:**
1. Navigate to **Workflow & Credentials Snapshots** in the sidebar.
2. You will see a live list of all workflows in your n8n instance.
3. Click the **camera icon** next to the workflow you want to snapshot.
4. Optionally add a **note** describing why you are saving this version.
5. The snapshot is created instantly.

**Automatic:**
1. Go to **Settings → Workflow Snapshots**.
2. Enable the **Auto-Schedule** toggle.
3. Choose a **schedule** (interval in minutes or a cron expression).
4. Choose a **scope**:
   - **All Active** — snapshots all active workflows
   - **All** — snapshots every workflow (including inactive)
5. Set a **retention count** (how many snapshots to keep per workflow; protected snapshots are excluded from rotation).

### Restoring a Snapshot

1. Navigate to **Workflow & Credentials Snapshots**.
2. Find the desired snapshot in the table.
3. Click the **restore icon** ↩️.
4. Confirm the action.
5. The system will **overwrite the workflow and its credentials** in the live n8n database. n8n picks up changes automatically — no restart required.

> [!IMPORTANT]
> Restoring a snapshot **replaces** the current version of that workflow and its credentials in the live database. Other workflows are not affected.

### Protecting & Downloading Snapshots

- **Protect**: Click the **lock icon** 🔒 to prevent a snapshot from being auto-deleted during retention rotation.
- **Download**: Click the **download icon** ⬇️ to export the snapshot as a `.zip` archive to your local machine.
- **Delete**: Click the **trash icon** 🗑️ to permanently remove a snapshot.

### Dashboard Widget

The Dashboard shows a **Workflow Snapshots** summary card with:
- Total number of workflows in your n8n instance
- Total number of saved snapshots
- Countdown timer to the next automatic snapshot (when scheduling is enabled)

---

## 📰 News Feed

The Dashboard includes a **remote news feed** that shows announcements, tips, and important notices from the project maintainer — without requiring an app update.

- News items are fetched from the project's `news.json` file on GitHub
- You can **dismiss** individual news items with the ✕ button
- You can **mark as read** to stop the unread indicator

**To disable the news feed entirely:**
1. Go to **Settings → General**.
2. Toggle **News Feed** to off.
3. The Dashboard will no longer fetch or display news.

> [!NOTE]
> The news feed is a **read-only** channel. It does not send any data from your instance. The app only fetches a public JSON file.

---

## 🔄 Update System

Backup Manager supports automatic updates from GitHub:

1. Go to **Updates** → **Check for Updates**.
2. If a new version is available, release notes are shown.
3. Click **Apply Update** → Confirm.
4. System will: create a rollback snapshot → download update → apply → restart server.

### Rollback

If issues occur after an update:
1. Go to **Updates**.
2. Click **Rollback**.
3. System restores the previous version.

---

## 🐳 Docker Compose

Example `docker-compose.yml`:

```yaml
services:
  backup-manager:
    build: .
    container_name: n8n-backup-manager
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./backups:/app/backups
      - ./data:/app/data
    environment:
      - PORT=${PORT:-3000}
      - JWT_SECRET=${JWT_SECRET:-change_this_secret}
    networks:
      - default
      - npm_public

networks:
  npm_public:
    external: true
    name: nginx_proxy_manager_default
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT | `secret-key` |
| `UPDATE_SERVER_URL` | URL for update checks | GitHub URL |
| `PORT` | Server port | `3000` |

### Volumes

| Volume | Description |
|--------|-------------|
| `/var/run/docker.sock` | Docker access for container management |
| `./backups` | Backup storage (full backups + snapshots) |
| `./data` | SQLite database |

---

## 📊 Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React, Vite
- **Database**: SQLite (Sequelize ORM)
- **Docker**: Dockerode
- **Scheduler**: node-cron
- **Authentication**: JWT
- **Notifications**: node-fetch (Telegram Webhook)

---

## 🤝 Contribution

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

---

## 💬 Discussions

Have questions or ideas? Join [GitHub Discussions](https://github.com/aleksnero/n8n-backup-manager/discussions)!

- 💡 **Ideas** - suggest new features
- ❓ **Q&A** - get help from community
- 📢 **Announcements** - stay updated
- 🎉 **Show and tell** - share how you use Backup Manager

## 🆘 Support

If you encounter issues:

1. Check [Issues](https://github.com/aleksnero/n8n-backup-manager/issues)
2. Create a new Issue with detailed description
3. Attach logs from `docker-compose logs`

## 🔗 Links

- **GitHub**: https://github.com/aleksnero/n8n-backup-manager
- **Releases**: https://github.com/aleksnero/n8n-backup-manager/releases
- **Issues**: https://github.com/aleksnero/n8n-backup-manager/issues
- **Local Dev Guide**: [LOCAL_SETUP.md](LOCAL_SETUP.md) | [🇺🇦 UK](LOCAL_SETUP.ua.md)

## 🙏 Acknowledgements

Made for the n8n community with ❤️

---

<div align="center">

**[⬆ Back to Top](#n8n-backup-manager)**

</div>
