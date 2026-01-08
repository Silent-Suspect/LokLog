import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/loklogDb';
import { useAuth } from '@clerk/clerk-react';

export const useShiftSync = (date, isOnline) => {
    const { getToken } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, syncing, saved, error
    const [lastSync, setLastSync] = useState(null);
    const [reloadTrigger, setReloadTrigger] = useState(0); // Signal for external updates

    // 1. Live Query: Always listen to the local DB for the UI (but we use reloadTrigger to hydrate)
    const localShift = useLiveQuery(() => db.shifts.where('date').equals(date).first(), [date]);

    // 2. Fetch from Server on Date Change (or First Load)
    useEffect(() => {
        // Trigger initial load signal even if offline, so UI hydrates from DB
        setReloadTrigger(prev => prev + 1);

        if (!isOnline || !date) return;

        const fetchServerData = async () => {
            try {
                setStatus('syncing');
                // Get token, potentially forcing refresh if we suspect expiry
                const token = await getToken();
                const res = await fetch(`/api/shifts?date=${date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 404) {
                    setStatus('idle');
                    return;
                }

                if (!res.ok) {
                    // Try to parse error details
                    let errorDetails = 'Unknown error';
                    try {
                        const errorJson = await res.json();
                        errorDetails = JSON.stringify(errorJson);
                    } catch {
                        errorDetails = await res.text();
                    }
                    console.error("Fetch Failed Detail:", errorDetails);

                    // If token expired, we might want to retry once with a fresh token
                    if (errorDetails.includes("Token Expired") || res.status === 401) {
                         console.log("Token expired, retrying with fresh token...");
                         const freshToken = await getToken({ skipCache: true }); // Force refresh if supported by Clerk client
                         // or just re-call if the client handles it. Clerk's getToken usually handles it if we don't pass anything,
                         // but if it returned a stale one, we can try this.
                         // Note: Standard Clerk react `getToken` takes options.

                         // Retry logic would go here, but for now let's just throw to avoid infinite loops without a proper retry mechanism.
                         // Ideally, we'd recursively call or have a retry flag.
                    }

                    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
                }

                const data = await res.json();
                if (!data.shift) return;

                const serverTime = new Date(data.shift.updated_at || 0).getTime();
                const currentLocal = await db.shifts.where('date').equals(date).first();
                const localTime = currentLocal?.updated_at || 0;

                if (serverTime > localTime) {
                    const shiftData = {
                        ...data.shift,
                        segments: data.segments || [],
                        updated_at: serverTime,
                        server_id: data.shift.id,
                        dirty: 0,
                        date: date
                    };

                    if (currentLocal?.id) {
                        await db.shifts.update(currentLocal.id, shiftData);
                    } else {
                        await db.shifts.put(shiftData);
                    }
                    console.log("Synced Down: Server > Local");
                    setReloadTrigger(prev => prev + 1); // Signal UI to reload
                }
                setStatus('idle');
            } catch (e) {
                console.error("Fetch Error", e);
                setStatus('error');
            }
        };

        fetchServerData();
    }, [date, isOnline, getToken]);

    // 3. Auto-Sync Upstream
    useEffect(() => {
        if (!isOnline) return;

        const syncUp = async () => {
            try {
                const dirtyRecords = await db.shifts.where('dirty').equals(1).toArray();
                if (dirtyRecords.length === 0) return;

                setStatus('syncing');
                // Auto-refresh token if it's close to expiry is handled by Clerk, but if we get 401, we need to retry.
                let token = await getToken();

                for (const record of dirtyRecords) {
                    const payload = {
                        shift: {
                            ...record,
                            guest_rides: JSON.stringify(record.guest_rides || []),
                            waiting_times: JSON.stringify(record.waiting_times || []),
                            status_json: JSON.stringify(record.flags || {}),
                            energy_18_start: record.energy1_start,
                            energy_18_end: record.energy1_end,
                            energy_28_start: record.energy2_start,
                            energy_28_end: record.energy2_end,
                            comments: record.notes,
                            updated_at: record.updated_at
                        },
                        segments: record.segments || [],
                        force_clear: !!record.force_clear
                    };

                    let res = await fetch('/api/shifts', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    // RETRY LOGIC FOR EXPIRED TOKEN
                    if (res.status === 401 || (res.status === 500)) {
                        // Note: Our backend returns 500 for Token Expired currently, see logs.
                        // We should check the body text too if possible, but let's just try refreshing on 500 as well if it's "Token Expired"
                        let needsRetry = res.status === 401;
                        if (res.status === 500) {
                             const clone = res.clone();
                             const errText = await clone.text();
                             if (errText.includes("Token Expired")) {
                                 needsRetry = true;
                             }
                        }

                        if (needsRetry) {
                            console.log("Token expired during sync, refreshing...");
                            token = await getToken({ skipCache: true }); // Force new token
                            res = await fetch('/api/shifts', {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(payload)
                            });
                        }
                    }

                    if (!res.ok) {
                        // Try to parse error details
                        let errorDetails = 'Unknown error';
                        try {
                            const errorJson = await res.json();
                            errorDetails = JSON.stringify(errorJson);
                        } catch {
                            errorDetails = await res.text();
                        }
                        console.error(`Sync Failed Detail for ${record.date}:`, errorDetails);
                        throw new Error(`Sync failed: ${res.status} ${res.statusText}`);
                    }

                    const responseData = await res.json();

                    await db.shifts.update(record.id, {
                        dirty: 0,
                        force_clear: false, // Reset force flag after successful sync
                        server_id: responseData.id,
                        updated_at: new Date(responseData.updated_at || Date.now()).getTime()
                    });
                }
                setStatus('saved');
                setLastSync(new Date());
                setTimeout(() => setStatus('idle'), 2000);
            } catch (e) {
                console.error("Sync Up Error", e);
                setStatus('error');
            }
        };

        const intervalId = setInterval(syncUp, 15000);
        return () => clearInterval(intervalId);
    }, [isOnline, getToken]);

    // 4. Save Function (Local)
    const saveLocal = useCallback(async (newData, options = {}) => {
        const timestamp = Date.now();
        const record = {
            date,
            ...newData.shift,
            segments: newData.segments,
            guest_rides: newData.guestRides,
            waiting_times: newData.waitingTimes,
            updated_at: timestamp,
            dirty: 1
        };

        if (options.force_clear) {
            record.force_clear = true;
        }

        const existing = await db.shifts.where('date').equals(date).first();
        if (existing) {
            await db.shifts.update(existing.id, record);
        } else {
            await db.shifts.put(record);
        }
        setStatus('saved');
        // Do NOT trigger reload here to avoid race condition
    }, [date]);

    return {
        localShift, // Still returned if needed for other things
        reloadTrigger, // New signal
        saveLocal,
        status,
        lastSync
    };
};
