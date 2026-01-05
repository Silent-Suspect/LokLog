# Google Drive Integration

This document outlines the implementation details of the Google Drive "Save/Export" feature in LokLog.

## 🔑 Configuration

### Environment Variables
The integration requires two Google Cloud credentials, which must be set in the environment variables (Client-side, exposed via Vite).

| Variable | Description |
| :--- | :--- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID for Web Application. |
| `VITE_GOOGLE_API_KEY` | API Key restricted to **Google Drive API** and **Google Picker API**. |

*   **Local Dev:** Set in `.env.local` (Gitignored).
*   **Production:** Set in Cloudflare Pages "Environment Variables".
*   **Preview:** Set separately in Cloudflare Pages "Preview Environment Variables".

### Google Cloud Console Setup
1.  **APIs Enabled:** Google Drive API, Google Picker API.
2.  **OAuth Consent Screen:** "External" (In testing mode, add user emails manually).
3.  **Authorized JavaScript Origins:**
    *   `http://localhost:5173` (Local)
    *   `https://loklog.pages.dev` (Production)
    *   `https://*.loklog.pages.dev` (Wildcards are **NOT** supported by Google).
    *   *Note:* For Cloudflare Previews (e.g., `https://d7c907c0.loklog.pages.dev`), you must manually whitelist the specific subdomain if testing auth is required.

## 🛠️ Architecture

### 1. The Hook: `useGoogleDrive.js`
This is the core logic engine. It manages:
*   **Script Loading:** Dynamically loads `api.js` (GAPI) and `client.js` (GIS/Identity Services).
*   **Authentication:** Uses Google Identity Services (GIS) Token Model.
    *   **Scope:** `https://www.googleapis.com/auth/drive` (Full write access to support saving to user-created folders).
    *   **Token Bridging:** The critical part is bridging the GIS token to GAPI:
        ```javascript
        tokenClient.callback = (resp) => {
             if (window.gapi) window.gapi.client.setToken(resp); // <--- CRITICAL
        }
        ```
    *   **Silent Re-auth:** We omit `prompt: 'consent'` to allow silent token refreshes if the user has already approved the app.
*   **Folder Selection:** Uses the **Google Picker API** to let the user select a target folder. The Folder ID is persisted in `localStorage`.
*   **File Upload (Overwrite Logic):**
    1.  **Search:** Queries the target folder for a file with the exact same name (`q: name = '...' and '<id>' in parents`).
    2.  **Patch:** If found, updates the content (`PATCH`).
    3.  **Create:** If not found, creates a new file (`POST`).

### 2. The Components
*   **`DriveConnect.jsx`:** A "dumb" UI component that displays connection status, the folder name, and a "Change Folder" button. It receives state/handlers from the parent.
*   **`Settings.jsx`:** The main configuration page. Hosts `DriveConnect` and the "Download Local Copy" toggle.
*   **`LokLogEditor.jsx`:**
    *   Initializes `useGoogleDrive` hook.
    *   On "Export":
        1.  Checks `isConnected`.
        2.  Generates Excel Blob.
        3.  Uploads to Drive (updates toast notifications).
        4.  Optionally triggers a local download based on the `loklog_pref_download_copy` preference.

## ⚠️ Known Issues / Gotchas

1.  **Browser Popup Blockers:**
    *   If the Access Token is expired, the `uploadFile` function calls `login()`.
    *   If this happens *after* an `await` (e.g., generating the Excel file), browsers might block the popup.
    *   *Mitigation:* The Editor performs a "Pre-flight" auth check (silent) at the start of the export process.

2.  **Duplicate Files:**
    *   Google Drive allows multiple files with the same name.
    *   *Solution:* The `uploadFile` function explicitly implements "Search-then-Update" logic to enforce overwriting (revising) the file instead of duplicating it.
