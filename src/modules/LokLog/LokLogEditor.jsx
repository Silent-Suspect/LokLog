import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { FileDown, PawPrint, Trash2, TrainFront, CheckSquare, ChevronsLeft, ChevronsRight, Cloud, RefreshCw, Bug } from 'lucide-react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { db } from '../../db/loklogDb';

// New Modules
import { useShiftSync } from './hooks/useShiftSync';
import { useShiftCalculations } from './hooks/useShiftCalculations';
import { isDayEmpty } from './utils/shiftUtils';

// Refactored Components
import ShiftTimesInput from './components/ShiftTimesInput';
import ShiftCounters from './components/ShiftCounters';
import ShiftFlags from './components/ShiftFlags';
import SegmentsList from './components/SegmentsList';
import GuestRidesList from './components/GuestRidesList';
import WaitingTimesList from './components/WaitingTimesList';

// Utilities
import { parseRouteInput } from './utils/routeParser';

// CONSTANTS
const EMPTY_SEGMENT = { from_code: '', to_code: '', train_nr: '', tfz: '', departure: '', arrival: '', notes: '' };
const EMPTY_RIDE = { from: '', to: '', dep: '', arr: '' };
const EMPTY_WAIT = { start: '', end: '', loc: '', reason: '' };

const LokLogEditor = () => {
    const { isConnected, uploadFile } = useGoogleDrive();
    const { user } = useUser();
    const { getToken } = useAuth();
    const { settings } = useUserSettings();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
    const [shift, setShift] = useState({
        start_time: '', end_time: '', pause: 0,
        km_start: '', km_end: '',
        energy1_start: '', energy1_end: '',
        energy2_start: '', energy2_end: '',
        flags: {}, notes: ''
    });
    const [segments, setSegments] = useState([{ ...EMPTY_SEGMENT }]);
    const [guestRides, setGuestRides] = useState([{ ...EMPTY_RIDE }]);
    const [waitingTimes, setWaitingTimes] = useState([{ ...EMPTY_WAIT }]);
    const [routeInput, setRouteInput] = useState('');
    const isLoadedRef = useRef(false);

    // Load from DB into State
    useEffect(() => {
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

                        setShift({
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
                        });

                        // Ensure at least one empty item if lists are empty
                        const loadedSegments = Array.isArray(data.segments) ? data.segments : [];
                        setSegments(loadedSegments.length > 0 ? loadedSegments : [{ ...EMPTY_SEGMENT }]);

                        const loadedGuestRides = safeParse(data.guest_rides);
                        setGuestRides(loadedGuestRides.length > 0 ? loadedGuestRides : [{ ...EMPTY_RIDE }]);

                        const loadedWaitingTimes = safeParse(data.waiting_times);
                        setWaitingTimes(loadedWaitingTimes.length > 0 ? loadedWaitingTimes : [{ ...EMPTY_WAIT }]);

                    } else {
                        // Reset if no data found (New Day)
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

    // HELPERS
    const changeDate = (offset) => {
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + offset);
        setDate(currentDate.toISOString().split('T')[0]);
    };

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

    // RESYNC DEBUG TOOL
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
            const bulkData = results.map(r => ({
                ...r.shift,
                segments: r.segments || [],
                flags: JSON.parse(r.shift.status_json || '{}'),
                updated_at: new Date(r.shift.updated_at).getTime(),
                server_id: r.shift.id,
                dirty: 0,
                deleted: 0
            }));

            if (bulkData.length > 0) {
                 await db.shifts.bulkPut(bulkData);
            }

            showToast(`Fertig! ${bulkData.length} Schichten geladen.`, 'success');
            // Force reload current day by toggling existing hydration trigger mechanism logic?
            // Actually, `useLiveQuery` in `useShiftSync` should pick up changes automatically if keys match.
            // But we might need to manually trigger if the current date was one of them.
            // Let's just reload the page for safety or trigger a re-fetch.
            // Actually, we can just use window.location.reload() for a hard reset of state.
            setTimeout(() => window.location.reload(), 1000);

        } catch(e) {
            console.error(e);
            showToast('Fehler beim Resync', 'error');
        }
    };

    // EXPORT (Lazy Loaded)
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            // Dynamic Import for Optimization
            const { handleExportLogic } = await import('./services/exportHandler');

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
            // Toast is handled inside logic or here if import fails
            if (err.message.includes('Failed to fetch dynamically imported module')) {
                showToast('❌ Network Error: Could not load export module', 'error');
            }
        } finally {
            setExporting(false);
        }
    };

    // UI RENDER
    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header */}
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
                                Offline
                            </span>
                        )}
                        {/* SYNC STATUS INDICATOR */}
                        <div className="ml-4">
                            {status === 'syncing' && <span className="text-yellow-500 text-xs flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Syncing...</span>}
                            {status === 'saved' && <span className="text-green-500 text-xs flex items-center gap-1"><CheckSquare size={12} /> Saved</span>}
                            {status === 'error' && <span className="text-red-500 text-xs">Sync Error</span>}
                        </div>
                    </div>
                    <p className="text-gray-400">Erfasse deine Schicht für den {new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                </div>

                <div className="flex items-center gap-1 bg-dark p-1 rounded-lg border border-gray-700">
                    <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"><ChevronsLeft size={18} /></button>
                    <div className="flex items-center gap-2 px-2 border-x border-gray-700/50">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-white py-1 outline-none font-mono text-sm uppercase" />
                    </div>
                    <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"><ChevronsRight size={18} /></button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT: Shift Inputs */}
                <div className="lg:col-span-4 space-y-6">
                    <ShiftTimesInput shift={shift} setShift={setShift} durationString={durationString} />
                    <ShiftCounters shift={shift} setShift={setShift} />
                    <ShiftFlags
                        flags={shift.flags}
                        setFlags={(val) => setShift(s => ({ ...s, flags: typeof val === 'function' ? val(s.flags) : val }))}
                    />
                </div>

                {/* RIGHT: Segments & Extras */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* Smart Route */}
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
                            <PawPrint size={20} />
                        </button>
                    </div>

                    <SegmentsList segments={segments} setSegments={setSegments} />
                    <GuestRidesList guestRides={guestRides} setGuestRides={setGuestRides} />
                    <WaitingTimesList waitingTimes={waitingTimes} setWaitingTimes={setWaitingTimes} />

                    {/* Notes */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-2">
                        <h3 className="font-bold text-white uppercase tracking-wider text-sm">Sonstige Bemerkungen</h3>
                        <textarea
                            value={shift.notes}
                            onChange={e => setShift(s => ({ ...s, notes: e.target.value }))}
                            className="w-full h-32 bg-dark border border-gray-700 rounded-xl p-4 text-white resize-none"
                            placeholder="Hier tippen..."
                        />
                    </div>
                </div>

                {/* Reset & Debug */}
                <div className="col-span-1 lg:col-span-12 pt-8 border-t border-gray-800 flex justify-between items-center">
                    <button onClick={handleResetDay} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-2">
                        <Trash2 size={16} /> Tag komplett zurücksetzen
                    </button>
                    <button onClick={handleForceResync} className="text-gray-500 hover:text-yellow-400 text-xs flex items-center gap-1">
                        <Bug size={14} /> Debug: Force Resync (±4 Weeks)
                    </button>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur border-t border-gray-800 p-4 md:pl-72 z-40 flex items-center justify-end gap-4">

                {/* TOAST */}
                {toast.visible && (
                    <div className={`fixed bottom-24 right-4 z-50 px-6 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-bold flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-gray-900/90 border-green-500 text-white'}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                        {toast.message}
                    </div>
                )}

                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border transition ${isConnected ? 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/30' : 'bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30'}`}
                >
                    {isConnected ? <Cloud size={20} /> : <FileDown size={20} />}
                    {isConnected ? (exporting ? 'Uploading...' : 'Save to Drive') : 'Export Excel'}
                </button>
            </div>
        </div>
    );
};

export default LokLogEditor;
