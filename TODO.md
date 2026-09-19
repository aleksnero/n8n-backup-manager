# Roadmap / TODO

This document tracks planned features, enhancements, and known issues for future releases.

## Next Release (v1.6.0 / Upcoming)
- [x] **Prebuilt Docker Image (Issue #37) [Priority: High]:** Setup GitHub Actions workflow (`docker-publish.yml`) to automatically build and push multi-platform (`linux/amd64`, `linux/arm64`) Docker images to GHCR on push/release tags. Updated `docker-compose.yml` to use `ghcr.io/aleksnero/n8n-backup-manager:latest`.
- [x] **Semantic Integrity Verification & Auto/Manual Mode [Priority: High]:** Extended backup integrity service to count workflows and credentials for both SQLite and PostgreSQL. Flags empty backups (`0 workflows`) as failures. Added auto/manual toggle in Settings, persists check results (status and entity counts) directly into the database, displays verified counts immediately in UI badges, and includes integrity verification results in Telegram notifications.
- [x] **Cloud Test Connection UI [Priority: High]:** Add dedicated "Test Connection" buttons in Settings UI for S3, Google Drive, and OneDrive with support for validating unsaved form credentials.
- [x] **Granular Workflow & Credentials Snapshots Subsystem (v1.6.0) [Priority: High]:** Dedicated UI page and backend module for capturing, downloading, scheduling, and rolling back individual n8n workflows bundled with their linked credentials (zero-downtime rollback, AES-256 encryption, cloud sync to S3/GDrive/OneDrive, and retention lock).
- [x] **Independent News Feed [Priority: Medium]:** Dynamic announcement feed in Dashboard that fetches notices from a remote `news.json` repository on GitHub without requiring app updates. Features in-memory caching (30m TTL), 4s request timeout, local fallback, schema sanitization, unread counter badge, and client-side dismissal state (read/unread) in `localStorage`.
- [x] **Integrity Freshness Heuristic & Delta Anomaly Guard [Priority: High]:** Implemented advanced verification checks: Freshness Heuristic (inspects latest workflow update timestamp to catch stale/abandoned database targets) and Delta Anomaly Guard (detects sharp entity count drops >= 30% between consecutive backups). Supports amber warning badge (`⚠️`), detailed tooltip diagnostics, and Telegram alert formatting. *(Suggested by community member @carlosruiz).*
- [ ] **Log Management UI [Priority: Low]:** Add a way to view, filter, and clear/trim system logs directly from Settings/Dashboard UI to keep database size optimal.

## Planned for Future Releases (v1.7.0+ & Backlog)
- [ ] **No-docker.sock Security Mode [Priority: High]:** Support environments where `/var/run/docker.sock` is restricted by allowing direct network-based `pg_dump` for PostgreSQL and read-only volume mounting for SQLite.
- [ ] **Grandfather-Father-Son (GFS) Retention Policy [Priority: Medium]:** Advanced retention scheduler allowing configurations like: keep 7 daily, 4 weekly, and 12 monthly backups.
- [ ] **Dedicated S3 Provider Presets [Priority: Medium]:** Quick-fill configuration presets in the UI for popular S3-compatible providers (Cloudflare R2, MinIO, Backblaze B2, Wasabi).
- [ ] **Backup Content Inspector / Preview [Priority: Medium]:** Preview backup metadata (saved workflow names, node counts, database version) directly in the UI before initiating a restore.
- [ ] **Instance Migration Wizard [Priority: Low]:** Guided UI step-by-step export/import wizard for migrating n8n instances between different servers with automated DNS/endpoint checklist.


