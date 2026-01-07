# How to Restore Data from History (Admin Only)

If a user accidentally wipes a day's data, you (the Admin) can restore it from the `shifts_history` table using the API.

## Pre-requisites
- You must be logged in as an **Admin** (role `admin` in Clerk metadata).
- You need the `userId` of the user who lost data.
- You need the `date` to restore (YYYY-MM-DD).

## Restore Procedure (Manual)

Run this command in your browser's Developer Console (F12 -> Console) while on the LokLog page:

```javascript
async function restoreDay(targetUserId, date) {
    const token = await window.Clerk.session.getToken();

    const params = new URLSearchParams({
        date: date,
        userId: targetUserId
    });

    const res = await fetch(`/api/admin/restore?${params}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await res.json();
    console.log(result);

    if (res.ok && result.success) {
        alert(`Restored for user ${targetUserId}!`);
    } else {
        alert("Error: " + (result.error || result));
    }
}

// Example Usage:
// restoreDay('user_2q...', '2025-10-24');
```

## How it works
1. The API verifies your Admin status via Clerk.
2. It looks for all backup entries for the `targetUserId` and `date`.
3. It sorts them by time (newest first).
4. It finds the first backup that actually contains segments (train rides).
5. It overwrites the current live data with that backup.
6. It updates the timestamp so the user's devices will sync the restored data down automatically.
