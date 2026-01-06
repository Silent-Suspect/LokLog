import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/loklogDb';
import { useAuth } from '@clerk/clerk-react';

export const useShiftSync = (date, isOnline) => {
    const { getToken } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, syncing, saved, error
    const [lastSync, setLastSync] = useState(null);

    // 1. Live Query: Always listen to the local DB for the UI
    const localShift = useLiveQuery(() => db.shifts.where('date').equals(date).first(), [date]);

    // 2. Fetch from Server on Date Change (or First Load)
    // "Last Write Wins" Strategy
    useEffect(() => {
        if (!isOnline || !date) return;

        const fetchServerData = async () => {
            try {
                setStatus('syncing');
                const token = await getToken();
                const res = await fetch(`/api/shifts?date=${date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 404) {
                    setStatus('idle');
                    return;
                }

                if (!res.ok) throw new Error('Fetch failed');

                const data = await res.json();
                if (!data.shift) return;

                // Server should send `updated_at`
                const serverTime = new Date(data.shift.updated_at || 0).getTime();

                // Get fresh local copy
                const currentLocal = await db.shifts.where('date').equals(date).first();
                const localTime = currentLocal?.updated_at || 0;

                // If Server is newer -> Overwrite Local
                if (serverTime > localTime) {
                    const shiftData = {
                        ...data.shift,
                        segments: data.segments || [], // Embed segments
                        updated_at: serverTime,
                        server_id: data.shift.id,
                        dirty: 0, // Clean
                        date: date
                    };

                    if (currentLocal?.id) {
                        await db.shifts.update(currentLocal.id, shiftData);
                    } else {
                        await db.shifts.put(shiftData);
                    }
                    console.log("Synced Down: Server > Local");
                }
                setStatus('idle');
            } catch (e) {
                console.error("Fetch Error", e);
                setStatus('error');
            }
        };

        fetchServerData();
    }, [date, isOnline, getToken]);

    // 3. Auto-Sync Upstream (Push Dirty Records)
    useEffect(() => {
        if (!isOnline) return;

        const syncUp = async () => {
            try {
                // Find ANY dirty record
                const dirtyRecords = await db.shifts.where('dirty').equals(1).toArray();
                if (dirtyRecords.length === 0) return;

                setStatus('syncing');
                const token = await getToken();

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
                        segments: record.segments || []
                    };

                    const res = await fetch('/api/shifts', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) throw new Error(`Sync failed for ${record.date}`);

                    const responseData = await res.json();

                    // Mark Clean & Update IDs
                    await db.shifts.update(record.id, {
                        dirty: 0,
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

        const intervalId = setInterval(syncUp, 15000); // Check every 15 seconds
        return () => clearInterval(intervalId);
    }, [isOnline, getToken]);

    // 4. Save Function (Local)
    const saveLocal = useCallback(async (newData) => {
        const timestamp = Date.now();
        const record = {
            date,
            ...newData.shift,
            segments: newData.segments,
            guest_rides: newData.guestRides,
            waiting_times: newData.waitingTimes,
            updated_at: timestamp,
            dirty: 1 // Mark for sync
        };

        const existing = await db.shifts.where('date').equals(date).first();
        if (existing) {
            await db.shifts.update(existing.id, record);
        } else {
            await db.shifts.put(record);
        }
        setStatus('saved');
    }, [date]);

    return {
        localShift,
        saveLocal,
        status,
        lastSync
    };
};
