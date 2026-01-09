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
                let token = await getToken();
                let res = await fetch(`/api/shifts?date=${date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // RETRY LOGIC FOR EXPIRED TOKEN (GET)
                if (res.status === 401 || (res.status === 500)) {
                    let needsRetry = res.status === 401;
                    if (res.status === 500) {
                         // Clone because reading body consumes it
                         const clone = res.clone();
                         try {
                             const errText = await clone.text();
                             if (errText.includes("Token Expired")) {
                                 needsRetry = true;
                             }
                         } catch (e) {
                             // ignore read error
                         }
                    }

                    if (needsRetry) {
                        console.log("Token expired during fetch, retrying with fresh token...");
                        token = await getToken({ skipCache: true }); // Force new token
                        res = await fetch(`/api/shifts?date=${date}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    }
                }

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

                    // IMPORTANT: Ensure ID is preserved correctly
                    // If we receive a UUID from the server, we must ensure local ID matches or we update safely.
                    // The server sends `data.shift.id` (UUID).
                    // Dexie uses `++id` (auto-increment) by default schema.
                    // We must ensure that we don't accidentally create duplicates.

                    if (currentLocal?.id) {
                        await db.shifts.update(currentLocal.id, shiftData);
                    } else {
                        // If we are inserting a new record from server, we might need to handle ID carefully.
                        // However, since schema is ++id, providing an ID (UUID string) might fail if not handled?
                        // Actually, Dexie allows providing keys even for auto-increment stores.
                        // But wait, user issue is about numeric IDs being generated locally.
                        // Here we just fix the retry logic.
                        // The user's other concern about IDs (39e6... vs 4.0) will be addressed separately if needed,
                        // but right now fixing 500 error is priority.

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
                let token = await getToken();

                for (const record of dirtyRecords) {
                    // Helper to perform fetch with retry
                    const performSync = async (currentToken, method = 'PUT', body = null, url = '/api/shifts') => {
                         return await fetch(url, {
                            method,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${currentToken}`
                            },
                            body: body ? JSON.stringify(body) : null
                        });
                    };

                    let res;

                    // DELETE LOGIC
                    if (record.deleted === 1) {
                         res = await performSync(token, 'DELETE', null, `/api/shifts?date=${record.date}`);
                    } else {
                        // PUT LOGIC
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

                        // FIX: Prevent numeric IDs (Dexie local PK) from being sent as 'id' to server.
                        // If we have a server_id (UUID), use it.
                        // If not, delete 'id' so backend generates a fresh UUID.
                        if (record.server_id) {
                            payload.shift.id = record.server_id;
                        } else if (typeof record.id === 'number') {
                            delete payload.shift.id;
                        }

                        res = await performSync(token, 'PUT', payload);
                    }

                    // RETRY LOGIC FOR EXPIRED TOKEN
                    // If 401 or 500 (Token Expired), force refresh and retry once.
                    if (res.status === 401 || res.status === 500) {
                        let needsRetry = res.status === 401;
                        if (!needsRetry && res.status === 500) {
                             const clone = res.clone();
                             try {
                                 const errText = await clone.text();
                                 if (errText.includes("Token Expired")) {
                                     needsRetry = true;
                                 }
                             } catch (e) { /* ignore */ }
                        }

                        if (needsRetry) {
                            console.log("Token expired during sync (PUT), refreshing...");
                            token = await getToken({ skipCache: true });
                            res = await performSync(token);
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

                    // If we just DELETED the record on server, remove it locally
                    if (record.deleted === 1) {
                        await db.shifts.delete(record.id);
                    } else {
                        await db.shifts.update(record.id, {
                            dirty: 0,
                            force_clear: false, // Reset force flag after successful sync
                            server_id: responseData.id, // Store the UUID returned from server
                            updated_at: new Date(responseData.updated_at || Date.now()).getTime()
                        });
                    }
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
            dirty: 1,
            deleted: 0 // Ensure we mark as active
        };

        if (options.force_clear) {
            record.force_clear = true;
        }

        const existing = await db.shifts.where('date').equals(date).first();
        if (existing) {
            await db.shifts.update(existing.id, record);
        } else {
            // New record. Dexie will assign numeric ID (e.g. 4)
            // The sync logic will later send this to server.
            // We modified sync logic to NOT send numeric ID, so server will generate UUID.
            // Server returns UUID, we save it as `server_id`.
            await db.shifts.put(record);
        }
        setStatus('saved');
        // Do NOT trigger reload here to avoid race condition
    }, [date]);

    // 5. Delete Function (Local Soft Delete -> Sync -> Hard Delete)
    const deleteLocal = useCallback(async () => {
        const existing = await db.shifts.where('date').equals(date).first();
        if (existing) {
            // Mark as deleted and dirty so sync picks it up
            await db.shifts.update(existing.id, {
                dirty: 1,
                deleted: 1,
                updated_at: Date.now()
            });
            setStatus('saved'); // Technically 'pending delete'
        }
    }, [date]);

    return {
        localShift, // Still returned if needed for other things
        reloadTrigger, // New signal
        saveLocal,
        deleteLocal,
        status,
        lastSync
    };
};
