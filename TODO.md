# Roadmap / TODO

This document tracks planned features, enhancements, and known issues for future releases.

## Next Release (v1.5.0 / Upcoming)
- [ ] **Prebuilt Docker Image:** Setup GitHub Actions to automatically build and push a prebuilt Docker image to Docker Hub or GHCR. This will allow users to install the app using just a `docker-compose.yml` file without needing to build from source (`build: .`).
- [ ] **Log Management UI:** Add a way to clear/trim system logs directly from the Dashboard or Settings UI to prevent the database from growing indefinitely.
- [ ] **Verify Telegram Settings UI:** Add a dedicated "Test Connection" button directly inside the Telegram settings block that sends a dummy notification to verify the Chat ID and Token.
- [ ] **Cloud Storage Deletion (Issue #36):** Implement file deletion from cloud providers (S3, GDrive, OneDrive) when backups are rotated or manually deleted, preventing cloud storage accumulation.

## Backlog / Ideas
- [ ] Provide more granular backup retention policies (e.g., keep 7 daily, 4 weekly, 12 monthly).
- [ ] Allow backing up only specific workflows or excluding certain tables.
- [ ] Add support for Amazon S3 compatible providers explicitly in the UI (e.g., MinIO, Backblaze B2, Cloudflare R2).
