# Roadmap / TODO

This document tracks planned features, enhancements, and known issues for future releases.

## Next Release (v1.6.0 / Upcoming)
- [ ] **Prebuilt Docker Image (Issue #37) [Priority: High]:** Setup GitHub Actions workflow to automatically build and push a multi-platform (`linux/amd64`, `linux/arm64`) Docker image to GHCR (GitHub Container Registry) on push to `main` and release tags `v*`. Update standard `docker-compose.yml` to use this official image by default instead of local build.
- [ ] **Cloud Test Connection [Priority: High]:** Add a "Test Connection" button for S3, Google Drive, and OneDrive cloud settings to allow verifying credentials instantly from the UI.
- [ ] **Independent News Feed [Priority: Medium]:** Implement a dynamic news feed in the dashboard that fetches announcements from a `news.json` file, allowing us to inform users about upcoming features or important notices without releasing a new version.
- [ ] **Log Management UI [Priority: Low]:** Add a way to clear/trim system logs directly from the Dashboard or Settings UI to prevent the database from growing indefinitely.

## Released in v1.5.0
- [x] **Critical SQLite Fixes (QA Report P0):** 
  - Remove/block unsafe direct-copy fallback for live SQLite WAL databases.
  - Safely manage SQLite WAL/SHM files and target process lifecycle during restore.
  - Validate SQLite `db_path` and reject backups that target an empty or non-n8n database.
- [x] **High Priority SQLite Fixes (QA Report P1):**
  - Add `sqlite3` prerequisite validation in container.
  - Upgrade integrity checks to prove recoverability.
- [x] **Cloud Storage Deletion (Issue #36):** Implement file deletion from cloud providers (S3, GDrive, OneDrive) when backups are rotated or manually deleted, preventing cloud storage accumulation.
- [x] **Verify Telegram Settings UI:** Add a dedicated "Test Connection" button directly inside the Telegram settings block that sends a dummy notification to verify the Chat ID and Token.

## Backlog / Ideas
- [ ] Provide more granular backup retention policies (e.g., keep 7 daily, 4 weekly, 12 monthly).
- [ ] Allow backing up only specific workflows or excluding certain tables.
- [ ] Add support for Amazon S3 compatible providers explicitly in the UI (e.g., MinIO, Backblaze B2, Cloudflare R2).


