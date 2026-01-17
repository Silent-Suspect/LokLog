import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { db } from '../../../db/loklogDb';
import { useShiftSync } from './useShiftSync';
import { useShiftCalculations } from './useShiftCalculations';
import { isDayEmpty } from '../utils/shiftUtils';
import { parseRouteInput } from '../utils/routeParser';

// CONSTANTS
const EMPTY_SEGMENT = { from_code: '', to_code: '', train_nr: '', tfz: '', departure: '', arrival: '', notes: '' };
const EMPTY_RIDE = { from: '', to: '', dep: '', arr: '' };
const EMPTY_WAIT = { start: '', end: '', loc: '', reason: '' };
const EMPTY_SHIFT = {
    start_time: '', end_time: '', pause: 0,
    km_start: '', km_end: '',
    energy1_start: '', energy1_end: '',
    energy2_start: '', energy2_end: '',
    flags: {}, notes: ''
};

export const useShiftForm = (date) => {
    const { isConnected, uploadFile } = useGoogleDrive();
    const { user } = useUser();
    const { getToken } = useAuth();
    const { settings } = useUserSettings();

    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Toast State
    const [toast, setToast] = useState({ message: '', type: '', visible: false });
    const showToast = (message, type = 'info') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Online Listener
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    // 1. SYNC & DATA HOOK
    const { saveLocal, deleteLocal, status, reloadTrigger } = useShiftSync(date, isOnline);

    // 2. LOCAL STATE
    const [shift, setShift] = useState(EMPTY_SHIFT);
    const [segments, setSegments] = useState([{ ...EMPTY_SEGMENT }]);
    const [guestRides, setGuestRides] = useState([{ ...EMPTY_RIDE }]);
    const [waitingTimes, setWaitingTimes] = useState([{ ...EMPTY_WAIT }]);
    const [routeInput, setRouteInput] = useState('');
    const isLoadedRef = useRef(false);
    const lastSavedState = useRef(null);

    // Load from DB into State
    useEffect(() => {
        // RESET STATE SYNCHRONOUSLY to prevent stale data persistence
        setShift(EMPTY_SHIFT);
        setSegments([{ ...EMPTY_SEGMENT }]);
        setGuestRides([{ ...EMPTY_RIDE }]);
        setWaitingTimes([{ ...EMPTY_WAIT }]);

        let isActive = true;
        isLoadedRef.current = false;

        const loadData = async () => {
            try {
                const data = await db.shifts.where('date').equals(date).first();

                if (isActive) {
                    // Ignore if marked for deletion
                    if (data && data.deleted !== 1) {
                        const safeParse = (val) => {
                            if (!val) return [];
                            if (Array.isArray(val)) return val;
                            try {
                                const parsed = JSON.parse(val);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch { return []; }
                        };

                        // Fallback logic for flags
                        let flags = data.flags || {};
                        if (!data.flags && data.status_json) {
                            try { flags = typeof data.status_json === 'string' ? JSON.parse(data.status_json) : data.status_json; } catch {}
                        }
                        if (typeof flags === 'string') {
                            try { flags = JSON.parse(flags); } catch { flags = {}; }
                        }

                        const loadedShift = {
                            start_time: data.start_time || '',
                            end_time: data.end_time || '',
                            pause: data.pause || 0,
                            km_start: data.km_start || '',
                            km_end: data.km_end || '',
                            energy1_start: data.energy1_start || '',
                            energy1_end: data.energy1_end || '',
                            energy2_start: data.energy2_start || '',
                            energy2_end: data.energy2_end || '',
                            flags: flags,
                            notes: data.notes || ''
                        };

                        // Ensure at least one empty item if lists are empty
                        const loadedSegments = Array.isArray(data.segments) ? data.segments : [];
                        const validSegments = loadedSegments.length > 0 ? loadedSegments : [{ ...EMPTY_SEGMENT }];

                        const loadedGuestRides = safeParse(data.guest_rides);
                        const validGuestRides = loadedGuestRides.length > 0 ? loadedGuestRides : [{ ...EMPTY_RIDE }];

                        const loadedWaitingTimes = safeParse(data.waiting_times);
                        const validWaitingTimes = loadedWaitingTimes.length > 0 ? loadedWaitingTimes : [{ ...EMPTY_WAIT }];

                        setShift(loadedShift);
                        setSegments(validSegments);
                        setGuestRides(validGuestRides);
                        setWaitingTimes(validWaitingTimes);

                        // Capture Initial State as "Last Saved"
                        lastSavedState.current = JSON.stringify({
                            shift: loadedShift,
                            segments: validSegments,
                            guestRides: validGuestRides,
                            waitingTimes: validWaitingTimes
                        });

                    } else {
                        // Reset if no data found (New Day)
                        const emptyShift = {
                            start_time: '', end_time: '', pause: 0,
                            km_start: '', km_end: '',
                            energy1_start: '', energy1_end: '',
                            energy2_start: '', energy2_end: '',
                            flags: {}, notes: ''
                        };
                        setShift(emptyShift);
                        setSegments([{ ...EMPTY_SEGMENT }]);
                        setGuestRides([{ ...EMPTY_RIDE }]);
                        setWaitingTimes([{ ...EMPTY_WAIT }]);

                        lastSavedState.current = JSON.stringify({
                            shift: emptyShift,
                            segments: [{ ...EMPTY_SEGMENT }],
                            guestRides: [{ ...EMPTY_RIDE }],
                            waitingTimes: [{ ...EMPTY_WAIT }]
                        });
                    }
                    isLoadedRef.current = true;
                }
            } catch (err) {
                console.error("Failed to load shift", err);
            }
        };

        loadData();

        return () => { isActive = false; };
    }, [date, reloadTrigger]);

    // 3. AUTO-SAVE (State -> Dexie)
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!isLoadedRef.current && status === 'idle') return; // Wait for initial load

            const currentData = {
                shift,
                segments,
                guestRides,
                waitingTimes
            };

            const currentString = JSON.stringify(currentData);

            // Fix: Deep compare to prevent phantom writes
            if (lastSavedState.current === currentString) {
                return;
            }

            const isEmpty = isDayEmpty(currentData);

            // Optimization: Do NOT save if empty and no record exists yet
            if (isEmpty) {
                const existing = await db.shifts.where('date').equals(date).first();
                // If it doesn't exist, OR it exists but is marked deleted, we skip saving
                if (!existing || existing.deleted === 1) {
                    return;
                }
            }

            // Filter out empty placeholder items before saving
            const validSegments = segments.filter(s =>
                s.from_code || s.to_code || s.train_nr || s.tfz || s.departure || s.arrival || s.notes
            );
            const validGuestRides = guestRides.filter(r => r.from || r.to || r.dep || r.arr);
            const validWaitingTimes = waitingTimes.filter(w => w.start || w.end || w.loc || w.reason);

            // We pass valid items to saveLocal, but we keep the placeholders in local state (UI)
            const dataToSave = {
                ...currentData,
                segments: validSegments,
                guestRides: validGuestRides,
                waitingTimes: validWaitingTimes
            };

            // If validSegments are empty, explicitly force clear to bypass backend safety net
            // Note: We prioritize segment check for force_clear as that's the main safety net trigger
            saveLocal(dataToSave, { force_clear: validSegments.length === 0 });

            // Update reference
            lastSavedState.current = currentString;

        }, 1000);

        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shift, segments, guestRides, waitingTimes, saveLocal]);

    // 4. CALCULATIONS HOOK
    const { duration, durationString, suggestedPause } = useShiftCalculations(shift);

    useEffect(() => {
        if (suggestedPause > 0 && (!shift.pause || shift.pause === 0)) {
            setShift(s => ({ ...s, pause: suggestedPause }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestedPause]);

    // HANDLERS
    const handleRouteAdd = () => {
        const newSegments = parseRouteInput(routeInput);
        if (newSegments.length > 0) {
            setSegments(prev => {
                const list = [...prev];
                // Find first completely empty segment
                const insertIdx = list.findIndex(s =>
                    !s.from_code && !s.to_code && !s.train_nr && !s.tfz && !s.departure && !s.arrival && !s.notes
                );

                if (insertIdx !== -1) {
                    // Overwrite the empty slot with the first new segment
                    list[insertIdx] = { ...list[insertIdx], ...newSegments[0] };

                    // Insert the rest of the new segments immediately after
                    if (newSegments.length > 1) {
                        list.splice(insertIdx + 1, 0, ...newSegments.slice(1));
                    }
                    return list;
                } else {
                    // No empty slot found, append all
                    return [...list, ...newSegments];
                }
            });
            setRouteInput('');
        }
    };

    const handleResetDay = () => {
        if (window.confirm("Wirklich alles zurücksetzen?")) {
            setShift({
                start_time: '', end_time: '', pause: 0,
                km_start: '', km_end: '',
                energy1_start: '', energy1_end: '',
                energy2_start: '', energy2_end: '',
                flags: {}, notes: ''
            });
            setSegments([{ ...EMPTY_SEGMENT }]);
            setGuestRides([{ ...EMPTY_RIDE }]);
            setWaitingTimes([{ ...EMPTY_WAIT }]);

            // Use deleteLocal to remove from DB completely
            deleteLocal();
        }
    };

    const handleForceResync = async () => {
        if (!isOnline) {
            showToast('Nur online möglich!', 'error');
            return;
        }
        if (!window.confirm("Achtung: Dies löscht alle lokalen Daten der letzten 4 Wochen und lädt sie neu vom Server. Ungespeicherte Änderungen gehen verloren.")) {
            return;
        }

        try {
            showToast('Lade Daten...', 'info');
            const now = new Date();
            // 4 weeks back
            const start = new Date(now);
            start.setDate(start.getDate() - 28);
            const startStr = start.toISOString().split('T')[0];
            // 4 weeks forward
            const end = new Date(now);
            end.setDate(end.getDate() + 28);
            const endStr = end.toISOString().split('T')[0];

            const token = await getToken();
            const res = await fetch(`/api/shifts?start=${startStr}&end=${endStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Server Error");
            const { results } = await res.json();

            // Clear local range
            await db.shifts.where('date').between(startStr, endStr, true, true).delete();

            // Bulk Insert
            const bulkData = results.map(r => {
                // Helper: Safe Parse JSON
                const safeParseList = (val) => {
                    try {
                        return typeof val === 'string' ? JSON.parse(val) : (val || []);
                    } catch { return []; }
                };

                // Normalize Segments
                const normalizedSegments = (r.segments || []).map(seg => ({
                    ...seg,
                    from_code: seg.from_station || seg.from_code,
                    to_code: seg.to_station || seg.to_code,
                    tfz: seg.loco_nr || seg.tfz
                }));

                return {
                    ...r.shift,
                    segments: normalizedSegments,
                    guest_rides: safeParseList(r.shift.guest_rides),
                    waiting_times: safeParseList(r.shift.waiting_times),
                    flags: JSON.parse(r.shift.status_json || '{}'),
                    updated_at: new Date(r.shift.updated_at).getTime(),
                    server_id: r.shift.id,
                    dirty: 0,
                    deleted: 0
                };
            });

            if (bulkData.length > 0) {
                 await db.shifts.bulkPut(bulkData);
            }

            showToast(`Fertig! ${bulkData.length} Schichten geladen.`, 'success');
            setTimeout(() => window.location.reload(), 1000);

        } catch(e) {
            console.error(e);
            showToast('Fehler beim Resync', 'error');
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            // Dynamic Import for Optimization
            const { handleExportLogic } = await import('../services/exportHandler');

            await handleExportLogic(
                { shift, segments, guestRides, waitingTimes, duration, date },
                user,
                settings,
                uploadFile,
                showToast,
                isConnected
            );
        } catch (err) {
            console.error("Export failed", err);
            if (err.message.includes('Failed to fetch dynamically imported module')) {
                showToast('❌ Network Error: Could not load export module', 'error');
            }
        } finally {
            setExporting(false);
        }
    };

    return {
        formState: {
            shift,
            segments,
            guestRides,
            waitingTimes,
            routeInput,
            durationString
        },
        actions: {
            setShift,
            setSegments,
            setGuestRides,
            setWaitingTimes,
            setRouteInput,
            handleRouteAdd,
            handleResetDay,
            handleForceResync,
            handleExport
        },
        uiState: {
            isOnline,
            isConnected,
            status,
            toast,
            exporting,
            settingsLoading: settings.loading
        }
    };
};
