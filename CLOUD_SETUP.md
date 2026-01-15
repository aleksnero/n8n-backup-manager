# Cloud Backup Setup Guide

This guide provides step-by-step instructions for configuring cloud storage providers in n8n Backup Manager.

## 📁 Supported Providers
- **Google Drive** (via Service Account or OAuth2)
- **Microsoft OneDrive** (via Refresh Token)
- **S3 Compatible** (AWS S3, MinIO, DigitalOcean Spaces, etc.)

---

## 🟢 Google Drive Setup

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named "n8n Backup Manager".
3. Enable **Google Drive API** in the "APIs & Services" > "Library" section.

### 2. Configure Credentials (Service Account - Recommended)
1. Go to "APIs & Services" > "Credentials".
2. Click "Create Credentials" > **Service Account**.
3. Follow the steps (skip optional ones) and click Done.
4. Click on the newly created service account.
5. Go to the **Keys** tab > "Add Key" > "Create new key".
6. Select **JSON** and download the file.
7. **Important:** Copy the email address of the service account.

### 3. Share Folder with Service Account
1. Open Google Drive.
2. Create a folder (e.g., "n8n Backups").
3. Right-click the folder > "Share".
4. Paste the service account email and give it **Editor** permissions.
5. Copy the **Folder ID** from the URL (the string after `folders/`).

### 4. Configure in Backup Manager
1. Go to **Settings** > **Cloud Configuration**.
2. Set Provider to **Google Drive**.
3. Paste the contents of the JSON file into the **Credentials JSON** field.
4. Paste the **Folder ID**.
5. Save Settings.

---

## 🔵 Microsoft OneDrive Setup

### 1. Create an Azure App Registration
1. Go to [Azure Portal - App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Click **New Registration**.
3. Name it "n8n Backup Manager".
4. Set Redirect URI (Web) to `http://localhost:3000/api/updates/callback/onedrive` (or your public URL).
5. Copy the **Application (client) ID**.

### 2. Configure API Permissions
1. Go to **API permissions**.
2. Click **Add a permission** > **Microsoft Graph**.
3. Select **Delegated permissions**.
4. Search and add: `Files.ReadWrite.All`, `offline_access`.
5. Click **Grant admin consent** (if available).

### 3. Create Client Secret
1. Go to **Certificates & secrets** > **New client secret**.
2. Copy the **Value** (not Secret ID).

### 4. Get Refresh Token
Since getting a refresh token manually can be complex, the Backup Manager will provide an OAuth flow in a future update. For now, you can use tools like [Rclone](https://rclone.org/onedrive/) to generate a token or use the n8n built-in credentials if available.

### 5. Configure in Backup Manager
1. Go to **Settings** > **Cloud Configuration**.
2. Set Provider to **OneDrive**.
3. Paste the **Refresh Token**, **Client ID**, and **Client Secret**.
4. Save Settings.

---

## 🟡 S3 Compatible Storage

1. Obtain your **Access Key**, **Secret Key**, and **Endpoint** from your provider (e.g., AWS, MinIO).
2. Create a Bucket.
3. In Backup Manager, set Provider to **S3**.
4. Fill in the details:
   - **Endpoint** (e.g., `s3.us-east-1.amazonaws.com`)
   - **Region** (e.g., `us-east-1`)
   - **Bucket Name**
   - **Access Key ID**
   - **Secret Access Key**
5. Save Settings.
