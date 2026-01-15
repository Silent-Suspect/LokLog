import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/loklogDb';
import { useAuth } from '@clerk/clerk-react';

export const useShiftSync = (date, isOnline) => {
    const { getToken } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, syncing, saved, error
    const [lastSync, setLastSync] = useState(null);
    const [reloadTrigger, setReloadTrigger] = useState(0); // Signal for external updates

    // Safety ref to prevent multiple simultaneous syncs
    const isSyncingRef = useRef(false);

    // 1. Live Query: Always listen to the local DB for the UI
    const localShift = useLiveQuery(() => db.shifts.where('date').equals(date).first(), [date]);

    // --- HELPER: Fetch with Token Retry ---
    const fetchWithRetry = useCallback(async (url, options = {}) => {
        let token = await getToken();
        let headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        // JSON content type by default for PUT/POST
        if (options.method && options.method !== 'GET' && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        let res = await fetch(url, { ...options, headers });

        // Check for Auth Errors (401) or specific 500s that might be auth related
        if (res.status === 401 || res.status === 500) {
            let shouldRetry = res.status === 401;

            // Peek at 500 errors to see if they are actually token issues
            if (!shouldRetry && res.status === 500) {
                 try {
                     const clone = res.clone();
                     const errText = await clone.text();
                     if (errText.includes("Token Expired") || errText.includes("Unauthorized")) {
                         shouldRetry = true;
                     }
                 } catch (e) { /* ignore */ }
            }

            if (shouldRetry) {
                console.log("♻️ Token expired/invalid, refreshing and retrying...");
                token = await getToken({ skipCache: true });
                headers['Authorization'] = `Bearer ${token}`;
                res = await fetch(url, { ...options, headers });
            }
        }

        return res;
    }, [getToken]);


    // 2. Fetch from Server on Date Change (or First Load)
    useEffect(() => {
        // Trigger initial load signal even if offline, so UI hydrates from DB
        setReloadTrigger(prev => prev + 1);

        if (!isOnline || !date) return;

        const fetchServerData = async () => {
            if (isSyncingRef.current) return;
            // Note: We intentionally do NOT set global syncing status here to avoid UI flickering
            // on every date change unless we actually update something.

            try {
                // Fetch Local State
                const currentLocal = await db.shifts.where('date').equals(date).first();

                // Fetch Server State
                const res = await fetchWithRetry(`/api/shifts?date=${date}`);

                if (res.status === 404) {
                    // No data on server.
                    // If local exists and is NOT dirty, we might technically want to delete it?
                    // But usually 404 just means "nothing there yet".
                    return;
                }

                if (!res.ok) {
                    throw new Error(`Fetch failed: ${res.status}`);
                }

                const data = await res.json();
                if (!data.shift) return; // Server empty

                const serverTime = new Date(data.shift.updated_at || 0).getTime();
                const localTime = currentLocal?.updated_at || 0;

                // --- CONFLICT RESOLUTION ---
                let shouldOverwrite = false;

                if (!currentLocal) {
                    shouldOverwrite = true; // Local empty, Server has data -> Sync Down
                } else if (currentLocal.dirty === 0) {
                    // Local Clean: Standard "Server Wins" if newer
                    if (serverTime > localTime) shouldOverwrite = true;
                } else {
                    // Local Dirty: POTENTIAL CONFLICT
                    // "Anti-Nuke" Check:
                    // Did we accidentally wipe local data (e.g. glitch/empty load) while server has valid data?

                    const localHasSegments = (currentLocal.segments && currentLocal.segments.length > 0);
                    const serverHasSegments = (data.segments && data.segments.length > 0);

                    // Logic: If Local is dirty but effectively "Empty" (no segments),
                    // AND Server has "Real Data", assume Local is a glitch/wipe and restore from Server.
                    if (!localHasSegments && serverHasSegments) {
                        console.warn("🛡️ ANTI-NUKE: Detected local wipe of server data. Overwriting local glitch with server data.");
                        shouldOverwrite = true;
                    } else {
                        console.log("✋ Local changes pending. Ignoring server update to prevent overwrite.");
                        shouldOverwrite = false;
                    }
                }

                if (shouldOverwrite) {
                    // FIX: Map status_json to flags for local UI
                    let flags = {};
                    try {
                        flags = typeof data.shift.status_json === 'string'
                            ? JSON.parse(data.shift.status_json)
                            : (data.shift.status_json || {});
                    } catch (e) {
                        console.warn("Failed to parse status_json from server", e);
                    }

                    // FIX: Parse guest_rides/waiting_times from JSON strings to Arrays
                    let guestRides = [];
                    try {
                        guestRides = typeof data.shift.guest_rides === 'string'
                            ? JSON.parse(data.shift.guest_rides)
                            : (data.shift.guest_rides || []);
                    } catch (e) { console.warn("Parse error guest_rides", e); }

                    let waitingTimes = [];
                    try {
                        waitingTimes = typeof data.shift.waiting_times === 'string'
                            ? JSON.parse(data.shift.waiting_times)
                            : (data.shift.waiting_times || []);
                    } catch (e) { console.warn("Parse error waiting_times", e); }


                    // FIX: Normalize segments schema
                    const normalizedSegments = (data.segments || []).map(seg => ({
                        ...seg,
                        from_code: seg.from_station || seg.from_code,
                        to_code: seg.to_station || seg.to_code,
                        tfz: seg.loco_nr || seg.tfz
                    }));

                    const shiftData = {
                        ...data.shift,
                        segments: normalizedSegments,
                        flags: flags,
                        guest_rides: guestRides,
                        waiting_times: waitingTimes,
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
                    console.log("📥 Synced Down: Server > Local");
                    setReloadTrigger(prev => prev + 1);
                }

            } catch (e) {
                console.error("Fetch Error", e);
                // Don't set error status for background fetch to avoid alarming user
            }
        };

        fetchServerData();
    }, [date, isOnline, fetchWithRetry]);


    // 3. Auto-Sync Upstream (PUT/DELETE)
    useEffect(() => {
        if (!isOnline) return;

        const syncUp = async () => {
            if (isSyncingRef.current) return;

            try {
                const dirtyRecords = await db.shifts.where('dirty').equals(1).toArray();
                if (dirtyRecords.length === 0) return;

                isSyncingRef.current = true;
                setStatus('syncing');

                for (const record of dirtyRecords) {
                    let res;

                    // DELETE LOGIC
                    if (record.deleted === 1) {
                        res = await fetchWithRetry(`/api/shifts?date=${record.date}`, {
                            method: 'DELETE'
                        });
                    } else {
                        // PUT LOGIC

                        // Safety Check: Preventing accidental data wipe
                        // If segments are empty but force_clear is NOT true, this might be a glitch.
                        // We skip upload to protect server data.
                        const hasSegments = record.segments && record.segments.length > 0;
                        if (!hasSegments && !record.force_clear) {
                            console.warn("🛡️ Upload Blocked: Attempted to upload empty segments without force_clear.");
                            // We mark as 'saved' locally to stop retry loop, but do not send to server.
                            // This effectively discards the local empty state if it was a glitch.
                            await db.shifts.update(record.id, { dirty: 0 });
                            continue;
                        }

                        const payload = {
                            shift: {
                                ...record,
                                guest_rides: record.guest_rides || [],
                                waiting_times: record.waiting_times || [],
                                flags: record.flags || {},
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

                        // Prevent numeric IDs
                        if (record.server_id) {
                            payload.shift.id = record.server_id;
                        } else if (typeof record.id === 'number') {
                            delete payload.shift.id;
                        }

                        res = await fetchWithRetry('/api/shifts', {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    }

                    if (!res.ok) {
                        // Attempt to read error
                        let errorDetails = '';
                        try { errorDetails = await res.text(); } catch(e){}
                        throw new Error(`Sync failed ${res.status}: ${errorDetails}`);
                    }

                    const responseData = await res.json();

                    // Cleanup Local
                    if (record.deleted === 1) {
                        await db.shifts.delete(record.id);
                    } else {
                        await db.shifts.update(record.id, {
                            dirty: 0,
                            force_clear: false,
                            server_id: responseData.id,
                            updated_at: new Date(responseData.updated_at || Date.now()).getTime() // Sync timestamps
                        });
                    }
                }

                setStatus('saved');
                setLastSync(new Date());

                // Reset to idle after delay
                setTimeout(() => {
                    if (isSyncingRef.current) setStatus('idle');
                }, 2000);

            } catch (e) {
                console.error("📤 Sync Up Error", e);
                setStatus('error');
            } finally {
                isSyncingRef.current = false;
                // Double safety to ensure we don't get stuck in 'syncing' if error occurred
                setTimeout(() => {
                     setStatus(prev => prev === 'syncing' ? 'error' : prev);
                }, 500);
            }
        };

        const intervalId = setInterval(syncUp, 5000); // Check every 5s instead of 15s for snappier sync
        return () => clearInterval(intervalId);
    }, [isOnline, fetchWithRetry]);

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
            deleted: 0
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
    }, [date]);

    // 5. Delete Function (Local Soft Delete)
    const deleteLocal = useCallback(async () => {
        const existing = await db.shifts.where('date').equals(date).first();
        if (existing) {
            await db.shifts.update(existing.id, {
                dirty: 1,
                deleted: 1,
                updated_at: Date.now()
            });
            setStatus('saved');
        }
    }, [date]);

    return {
        localShift,
        reloadTrigger,
        saveLocal,
        deleteLocal,
        status,
        lastSync
    };
};
