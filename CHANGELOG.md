# Changelog

## [1.3.2] - 2026-01-16
### Fixed
- Updater: Fixed critical bug where the updater didn't actually extract files (the "bricked" updater fix).
- UI: Fixed version reporting from specialized const instead of package.json.
- Release: Improved GitHub Actions to preserve detailed release info in version.json.

## [1.3.1] - 2026-01-16
### Fixed
- Authentication: Fixed critical middleware export bug and protected update routes.
- Security: Added validation for download URLs in the update service.
- Localization: Full English/Ukrainian localization for the Updates screen.
- Bug Fixes: Corrected user ID handling in change-password route.
- Docker: Improved port mapping and added .env.example support.

## [1.3.0] - 2026-01-03
### Added
- Google Drive & Microsoft OneDrive cloud backup support.
- Backup Compression (Gzip) and Encryption (AES-256).
- Improved Dashboard status monitoring for n8n and Database.
- Separate settings for n8n container and Database container.
- Better localization for cloud service status.
- New README documentation.

### Fixed
- App Rollback: Fixed partial rollback by including all critical folders (public, routes, etc.) in the pre-update backup.
- Update Download: Fixed authentication issue when downloading update backups from the UI.
- Docker Compatibility: Improved path mapping for rollbacks inside Docker containers.
- Version Consistency: Standardized version to 1.3.0 across all files.
- Update System: Fixed localization typo and improved error reporting and version parsing in history.

## [1.2.1] - 2025-12-09
### Added
- Multi-language support (English/Ukrainian) with UI switcher.
- Change Password functionality in Settings.
- Ability to delete items from Update History.
- "Delete" button for individual history files.

## [1.2.0] - 2025-12-06
### Added
- S3 Cloud Backup support.
- Mobile responsive UI.
- SQLite WAL mode for better database stability.
