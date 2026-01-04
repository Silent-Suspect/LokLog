# LokLog Refactoring & Offline Roadmap

**Status:** Planned
**Target:** Implementation during next maintenance window.

## 1. Objective
Refactor the monolithic `LokLogEditor.jsx` into maintainable hooks/services and replace the fragile `localStorage` with a robust `Dexie.js` (IndexedDB) solution to enable true offline capabilities and larger data storage.

---

## 2. Database Schema (Dexie.js)

We will use **Dexie.js** for reactivity and querying.

**File:** `src/db/loklogDb.js`

```javascript
import Dexie from 'dexie';

export const db = new Dexie('LokLogDB');

db.version(1).stores({
  // Shifts Table
  // id: UUID (Primary Key)
  // date: Index for calendar lookups
  // user_id: To separate users if needed later
  shifts: 'id, date, user_id, start_time',

  // Segments Table
  // id: Auto-increment Key
  // shift_id: Foreign Key to link to Shift
  segments: '++id, shift_id, from_code, to_code'
});
```

> **Note:** Guest Rides and Waiting Times can either be stored as separate tables (cleaner) or kept as JSON arrays inside the `shifts` table (simpler, if they are rarely queried individually). Given the current usage, keeping them inside `shifts` as JSON/Objects is acceptable for V1.

---

## 3. Refactoring Roadmap

### Phase 1: Separation of Concerns (The "Breakup")

Move logic out of `LokLogEditor.jsx` into dedicated hooks.

1.  **`src/modules/LokLog/services/exportService.js`**
    *   **Goal:** Move the 300+ lines of `exceljs` logic here.
    *   **Export:** `export async function generateShiftExcel(shift, segments, user, templateA, templateB) { ... }`
    *   **Benefit:** Isolate the brittle cell references (`A11`, etc.) from the React UI.

2.  **`src/modules/LokLog/hooks/useShiftCalculations.js`**
    *   **Goal:** Handle duration and auto-pause logic.
    *   **Logic:** `calculateDuration(start, end)` and `useEffect` for pause suggestion.

3.  **`src/modules/LokLog/hooks/useShiftSync.js` (The Big One)**
    *   **Goal:** Handle the complex "Conflict Resolution" state (`server`, `local`, `diffs`).
    *   **Return:** `{ saveShift, loadShift, conflictState, resolveConflict, isOnline }`

### Phase 2: Implementing IndexedDB

Replace `localStorage` calls with Dexie hooks.

1.  **Install Dependencies:** `npm install dexie dexie-react-hooks`
2.  **Update `useShiftSync.js`:**
    *   *Old:* `localStorage.getItem('loklog_draft_' + date)`
    *   *New:* `useLiveQuery(() => db.shifts.where('date').equals(date).first())`

---

## 4. Migration Strategy ("Wipe & Re-fetch")

Since the online database is the "Source of Truth" and we can coordinate a forced update:

1.  **The Trigger:** A hard browser refresh (clearing cache) or a specific version bump in code.
2.  **The Action:**
    *   On app startup, ignore/clear `localStorage`.
    *   Download the last 10-30 days of shifts from the Cloudflare D1 Backend.
    *   Populate the new `Dexie` database with this server data.
3.  **Result:** The user starts with a fresh, populated local database.

**Risk:** If the user has *unsynced* drafts (offline changes) when this update hits, they would be lost.
**Mitigation:** Verify with the user that all days are "Green" (Synced) before deploying the update.

---

## 5. Future Benefits

*   **Search:** Instant search for "Which day did I drive Loco 185 123?" (impossible with localStorage).
*   **Media:** Ability to attach photos to reports (e.g., "Damage Report").
*   **Performance:** UI will not freeze when saving large monthly reports.
