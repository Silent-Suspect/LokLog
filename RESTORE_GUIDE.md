# How to Restore Data from History

If you accidentally wipe a day's data, you can restore it from the `shifts_history` table using the API.

## Pre-requisites
- You must be logged in to the application.
- You need the `date` you want to restore (YYYY-MM-DD).

## Restore Procedure (Manual)

Since there is no UI button for this yet, you can run this command in your browser's Developer Console (F12 -> Console) while on the LokLog page:

```javascript
async function restoreDay(date) {
    const token = await window.Clerk.session.getToken();
    const res = await fetch(`/api/admin/restore?date=${date}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    console.log(result);
    if (result.success) {
        alert("Restored! Please refresh the page.");
    } else {
        alert("Error: " + (result.error || result));
    }
}

// Example Usage:
// restoreDay('2025-10-24');
```

## How it works
1. The API looks for all backup entries for that user and date.
2. It sorts them by time (newest first).
3. It finds the first backup that actually contains segments (train rides).
4. It overwrites the current live data with that backup.
5. It updates the timestamp so your devices will sync the restored data down.
