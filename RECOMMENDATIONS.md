# Code Recommendations for LokLog

Here are my recommendations based on a deep health check of your codebase.

## 🚨 Critical Issues (High Priority)

### 1. Inconsistent & Potentially Broken Authentication Logic
**Issue:**
- `functions/api/shifts.js` imports `verifyToken` from `@clerk/backend`.
- `functions/api/auth/google.js` uses a custom `functions/utils/clerk-verify.js` utility.
- **Why it matters:** Previous project context suggests that `@clerk/backend` causes `500 Internal Server Errors` in Cloudflare Workers due to runtime incompatibilities. If `shifts.js` is live, it might be broken or unstable.
- **Action:**
  - Refactor `functions/api/shifts.js` (and other endpoints like `admin`, `settings`) to use `functions/utils/clerk-verify.js` instead of the `@clerk/backend` library.
  - Remove `@clerk/backend` from dependencies if it's not needed, to reduce bundle size and confusion.

### 2. "God Component" - `LokLogEditor.jsx`
**Issue:**
- `LokLogEditor.jsx` is ~360 lines long and handles everything: UI rendering, state management, complex data syncing, data export, and business logic calculations.
- **Why it matters:** This makes the component hard to read, hard to test, and prone to bugs where changing one thing (e.g., UI layout) breaks another (e.g., sync logic).
- **Action:**
  - **Extract Components:** Create `components/ShiftTimesInput.jsx`, `components/SegmentsList.jsx`, `components/GuestRidesList.jsx`.
  - **Extract Logic:** Move the "Smart Route" parsing logic (lines ~120-137) into a utility function `src/utils/routeParser.js`.

---

## 🛠️ Code Quality & Architecture

### 3. Separation of Concerns (Export Logic)
**Issue:**
- The `handleExport` function in `LokLogEditor.jsx` mixes UI state (`setExporting`) with raw data fetching (`fetch('/api/stations')`) and file saving logic.
- **Action:**
  - Move the data preparation logic into `src/modules/LokLog/services/exportService.js`. The component should just pass the data and receive a blob/status.

### 4. Database Schema Integrity
**Issue:**
- The Dexie schema in `src/db/loklogDb.js` defines a `segments` table, but the comments say segments are stored INSIDE the shift object for V1.
- `functions/api/shifts.js` stores segments in a *separate* D1 table (`segments`).
- **Why it matters:** This mismatch between Local (document-style inside Shift) and Server (relational table) adds unnecessary complexity during sync.
- **Action:**
  - Decide on one strategy. Since you are using SQL on the server, a relational approach is cleaner. However, for a simple app, storing the whole shift as a JSON blob in D1 (Document Store pattern) might actually be simpler and faster, removing the need for batch transactions on every save.

---

## 🚀 Performance & Modernization

### 5. React 19 & React Router 7 Usage
**Observation:**
- You are using the latest versions, which is great!
- **Tip:**
  - React 19's `useActionState` (or `useFormStatus` if using forms) could simplify some of the submission logic, though your current `useEffect` + `useState` pattern for autosave is appropriate for this specific "Google Docs style" app.
  - Ensure `react-router-dom` v7 is utilized fully (e.g., using `loader` functions for data fetching instead of `useEffect` in components) to prevent "waterfall" loading states. Currently, `LokLogEditor` loads, *then* `useShiftSync` fires, *then* it queries Dexie/API. A Router Loader could start this fetch earlier.

### 6. Bundle Size
**Observation:**
- `xlsx` (implied by `exceljs`) and `pdf-lib` (if used) can be heavy.
- **Action:**
  - Verify that heavy export libraries are lazy-loaded (dynamically imported) only when the user clicks "Export", so they don't slow down the initial page load.

---

## 🔒 Security

### 7. Google Drive Scope
**Observation:**
- You are using `https://www.googleapis.com/auth/drive` (Full Access).
- **Tip:**
  - If you only need to create and edit files *created by your app*, consider `https://www.googleapis.com/auth/drive.file`. This reduces the security risk if tokens are leaked. (Note: Changing this requires re-consent from all users).

---

## ✅ Summary of Next Steps

1.  **Refactor Auth:** Fix `functions/api/shifts.js` to use `clerk-verify.js`.
2.  **Refactor UI:** Break `LokLogEditor.jsx` into 3-4 smaller components.
3.  **Clean Logic:** Move route parsing and export preparation to helper files.
