import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Save, FileDown, Plus, Trash2, TrainFront, Clock, Zap, CheckSquare, Calendar, ArrowRight, Wifi, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const LokLogEditor = () => {
    const { getToken } = useAuth();
    const { user } = useUser();

    // State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Conflict Resolution State
    const [conflictState, setConflictState] = useState(null); // { serverData, localData, diffs }
    const [selection, setSelection] = useState({}); // { [key]: 'local' | 'server' }

    // Toast State
    const [toast, setToast] = useState({ message: '', type: '', visible: false });

    // Toast Helper
    const showToast = (message, type = 'info') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Online Status Listener
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    const [shift, setShift] = useState({
        id: null,
        start_time: '', end_time: '', pause: 0,
        km_start: '', km_end: '',
        energy1_start: '', energy1_end: '',
        energy2_start: '', energy2_end: '',
        flags: {}, // Dynamic keys for checkboxes + params
        notes: ''
    });
    const [segments, setSegments] = useState([]);
    const [guestRides, setGuestRides] = useState([]); // { from, to, dep, arr }
    const [waitingTimes, setWaitingTimes] = useState([]); // { start, end, loc, reason }

    // Smart Input
    const [routeInput, setRouteInput] = useState('');

    // Load Data
    useEffect(() => {
        loadShift(date);
    }, [date, isOnline]); // Reload when date changes OR connection comes back

    // Auto-Save Draft Hook (DATE SPECIFIC)
    // Auto-Save Draft Hook (DATE SPECIFIC)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only save if there is some data
            if (shift.start_time || shift.km_start || Object.keys(shift.flags).length > 0 || segments.length > 0) {
                const draftData = {
                    date,
                    shift: {
                        ...shift,
                        // FIX: Explicitly overwrite potentially stringified fields with current arrays
                        guest_rides: guestRides,
                        waiting_times: waitingTimes
                    },
                    segments,
                    guestRides, // Backup array
                    waitingTimes, // Backup array
                    timestamp: new Date().getTime()
                };
                localStorage.setItem(`loklog_draft_${date}`, JSON.stringify(draftData));
                setHasDraft(true);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [shift, segments, guestRides, waitingTimes, date]);

    const safeJSONParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return val; // Already an object
        try {
            return JSON.parse(val);
        } catch (e) {
            console.warn("Failed to parse JSON:", val, e);
            return [];
        }
    };

    const detectConflicts = (server, local) => {
        const diffs = {};
        const sShift = server.shift || {};
        const lShift = local.shift || {};

        // Helper: Compare JSON string or Object
        const isDiff = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

        // 1. Times (Start, End, Pause)
        if (sShift.start_time !== lShift.start_time || sShift.end_time !== lShift.end_time || sShift.pause != lShift.pause) {
            diffs.times = { label: 'Dienstzeiten', local: `${lShift.start_time}-${lShift.end_time} (${lShift.pause}')`, server: `${sShift.start_time}-${sShift.end_time} (${sShift.pause}')` };
        }

        // 2. Counters (Km, Energy)
        if (sShift.km_start != lShift.km_start || sShift.km_end != lShift.km_end ||
            sShift.energy_18_start != lShift.energy1_start) {
            diffs.counters = { label: 'Zählerstände', local: `Km: ${lShift.km_start}...`, server: `Km: ${sShift.km_start}...` };
        }

        // 3. Status/Flags
        const sFlags = typeof sShift.status_json === 'string' ? JSON.parse(sShift.status_json || '{}') : (sShift.status_json || {});
        if (isDiff(sFlags, lShift.flags)) {
            diffs.status = { label: 'Status & Flags', local: 'Lokale Änderungen', server: 'Server Stand' };
        }

        // 4. Segments
        const serverSegs = server.segments || [];
        const localSegs = local.segments || [];
        // Map server segments to compare structure if needed, but length/content check is good start
        // Ideally we should compare critical fields or length
        const sSegsMapped = serverSegs.map(s => ({ from_code: s.from_station, to_code: s.to_station, train_nr: s.train_nr }));
        const lSegsMapped = localSegs.map(s => ({ from_code: s.from_code, to_code: s.to_code, train_nr: s.train_nr }));

        if (isDiff(serverSegs.length, localSegs.length) || isDiff(sSegsMapped, lSegsMapped)) {
            diffs.segments = { label: 'Fahrtenliste', local: `${localSegs.length} Einträge`, server: `${serverSegs.length} Einträge` };
        }

        // 5. Notes
        if ((sShift.comments || '') !== (lShift.notes || '')) {
            diffs.notes = { label: 'Bemerkungen', local: (lShift.notes || '').slice(0, 20) + '...', server: (sShift.comments || '').slice(0, 20) + '...' };
        }

        // 6. Guest Rides & Waiting Times
        // Server sends these as strings usually, need to parse
        const sGuest = safeJSONParse(sShift.guest_rides);
        const lGuest = local.guestRides || safeJSONParse(lShift.guest_rides);

        const sWait = safeJSONParse(sShift.waiting_times);
        const lWait = local.waitingTimes || safeJSONParse(lShift.waiting_times);

        if (isDiff(sGuest, lGuest)) diffs.guest = { label: 'Gastfahrten', local: 'Geändert', server: 'Server' };
        if (isDiff(sWait, lWait)) diffs.waiting = { label: 'Wartezeiten', local: 'Geändert', server: 'Server' };

        return Object.keys(diffs).length > 0 ? diffs : null;
    };

    const handleMerge = () => {
        if (!conflictState) return;
        const { server, local } = conflictState;

        let mergedShift = {
            ...server.shift,
            energy1_start: server.shift.energy_18_start,
            energy1_end: server.shift.energy_18_end,
            energy2_start: server.shift.energy_28_start,
            energy2_end: server.shift.energy_28_end,
            notes: server.shift.comments,
            flags: safeJSONParse(server.shift.status_json || '{}')
        };
        let mergedSegments = (server.segments || []).map(s => ({
            ...s, tfz: s.loco_nr, from_code: s.from_station, to_code: s.to_station
        }));
        let mergedGuest = safeJSONParse(server.shift.guest_rides);
        let mergedWaiting = safeJSONParse(server.shift.waiting_times);

        // Overwrite based on Selection
        if (selection.times === 'local') {
            mergedShift.start_time = local.shift.start_time;
            mergedShift.end_time = local.shift.end_time;
            mergedShift.pause = local.shift.pause;
        }
        if (selection.counters === 'local') {
            mergedShift.km_start = local.shift.km_start;
            mergedShift.km_end = local.shift.km_end;
            mergedShift.energy1_start = local.shift.energy1_start;
            mergedShift.energy1_end = local.shift.energy1_end;
            mergedShift.energy2_start = local.shift.energy2_start;
            mergedShift.energy2_end = local.shift.energy2_end;
        }
        if (selection.status === 'local') mergedShift.flags = local.shift.flags;
        if (selection.notes === 'local') mergedShift.notes = local.shift.notes;
        if (selection.segments === 'local') mergedSegments = local.segments;
        if (selection.guest === 'local') mergedGuest = local.guestRides || safeJSONParse(local.shift.guest_rides);
        if (selection.waiting === 'local') mergedWaiting = local.waitingTimes || safeJSONParse(local.shift.waiting_times);

        // Apply
        setShift(mergedShift);
        setSegments(mergedSegments);
        setGuestRides(mergedGuest);
        setWaitingTimes(mergedWaiting);

        setHasDraft(true);
        setConflictState(null);
    };

    const loadShift = async (selectedDate) => {
        setLoading(true);
        setHasDraft(false);
        const draftKey = `loklog_draft_${selectedDate}`;

        try {
            // STRATEGY: 
            // 1. If Offline -> Load Local Only
            // 2. If Online -> Try API -> If Fail/Empty, Load Local

            if (!isOnline) {
                console.log("Offline Mode: Loading from local storage");
                loadFromLocal(draftKey, selectedDate);
                setLoading(false);
                return;
            }

            // Online: Try Fetch
            try {
                const token = await getToken();
                const res = await fetch(`/api/shifts?date=${selectedDate}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('API Error');

                const data = await res.json();

                if (data.shift) {
                    const localDraftStr = localStorage.getItem(draftKey);
                    if (localDraftStr) {
                        try {
                            const localDraft = JSON.parse(localDraftStr);
                            // Check conflicts if dates match
                            if (localDraft.date === selectedDate) {
                                const diffs = detectConflicts(data, localDraft);
                                if (diffs) {
                                    // Init selection with 'local' for all conflicts
                                    const initialSelection = Object.keys(diffs).reduce((acc, key) => ({ ...acc, [key]: 'local' }), {});
                                    setSelection(initialSelection);
                                    setConflictState({ server: data, local: localDraft, diffs });
                                    setLoading(false);
                                    return; // STOP HERE -> User decides
                                }
                            }
                        } catch (e) { console.warn("Conflict check failed", e); }
                    }

                    // No conflicts? Apply Server
                    setShift({
                        ...data.shift,
                        energy1_start: data.shift.energy_18_start,
                        energy1_end: data.shift.energy_18_end,
                        energy2_start: data.shift.energy_28_start,
                        energy2_end: data.shift.energy_28_end,
                        notes: data.shift.comments,
                        flags: safeJSONParse(data.shift.status_json || '{}')
                    });
                    setSegments(data.segments.map(s => ({
                        ...s,
                        tfz: s.loco_nr,
                        from_code: s.from_station,
                        to_code: s.to_station
                    })) || []);
                    setGuestRides(safeJSONParse(data.shift.guest_rides));
                    setWaitingTimes(safeJSONParse(data.shift.waiting_times));
                    // We found server data, so technically no "unsaved draft" needed unless we want to keep it?
                    // Usually server is authority.
                    setHasDraft(false);
                } else {
                    // Server has no data -> Check Local
                    const loaded = loadFromLocal(draftKey, selectedDate);
                    if (!loaded) resetShift();
                }
            } catch (apiErr) {
                console.warn("API Fetch failed, falling back to local:", apiErr);
                const loaded = loadFromLocal(draftKey, selectedDate);
                if (!loaded) resetShift();
            }

        } catch (err) {
            console.error("Critical Load Error", err);
        } finally {
            setLoading(false);
        }
    };

    const loadFromLocal = (key, expectedDate) => {
        const savedDraft = localStorage.getItem(key);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.date === expectedDate) {
                    setShift(parsed.shift);
                    setSegments(parsed.segments || []);

                    // FIX: Prioritize the explicit array, fallback to shift prop, and ALWAYS SAFE PARSE
                    // This ensures we never set a string into the state
                    const safeGuest = parsed.guestRides || parsed.shift.guest_rides;
                    const safeWait = parsed.waitingTimes || parsed.shift.waiting_times;

                    setGuestRides(safeJSONParse(safeGuest));
                    setWaitingTimes(safeJSONParse(safeWait));

                    setHasDraft(true);
                    return true;
                }
            } catch (e) {
                console.warn("Corrupt local draft found", e);
                return false;
            }
        }
        return false;
    };

    const resetShift = () => {
        setShift({
            id: null,
            start_time: '', end_time: '', pause: 0,
            km_start: '', km_end: '',
            energy1_start: '', energy1_end: '',
            energy2_start: '', energy2_end: '',
            flags: {},
            notes: ''
        });
        setSegments([]);
        setGuestRides([]);
        setWaitingTimes([]);
    };

    const isShiftEmpty = () => {
        // Check if all main fields are empty/default
        const flagsEmpty = Object.keys(shift.flags).length === 0; // resetShift sets flags to {}
        return !shift.start_time && !shift.end_time &&
            !shift.km_start && !shift.km_end &&
            segments.length === 0 &&
            guestRides.length === 0 &&
            waitingTimes.length === 0 &&
            !shift.notes && flagsEmpty;
    };

    const handleResetDay = () => {
        const confirmMsg = `Dies löscht den Fahrbericht für ${new Date(date).toLocaleDateString('de-DE')}! Fortfahren?`;
        if (window.confirm(confirmMsg)) {
            resetShift();
            showToast('Tag zurückgesetzt. Speichern zum Löschen.', 'info');
        }
    };

    // Calculations
    const calculateDuration = () => {
        if (!shift.start_time || !shift.end_time) return 0;
        const [h1, m1] = shift.start_time.split(':').map(Number);
        const [h2, m2] = shift.end_time.split(':').map(Number);

        const start = h1 * 60 + m1;
        const end = h2 * 60 + m2;

        let diff = end - start;
        if (diff < 0) diff += 24 * 60; // Over midnight
        return diff;
    };

    const duration = calculateDuration();

    // Duration Helper String (HH:MM)
    const calculateDurationString = (start, end) => {
        if (!start || !end) return "0:00";
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        const absDiff = diffMinutes < 0 ? diffMinutes + 24 * 60 : diffMinutes;
        const h = Math.floor(absDiff / 60);
        const m = absDiff % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    // Update Helpers
    const updateGuestRide = (index, field, value) => {
        setGuestRides(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    const removeGuestRide = (index) => {
        setGuestRides(prev => prev.filter((_, i) => i !== index));
    };

    const updateWaitingTime = (index, field, value) => {
        setWaitingTimes(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    const removeWaitingTime = (index) => {
        setWaitingTimes(prev => prev.filter((_, i) => i !== index));
    };

    // Date Navigation Helper
    const changeDate = (offset) => {
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + offset);
        setDate(currentDate.toISOString().split('T')[0]);
    };

    // Auto-Pause Suggestion
    useEffect(() => {
        if (duration > 540) setShift(s => ({ ...s, pause: 45 })); // > 9h
        else if (duration > 360) setShift(s => ({ ...s, pause: 30 })); // > 6h
        else setShift(s => ({ ...s, pause: 0 }));
    }, [duration]);

    // Smart Router Logic
    const handleRouteAdd = () => {
        if (!routeInput) return;

        // Smart Split Algorithm
        const rawTokens = routeInput
            .replace(/[,+-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(t => t.length > 0);

        const tokens = [];
        for (let i = 0; i < rawTokens.length; i++) {
            const current = rawTokens[i];
            const next = rawTokens[i + 1];
            if (next && next.length === 1) {
                tokens.push(`${current} ${next}`);
                i++;
            } else {
                tokens.push(current);
            }
        }

        // Create Segments (A -> B, B -> C)
        const newSegments = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            newSegments.push({
                train_nr: '',
                tfz: '',
                from_code: tokens[i].toUpperCase(),
                to_code: tokens[i + 1].toUpperCase(),
                departure: '',
                arrival: '',
                notes: ''
            });
        }

        setSegments([...segments, ...newSegments]);
        setRouteInput('');
    };

    // Save Logic
    const handleSave = async () => {
        setSaving(true);
        const draftKey = `loklog_draft_${date}`;

        // 1. ALWAYS Save Locally First
        try {
            const draftData = {
                date,
                shift: {
                    ...shift,
                    guest_rides: guestRides,
                    waiting_times: waitingTimes
                },
                segments,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
            setHasDraft(true);
        } catch (e) {
            console.error("Local Save failed", e);
            showToast("Warning: Could not save locally.", 'error');
            setSaving(false);
            return;
        }

        // 2. Check Online Status
        if (!isOnline) {
            setSaving(false);
            showToast("📡 Offline Mode: Saved to device safely.", 'success');
            return;
        }

        // 3. Online: Try Sync
        try {
            const token = await getToken();

            // CHECK: IS EMPTY? -> DELETE
            if (isShiftEmpty()) {
                const res = await fetch(`/api/shifts?date=${date}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Delete failed');

                // Clear Draft & State ID
                localStorage.removeItem(draftKey);
                setHasDraft(false);
                setShift(s => ({ ...s, id: null })); // Detach ID
                showToast('🗑️ Tag erfolgreich gelöscht!', 'success');
            }
            else {
                const res = await fetch('/api/shifts', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        shift: {
                            ...shift,
                            date,
                            energy_18_start: shift.energy1_start,
                            energy_18_end: shift.energy1_end,
                            energy_28_start: shift.energy2_start,
                            energy_28_end: shift.energy2_end,
                            guest_rides: guestRides,
                            waiting_times: waitingTimes
                        },
                        segments
                    })
                });
                if (!res.ok) throw new Error('Save failed');
                const data = await res.json();
                setShift(s => ({ ...s, id: data.id }));

                // Clear draft after successful sync
                setHasDraft(false);

                showToast('✅ Synced to Cloud!', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('❌ Cloud Sync failed. Saved locally.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Export Logic Helper
    const processExportData = (segmentsList) => {
        const processedSegments = [];
        const extraComments = [];
        let overflowCounter = 0;

        segmentsList.forEach(seg => {
            let note = seg.notes || '';
            if (note.length > 15) {
                overflowCounter++;
                const starMarker = '*'.repeat(overflowCounter) + ')';
                extraComments.push(`${starMarker} ${note}`);
                note = starMarker;
            }
            processedSegments.push({ ...seg, notes: note });
        });

        return { processedSegments, extraComments };
    };

    // Helper: Robust Worksheet Appender (Limited to Col A-O)
    const appendWorksheet = (sourceSheet, targetSheet, offsetRow) => {
        // 1. Copy Rows & Styles
        sourceSheet.eachRow({ includeEmpty: true }, (srcRow, rowNumber) => {
            const targetRowIdx = offsetRow + (rowNumber - 1);
            const targetRow = targetSheet.getRow(targetRowIdx);

            // Copy Row Height
            if (srcRow.height) {
                targetRow.height = srcRow.height;
            }

            // CRITICAL: Strict Limit to Column O (Index 15)
            // A=1 ... N=14, O=15
            const MAX_COL = 15;

            for (let col = 1; col <= MAX_COL; col++) {
                const srcCell = srcRow.getCell(col);
                const targetCell = targetRow.getCell(col);

                // Copy Value
                targetCell.value = srcCell.value;

                // Deep Copy Style
                if (srcCell.style) {
                    targetCell.style = JSON.parse(JSON.stringify(srcCell.style));
                }

                // CRITICAL: Force Right Border (via Left Border on Col O / 15)
                if (col === 15) {
                    const existingBorder = targetCell.border || {};
                    targetCell.border = {
                        ...existingBorder,
                        left: { style: 'medium' } // Acts as the table's right closing border
                    };
                }
            }
            targetRow.commit();
        });

        // 2. Transfer Merges
        if (sourceSheet.model && sourceSheet.model.merges) {
            sourceSheet.model.merges.forEach(range => {
                try {
                    const matches = range.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
                    if (matches) {
                        const [_, startCol, startRowStr, endCol, endRowStr] = matches;

                        const startRow = parseInt(startRowStr, 10);
                        const endRow = parseInt(endRowStr, 10);

                        const newStartRow = offsetRow + (startRow - 1);
                        const newEndRow = offsetRow + (endRow - 1);

                        const newRange = `${startCol}${newStartRow}:${endCol}${newEndRow}`;

                        targetSheet.mergeCells(newRange);

                        // Fix style for master cell of merge
                        const srcMaster = sourceSheet.getCell(`${startCol}${startRow}`);
                        const tgtMaster = targetSheet.getCell(`${startCol}${newStartRow}`);
                        if (srcMaster.style) {
                            tgtMaster.style = JSON.parse(JSON.stringify(srcMaster.style));
                        }
                    }
                } catch (e) {
                    console.warn("Skipping merge:", range);
                }
            });
        }
    };

    // Excel Export (Lego Strategy)
    const handleExport = async () => {
        try {
            // 1. Get Templates (A and B)
            const res = await fetch('/api/template');
            if (!res.ok) throw new Error(`Template load failed: ${res.statusText}`);

            const json = await res.json();
            if (json.error) throw new Error("API Error: " + json.error);
            if (!json.templateA || !json.templateB) throw new Error("Invalid API response: Missing templates");

            // Duration Helper (HH:MM -> Minutes)
            const getDuration = (start, end) => {
                if (!start || !end) return { mins: 0, str: '0:00' };
                const [h1, m1] = start.split(':').map(Number);
                const [h2, m2] = end.split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 1440; // Handle midnight crossing
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                return { mins: diff, str: `${h}:${m.toString().padStart(2, '0')}` };
            };

            // Helper: Decode Base64 to ArrayBuffer
            const base64ToArrayBuffer = (base64) => {
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes.buffer;
            };

            const bufferA = base64ToArrayBuffer(json.templateA);
            const bufferB = base64ToArrayBuffer(json.templateB);

            // 2. Load Template A (Master)
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(bufferA);
            const ws = workbook.getWorksheet(1);

            // 3. Fill Standard Data (Header, Segments, etc.)
            const dObj = new Date(date);
            const dayStr = String(dObj.getDate()).padStart(2, '0');
            const monthStr = String(dObj.getMonth() + 1).padStart(2, '0');
            const yearStr = String(dObj.getFullYear()).slice(-2);
            ws.getCell('H4').value = `${dayStr}/${monthStr}/${yearStr}`;

            ws.getCell('A4').value = `${user?.lastName || ''}, ${user?.firstName || ''}`;

            if (segments.length > 0) {
                ws.getCell('A11').value = segments[0].from_code;
                ws.getCell('A26').value = segments[segments.length - 1].to_code;
            }

            ws.getCell('E11').value = shift.start_time;
            ws.getCell('E26').value = shift.end_time;

            const hours = Math.floor(duration / 60);
            const mins = duration % 60;
            ws.getCell('N26').value = `${hours},${mins.toString().padStart(2, '0')}`;
            ws.getCell('N28').value = shift.pause ? `${shift.pause} min.` : '';

            // Counters
            const setNum = (cell, val) => {
                if (val !== '' && val !== null && val !== undefined) ws.getCell(cell).value = Number(val);
            };
            setNum('A13', shift.km_start);
            setNum('A28', shift.km_end);
            setNum('E13', shift.energy1_start);
            setNum('E28', shift.energy1_end);
            setNum('I13', shift.energy2_start);
            setNum('I28', shift.energy2_end);

            // Flags
            if (shift.flags['Normaldienst']) ws.getCell('F7').value = 'X';
            if (shift.flags['Bereitschaft']) ws.getCell('I7').value = 'X';
            if (shift.flags['Streckenkunde / EW / BR']) ws.getCell('B7').value = 'X';
            if (shift.flags['Ausfall vor DB']) ws.getCell('D7').value = 'X';
            if (shift.flags['Ausfall nach DB']) ws.getCell('L7').value = 'X';

            if (shift.flags['Streckenkunde / EW / BR']) ws.getCell('B8').value = shift.flags.param_streckenkunde;
            if (shift.flags['Dienst verschoben']) ws.getCell('F8').value = shift.flags.param_dienst_verschoben;

            // 4. Resolve Station Names & Write Segments
            // Build unique list of codes for lookup
            const uniqueCodes = [...new Set(segments.flatMap(s => [s.from_code, s.to_code].filter(Boolean)))];
            const stationMap = new Map();

            if (uniqueCodes.length > 0) {
                try {
                    const queryParams = new URLSearchParams({ codes: uniqueCodes.join(',') });
                    const stRes = await fetch(`/api/stations?${queryParams}`);
                    if (stRes.ok) {
                        const stData = await stRes.json();
                        (stData.results || []).forEach(st => {
                            // Map uppercase code to name
                            stationMap.set(st.code.toUpperCase(), st.name);
                        });
                    }
                } catch (e) {
                    console.warn("Station lookup failed, falling back to codes", e);
                }
            }

            const getStationName = (code) => {
                if (!code) return '';
                // Try map first, fallback to code
                return stationMap.get(code.toUpperCase()) || code;
            };

            const { processedSegments, extraComments } = processExportData(segments);
            const segmentRows = [15, 17, 19, 21, 23];
            processedSegments.slice(0, 5).forEach((seg, i) => {
                const r = segmentRows[i];
                ws.getCell(`A${r}`).value = seg.train_nr;
                ws.getCell(`C${r}`).value = seg.tfz;
                ws.getCell(`D${r}`).value = seg.departure;
                ws.getCell(`H${r}`).value = seg.arrival;

                // Use Resolved Names
                ws.getCell(`E${r}`).value = getStationName(seg.from_code);
                ws.getCell(`I${r}`).value = getStationName(seg.to_code);

                ws.getCell(`L${r}`).value = seg.notes;
            });

            // 5. Write Comments (Row 30+)
            const smartSplit = (text, limit = 80) => {
                if (!text) return [];
                const lines = [];
                const paragraphs = text.toString().split('\n');
                paragraphs.forEach(para => {
                    const words = para.split(' ').filter(w => w.length > 0);
                    if (words.length === 0) return;
                    let currentLine = words[0];
                    for (let i = 1; i < words.length; i++) {
                        const word = words[i];
                        if ((currentLine + ' ' + word).length <= limit) currentLine += ' ' + word;
                        else { lines.push(currentLine); currentLine = word; }
                    }
                    if (currentLine) lines.push(currentLine);
                });
                return lines;
            };

            let allLines = [];
            extraComments.forEach(note => allLines.push(...smartSplit(note)));
            if (shift.notes) allLines.push(...smartSplit(shift.notes));

            const START_COMMENT_ROW = 30;
            let lastCommentRow = START_COMMENT_ROW - 1;

            // Get Reference Style (Row 30)
            const refCell = ws.getCell(`A${START_COMMENT_ROW}`);
            const baseStyle = JSON.parse(JSON.stringify(refCell.style));

            allLines.forEach((line, index) => {
                const currentRow = START_COMMENT_ROW + index;
                const cell = ws.getCell(`A${currentRow}`);
                cell.value = line;
                cell.style = baseStyle;
                cell.alignment = { ...baseStyle.alignment, wrapText: true, vertical: 'top' };
                try { ws.mergeCells(`A${currentRow}:N${currentRow}`); } catch (e) { }
                const neighbor = ws.getCell(currentRow, 15);
                neighbor.border = { left: { style: 'medium' } }; // Restore border

                lastCommentRow = currentRow;
            });

            // Ensure we don't stitch B before 33 (Template A covers 1-32)
            if (lastCommentRow < 32) lastCommentRow = 32;

            // 6. Append Template B (Footer)
            const wbB = new ExcelJS.Workbook();
            await wbB.xlsx.load(bufferB);
            const wsB = wbB.getWorksheet(1);

            const appendStartRow = lastCommentRow + 1;
            appendWorksheet(wsB, ws, appendStartRow);

            // 7. FILL FOOTER DATA (Fixed 6 Rows)
            // Template B structure:
            // Row 1 (footerStartRow): Headers
            // Row 2-7: Data Slots (The loops below target these)
            // Row 8: Sum Row

            const MAX_SLOTS = 6;

            for (let i = 0; i < MAX_SLOTS; i++) {
                // Determine target row index (Header is at appendStartRow, so data starts at +1)
                const currentRow = appendStartRow + 1 + i;

                // A) GASTFAHRTEN (Write to Column A)
                // Format: "FROM - TO (DEP - ARR) = DUR h"
                if (guestRides && guestRides[i]) {
                    const r = guestRides[i];
                    if (r.from && r.to && r.dep && r.arr) {
                        const dur = getDuration(r.dep, r.arr);
                        const text = `${r.from} - ${r.to} (${r.dep} - ${r.arr}) = ${dur.str} h`;
                        ws.getCell(`A${currentRow}`).value = text;
                    }
                }

                // B) WARTEZEITEN (Write to Column H)
                // Format: "START - END LOC (REASON)"
                if (waitingTimes && waitingTimes[i]) {
                    const w = waitingTimes[i];
                    if (w.start && w.end) {
                        const text = `${w.start} - ${w.end} ${w.loc || ''} (${w.reason || ''})`;
                        ws.getCell(`I${currentRow}`).value = text;
                    }
                }
            }

            // CLEANUP: Delete excess rows after the footer
            // Calculate where the document *should* end
            const finalContentRow = appendStartRow + (wsB.rowCount || 15);

            // A) DELETE EXCESS ROWS
            // Keep 1 buffer row, delete the rest (e.g., next 500 rows to be safe)
            try {
                ws.spliceRows(finalContentRow + 2, 500);
            } catch (e) { /* Ignore range errors */ }

            // B) DELETE EXCESS COLUMNS (Ghost Artifacts)
            // Delete from Column P (16) onwards. Let's delete 20 columns to be safe.
            try {
                ws.spliceColumns(16, 20);
            } catch (e) { /* Ignore range errors */ }

            // 8. WRITE TOTAL WAITING TIME (Formula Only)
            // Restore the SUM formula pointing to the correct new rows.
            // We do NOT calculate the sum in JS. We strictly set the Excel formula.

            const sumRowIdx = appendStartRow + 7;
            const rangeStart = appendStartRow + 1;
            const rangeEnd = appendStartRow + 6;

            const sumCell = ws.getCell(`H${sumRowIdx}`);
            sumCell.value = { formula: `SUM(H${rangeStart}:H${rangeEnd})` };
            sumCell.alignment = { horizontal: 'right' };


            // 8. Download
            // Download logic
            const out = await workbook.xlsx.writeBuffer();
            const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `${date}_Fahrtenbericht_${user?.lastName || ''}, ${user?.firstName || ''}.xlsx`;
            saveAs(blob, fileName);

        } catch (err) {
            console.error(err);
            alert('Export Error: ' + err.message);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header / Date Picker */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-gray-800">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <TrainFront className="text-accent-blue" />
                            Fahrtenbuch
                        </h1>
                        {isOnline ? (
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-green-900/30 text-green-400 px-2 py-1 rounded-full border border-green-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Online
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-red-900/30 text-red-400 px-2 py-1 rounded-full border border-red-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Offline Mode
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400">Erfasse deine Schicht für den {new Date(date).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="flex items-center gap-1 bg-dark p-1 rounded-lg border border-gray-700">
                    <button
                        onClick={() => changeDate(-1)}
                        className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"
                        title="Vorheriger Tag"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex items-center gap-2 px-2 border-x border-gray-700/50">
                        <Calendar size={16} className="text-gray-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent text-white py-1 outline-none font-mono text-sm uppercase"
                        />
                    </div>

                    <button
                        onClick={() => changeDate(1)}
                        className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"
                        title="Nächster Tag"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 animate-pulse text-gray-500">Loading Report...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Shift Data */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Times */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><Clock size={16} /> Dienstzeiten</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Beginn</label>
                                    <input type="time" value={shift.start_time} onChange={e => setShift(s => ({ ...s, start_time: e.target.value }))} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Ende</label>
                                    <input type="time" value={shift.end_time} onChange={e => setShift(s => ({ ...s, end_time: e.target.value }))} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-2">
                                <span className="text-gray-400">Dauer: <span className="text-accent-blue font-bold">{Math.floor(duration / 60)}h {duration % 60}m</span></span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Pause:</span>
                                    <input type="number" value={shift.pause} onChange={e => setShift(s => ({ ...s, pause: e.target.value }))} className="w-16 bg-dark border border-gray-700 rounded p-1 text-center text-white" />
                                    <span className="text-gray-500">min</span>
                                </div>
                            </div>
                        </div>


                        {/* 2. Zählerstände (Table Layout) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><Zap size={16} /> Zählerstände</h3>
                            <div className="overflow-hidden rounded-lg border border-gray-700">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2">Zähler</th>
                                            <th className="px-4 py-2">Start</th>
                                            <th className="px-4 py-2">Ende</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">Kilometerstand</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.km_start} onChange={e => setShift(s => ({ ...s, km_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.km_end} onChange={e => setShift(s => ({ ...s, km_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">EZ (Aufn.) 1.8</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy1_start} onChange={e => setShift(s => ({ ...s, energy1_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy1_end} onChange={e => setShift(s => ({ ...s, energy1_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">EZ (Rücksp.) 2.8</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy2_start} onChange={e => setShift(s => ({ ...s, energy2_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy2_end} onChange={e => setShift(s => ({ ...s, energy2_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 1. Status Section (New Requirements) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><CheckSquare size={16} /> Status</h3>

                            <div className="space-y-2">
                                {[
                                    "Streckenkunde / EW / BR",
                                    "Ausfall vor DB",
                                    "Ausfall nach DB",
                                    "Normaldienst",
                                    "Bereitschaft",
                                    "Dienst verschoben"
                                ].map(option => (
                                    <label key={option} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                                        <input
                                            type="checkbox"
                                            checked={!!shift.flags[option]}
                                            onChange={(e) => setShift(s => ({ ...s, flags: { ...s.flags, [option]: e.target.checked } }))}
                                            className="w-4 h-4 rounded text-accent-blue bg-dark border-gray-600 focus:ring-accent-blue focus:ring-2"
                                        />
                                        <span className="text-gray-200 text-sm">{option}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Conditional Inputs */}
                            {shift.flags["Streckenkunde / EW / BR"] && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs text-gray-500 ml-1">Streckenkunde bei...</label>
                                    <input
                                        type="text"
                                        value={shift.flags.param_streckenkunde || ''}
                                        onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_streckenkunde: e.target.value } }))}
                                        placeholder="Name / Details..."
                                        className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-accent-blue transition"
                                    />
                                </div>
                            )}

                            {shift.flags["Dienst verschoben"] && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs text-gray-500 ml-1">Dienst verschoben um...</label>
                                    <input
                                        type="text"
                                        value={shift.flags.param_dienst_verschoben || ''}
                                        onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_dienst_verschoben: e.target.value } }))}
                                        placeholder="Zeit / Details..."
                                        className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-accent-blue transition"
                                    />
                                </div>
                            )}

                        </div>


                    </div>

                    {/* RIGHT COLUMN: Segments */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* CONFLICT RESOLUTION MODAL */}
                        {conflictState && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                                <div className="bg-card border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                                    {/* Header */}
                                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-2xl">
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Zap className="text-yellow-500" /> Synchronisations-Konflikt
                                        </h2>
                                        <span className="text-xs text-gray-500">Bitte wähle für jeden Bereich die korrekte Version.</span>
                                    </div>

                                    {/* Body (Scrollable) */}
                                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                                        {Object.entries(conflictState.diffs).map(([key, diff]) => (
                                            <div key={key} className="bg-dark p-4 rounded-xl border border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                                <div className="font-bold text-gray-300 md:col-span-3 pb-2 border-b border-gray-700/50 mb-2">
                                                    {diff.label}
                                                </div>

                                                {/* Local Option */}
                                                <label className={`cursor-pointer p-3 rounded-lg border transition relative ${selection[key] === 'local' ? 'bg-blue-900/20 border-blue-500' : 'border-gray-700 hover:bg-gray-800'}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <input type="radio" name={key} checked={selection[key] === 'local'} onChange={() => setSelection(s => ({ ...s, [key]: 'local' }))} />
                                                        <span className="text-xs font-bold text-blue-400 uppercase">Lokal (Gerät)</span>
                                                    </div>
                                                    <div className="text-sm text-gray-300 truncate">{diff.local}</div>
                                                </label>

                                                {/* Server Option */}
                                                <label className={`cursor-pointer p-3 rounded-lg border transition relative ${selection[key] === 'server' ? 'bg-purple-900/20 border-purple-500' : 'border-gray-700 hover:bg-gray-800'}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <input type="radio" name={key} checked={selection[key] === 'server'} onChange={() => setSelection(s => ({ ...s, [key]: 'server' }))} />
                                                        <span className="text-xs font-bold text-purple-400 uppercase">Cloud (Server)</span>
                                                    </div>
                                                    <div className="text-sm text-gray-300 truncate">{diff.server}</div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer (Actions) */}
                                    <div className="p-6 border-t border-gray-800 bg-gray-900/50 rounded-b-2xl space-y-4">

                                        {/* Bulk Actions */}
                                        <div className="flex justify-between gap-4 text-xs">
                                            <button
                                                onClick={() => setSelection(Object.keys(conflictState.diffs).reduce((acc, k) => ({ ...acc, [k]: 'local' }), {}))}
                                                className="text-blue-400 hover:text-blue-300 hover:underline"
                                            >
                                                Alles Lokal wählen
                                            </button>
                                            <button
                                                onClick={() => setSelection(Object.keys(conflictState.diffs).reduce((acc, k) => ({ ...acc, [k]: 'server' }), {}))}
                                                className="text-purple-400 hover:text-purple-300 hover:underline"
                                            >
                                                Alles Online wählen
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleMerge}
                                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition"
                                        >
                                            Auswahl übernehmen & Mischen
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Smart Router */}
                        <div className="bg-accent-blue/5 border border-accent-blue/20 p-4 rounded-2xl flex gap-2">
                            <input
                                type="text"
                                placeholder="Smart Route: e.g. 'AA AABG' generates AA -> AABG"
                                className="flex-1 bg-dark border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-accent-blue outline-none"
                                value={routeInput}
                                onChange={e => setRouteInput(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && handleRouteAdd()}
                            />
                            <button onClick={handleRouteAdd} className="bg-accent-blue text-white p-3 rounded-xl hover:bg-blue-600 transition">
                                <Plus size={20} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-3">
                            {segments.map((seg, i) => (
                                <div key={i} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-3 group relative hover:border-gray-700 transition">
                                    <button
                                        onClick={() => setSegments(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs font-mono border border-gray-700">#{i + 1}</div>
                                        <div className="flex items-center gap-2 text-lg font-bold font-mono text-white">
                                            <input value={seg.from_code} onChange={e => {
                                                const v = e.target.value.toUpperCase();
                                                setSegments(p => p.map((x, idx) => idx === i ? { ...x, from_code: v } : x));
                                            }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="VON" />
                                            <ArrowRight size={16} className="text-gray-500" />
                                            <input value={seg.to_code} onChange={e => {
                                                const v = e.target.value.toUpperCase();
                                                setSegments(p => p.map((x, idx) => idx === i ? { ...x, to_code: v } : x));
                                            }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="NACH" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">Zug-Nr.</label>
                                            <input placeholder="12345" value={seg.train_nr} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, train_nr: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">Tfz-Nr.</label>
                                            <input placeholder="185 123" value={seg.tfz} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, tfz: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">AB</label>
                                            <input type="time" value={seg.departure} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, departure: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">AN</label>
                                            <input type="time" value={seg.arrival} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, arrival: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col md:col-span-1">
                                            <label className="text-[10px] text-gray-500 uppercase">Bemerkung</label>
                                            <input placeholder="..." value={seg.notes} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {segments.length === 0 && (
                                <div className="text-center py-10 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                                    Noch keine Fahrten eingetragen. Nutze die Smart Route oben für automatische Split-Ups!
                                </div>
                            )}
                        </div>

                        {/* MODULE: GASTFAHRTEN */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4 mt-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2"><TrainFront size={16} /> Gastfahrten</h3>
                                <button onClick={() => setGuestRides([...guestRides, { from: '', to: '', dep: '', arr: '' }])} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1">
                                    <Plus size={12} /> Hinzufügen
                                </button>
                            </div>

                            <div className="space-y-3">
                                {guestRides.map((ride, i) => {
                                    const rideDuration = calculateDurationString(ride.dep, ride.arr);
                                    return (
                                        <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <input placeholder="VON" value={ride.from} onChange={e => updateGuestRide(i, 'from', e.target.value.toUpperCase())} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                                <input placeholder="NACH" value={ride.to} onChange={e => updateGuestRide(i, 'to', e.target.value.toUpperCase())} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                                <input type="time" value={ride.dep} onChange={e => updateGuestRide(i, 'dep', e.target.value)} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                                <input type="time" value={ride.arr} onChange={e => updateGuestRide(i, 'arr', e.target.value)} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-500 font-mono">
                                                    {ride.from && ride.to ? `${ride.from} - ${ride.to} (${ride.dep} - ${ride.arr}) = ${rideDuration} h` : '...'}
                                                </span>
                                                <button onClick={() => removeGuestRide(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {guestRides.length === 0 && <p className="text-xs text-gray-600 italic">Keine Gastfahrten eingetragen.</p>}
                            </div>
                        </div>

                        {/* MODULE: WARTEZEITEN */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4 mt-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2"><Clock size={16} /> Warte- / Standzeiten</h3>
                                <button onClick={() => setWaitingTimes([...waitingTimes, { start: '', end: '', loc: '', reason: '' }])} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1">
                                    <Plus size={12} /> Hinzufügen
                                </button>
                            </div>

                            <div className="space-y-3">
                                {waitingTimes.map((wait, i) => (
                                    <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="flex gap-2">
                                                <input type="time" value={wait.start} onChange={e => updateWaitingTime(i, 'start', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                                <input type="time" value={wait.end} onChange={e => updateWaitingTime(i, 'end', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                            </div>
                                            <div className="flex gap-2">
                                                <input placeholder="Ort / Signal" value={wait.loc} onChange={e => updateWaitingTime(i, 'loc', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                                ```
                                                <input placeholder="Grund" value={wait.reason} onChange={e => updateWaitingTime(i, 'reason', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500 font-mono">
                                                {wait.start && wait.end ? `${wait.start} - ${wait.end} ${wait.loc} (${wait.reason})` : '...'}
                                            </span>
                                            <button onClick={() => removeWaitingTime(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                {waitingTimes.length === 0 && <p className="text-xs text-gray-600 italic">Keine Wartezeiten eingetragen.</p>}
                            </div>
                        </div>

                        {/* 4. Sonstige Bemerkungen (Bottom) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-2 mt-4">
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm">Sonstige Bemerkungen</h3>
                            <p className="text-xs text-gray-500">Sonstige Hinweise, Lokzustand, Störungen, Mängel an Fahrzeugen, Fehlende Fahrplanunterlagen, Dienstplanwünsche, etc.</p>
                            <textarea
                                value={shift.notes}
                                onChange={e => setShift(s => ({ ...s, notes: e.target.value }))}
                                className="w-full h-32 bg-dark border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:border-accent-blue outline-none resize-none"
                                placeholder="Hier tippen..."
                            />
                        </div>
                    </div>
                    {/* FULL WIDTH: RESET MODULE */}
                    <div className="col-span-1 lg:col-span-12 pt-8 border-t border-gray-800 mt-4">
                        <div className="bg-red-900/10 p-5 rounded-2xl border border-red-900/30 space-y-4 max-w-md mx-auto lg:mx-0">
                            <h3 className="font-bold text-red-400 flex items-center gap-2">
                                <Trash2 size={16} /> Tag zurücksetzen
                            </h3>
                            <p className="text-xs text-gray-500">
                                Setzt alle Eingaben für diesen Tag zurück. Beim Speichern wird der Eintrag aus der Datenbank entfernt.
                            </p>
                            <button
                                onClick={handleResetDay}
                                className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg transition text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} />
                                Tag leeren
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur border-t border-gray-800 p-4 md:pl-72 z-40 flex justify-end items-center gap-4">

                {/* TOAST NOTIFICATION */}
                {toast.visible && (
                    <div className={`fixed bottom-24 right-4 z-50 px-6 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-bold flex items-center gap-3
                        ${toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-gray-900/90 border-green-500 text-white'}
            `}>
                        {toast.type === 'error' ? (
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                        {toast.message}
                    </div>
                )}


                {hasDraft && (
                    <span className="text-xs text-green-500 font-mono flex items-center gap-1 animate-pulse mr-auto md:mr-0">
                        <CheckSquare size={14} /> Draft saved locally
                    </span>
                )}
                <button
                    onClick={handleExport}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/30 transition"
                >
                    <FileDown size={20} /> Export Excel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-accent-blue text-white shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition"
                >
                    <Save size={20} />
                    {saving ? 'Saving...' : 'Save Report'}
                </button>
            </div>
        </div >
    );
};

export default LokLogEditor;
