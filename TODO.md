# Roadmap / TODO

This document tracks planned features, enhancements, and known issues for future releases.

## Next Release (v1.6.0 / Upcoming)
- [x] **Prebuilt Docker Image (Issue #37) [Priority: High]:** Setup GitHub Actions workflow (`docker-publish.yml`) to automatically build and push multi-platform (`linux/amd64`, `linux/arm64`) Docker images to GHCR on push/release tags. Updated `docker-compose.yml` to use `ghcr.io/aleksnero/n8n-backup-manager:latest`.
- [ ] **Cloud Test Connection UI [Priority: High]:** Add dedicated "Test Connection" buttons in Settings UI for S3, Google Drive, and OneDrive (backend endpoint `/api/settings/cloud/test` ready).
- [ ] **Granular Workflow JSON Export [Priority: High]:** In addition to the full database dump, export individual workflow JSON files into an internal `/workflows` archive folder. Enables single-workflow recovery without rolling back the whole database.
- [ ] **Independent News Feed [Priority: Medium]:** Dynamic announcement feed in Dashboard that fetches notices from a remote `news.json` repository without requiring app updates.
- [ ] **Log Management UI [Priority: Low]:** Add a way to view, filter, and clear/trim system logs directly from Settings/Dashboard UI to keep database size optimal.

## Planned for Future Releases (v1.7.0+ & Backlog)
- [ ] **No-docker.sock Security Mode [Priority: High]:** Support environments where `/var/run/docker.sock` is restricted by allowing direct network-based `pg_dump` for PostgreSQL and read-only volume mounting for SQLite.
- [ ] **Grandfather-Father-Son (GFS) Retention Policy [Priority: Medium]:** Advanced retention scheduler allowing configurations like: keep 7 daily, 4 weekly, and 12 monthly backups.
- [ ] **Dedicated S3 Provider Presets [Priority: Medium]:** Quick-fill configuration presets in the UI for popular S3-compatible providers (Cloudflare R2, MinIO, Backblaze B2, Wasabi).
- [ ] **Backup Content Inspector / Preview [Priority: Medium]:** Preview backup metadata (saved workflow names, node counts, database version) directly in the UI before initiating a restore.
- [ ] **Instance Migration Wizard [Priority: Low]:** Guided UI step-by-step export/import wizard for migrating n8n instances between different servers with automated DNS/endpoint checklist.


