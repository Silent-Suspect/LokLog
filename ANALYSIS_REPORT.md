# Analysis Report

This document addresses the specific questions raised during the code health check.

## 1. Database Schema Integrity & Data Loss Risk

**The Mismatch:**
- **Local (Dexie):** Your offline database (`src/db/loklogDb.js`) uses a document-oriented approach where `segments`, `guest_rides`, etc., are often treated as part of the `shifts` object or synced loosely.
- **Server (D1 SQL):** Your backend (`functions/api/shifts.js`) stores `shifts` in one table and `segments` in a separate relational table.
- **The Sync Logic:** The sync hook (`useShiftSync.js`) likely sends the whole JSON blob. The backend then *deletes* all existing segments for that shift and re-inserts them (`DELETE FROM segments WHERE shift_id = ?` followed by `INSERT`).

**Why Data Loss Happened:**
If the backend logic or the network request fails halfway through (e.g., after the DELETE but before the INSERT completes, though you are using `batch()` which *should* prevent this), or if the JSON payload sent from the client is missing the segments property due to a state bug, the backend will "update" the shift by wiping the segments.

**Recommendation:**
1.  **Trust Source of Truth:** Decide if the Server or the Client is the master. Currently, it's "Last Write Wins".
2.  **Safety Net:** Before running the `DELETE` command in `shifts.js`, you could check if the incoming `segments` array is empty. If it is empty but the shift has `flags.normal_service` set, it might be an accidental wipe.
3.  **Schema Alignment:** In V2, consider storing the entire shift as a single JSON BLOB in D1 (`status_json` column) if you don't need to query individual segments via SQL. This removes the complex relational sync and makes "Wipe Clean" bugs impossible because it's just one file overwrite, not a multi-table transaction.

## 2. React Router 7 & Loaders

You are using the latest React Router. Currently, your app uses the "Render-then-Fetch" pattern:
1.  User visits `/loklog` -> Component mounts (Spinner).
2.  `useEffect` runs -> Checks Dexie/API.
3.  Data loads -> State updates -> UI shows.

**The "Render-as-you-Fetch" Pattern (v7 way):**
With Loaders, the router fetches data *before* rendering the component.

**Example Implementation (Future):**
```javascript
// routes/loklog.js
export async function loader({ request }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split('T')[0];
  // Fetch from Dexie or API here
  return { date, shiftData };
}

// LokLogEditor.jsx
import { useLoaderData } from 'react-router';
const { shiftData } = useLoaderData(); // Data is ready immediately!
```
**Benefit:** No "Loading..." spinners flickering on every page navigation. The page only shows when data is ready.

## 3. Google Drive "file" Scope

**Question:** "How does the API know that this excel file was made by the app?"

**Technical Explanation:**
When an application uses the `.../auth/drive.file` scope (instead of the full `drive` scope):
1.  **File Metadata:** Google Drive stores "Created By App ID" metadata for every file.
2.  **Visibility:** The API *filters* the file list. When your app asks "List all files in folder X", Google only returns files where `created_by_app_id == YOUR_APP_ID`.
3.  **Permissions:** If you try to open a file ID that user uploaded manually, the API returns a `404 Not Found` or `403 Forbidden` to your app, even if the file exists.

**Why use it?**
It protects the user. If your app's token is stolen, the attacker can only see the "LokLog" Excel files, not the user's private tax returns or photos.

**Migration:**
To switch, you would change the scope in `useGoogleDrive.js` and ask users to "Reconnect Drive". The app would then lose access to any files it didn't create (which is fine, as it creates new ones daily).
