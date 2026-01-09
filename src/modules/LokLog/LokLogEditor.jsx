import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { FileDown, Plus, Trash2, TrainFront, CheckSquare, Calendar, Cloud, RefreshCw } from 'lucide-react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { db } from '../../db/loklogDb';

// New Modules
import { useShiftSync } from './hooks/useShiftSync';
import { useShiftCalculations } from './hooks/useShiftCalculations';

// Refactored Components
import ShiftTimesInput from './components/ShiftTimesInput';
import ShiftCounters from './components/ShiftCounters';
import ShiftFlags from './components/ShiftFlags';
import SegmentsList from './components/SegmentsList';
import GuestRidesList from './components/GuestRidesList';
import WaitingTimesList from './components/WaitingTimesList';

// Utilities
import { parseRouteInput } from './utils/routeParser';

const LokLogEditor = () => {
    const { isConnected, uploadFile } = useGoogleDrive();
    const { user } = useUser();
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
        return () => window.removeEventListener('online', handleStatus);
    }, []);

    // 1. SYNC & DATA HOOK
    const { saveLocal, status, reloadTrigger } = useShiftSync(date, isOnline);

    // 2. LOCAL STATE
    const [shift, setShift] = useState({
        start_time: '', end_time: '', pause: 0,
        km_start: '', km_end: '',
        energy1_start: '', energy1_end: '',
        energy2_start: '', energy2_end: '',
        flags: {}, notes: ''
    });
    const [segments, setSegments] = useState([]);
    const [guestRides, setGuestRides] = useState([]);
    const [waitingTimes, setWaitingTimes] = useState([]);
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
                    if (data) {
                        const safeParse = (val) => {
                            if (!val) return [];
                            if (Array.isArray(val)) return val;
                            try {
                                const parsed = JSON.parse(val);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch { return []; }
                        };

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
                            flags: typeof data.flags === 'string' ? JSON.parse(data.flags || '{}') : (data.flags || {}),
                            notes: data.notes || ''
                        });
                        setSegments(Array.isArray(data.segments) ? data.segments : []);
                        setGuestRides(safeParse(data.guest_rides));
                        setWaitingTimes(safeParse(data.waiting_times));
                    } else {
                        // Reset if no data found (New Day)
                        setShift({
                            start_time: '', end_time: '', pause: 0,
                            km_start: '', km_end: '',
                            energy1_start: '', energy1_end: '',
                            energy2_start: '', energy2_end: '',
                            flags: {}, notes: ''
                        });
                        setSegments([]);
                        setGuestRides([]);
                        setWaitingTimes([]);
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
        const timeoutId = setTimeout(() => {
            if (!isLoadedRef.current && status === 'idle') return; // Wait for initial load

            const currentData = {
                shift,
                segments,
                guestRides,
                waitingTimes
            };
            saveLocal(currentData);
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
            setSegments([...segments, ...newSegments]);
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
            setSegments([]);
            setGuestRides([]);
            setWaitingTimes([]);

            // Force Clear logic to bypass backend safety net
            saveLocal({
                shift: {
                    start_time: '', end_time: '', pause: 0,
                    km_start: '', km_end: '',
                    energy1_start: '', energy1_end: '',
                    energy2_start: '', energy2_end: '',
                    flags: {}, notes: ''
                },
                segments: [],
                guestRides: [],
                waitingTimes: []
            }, { force_clear: true });
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
                            {status === 'syncing' && <span className="text-yellow-500 text-xs flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Syncing...</span>}
                            {status === 'saved' && <span className="text-green-500 text-xs flex items-center gap-1"><CheckSquare size={12}/> Saved</span>}
                            {status === 'error' && <span className="text-red-500 text-xs">Sync Error</span>}
                        </div>
                    </div>
                    <p className="text-gray-400">Erfasse deine Schicht für den {new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                </div>

                <div className="flex items-center gap-1 bg-dark p-1 rounded-lg border border-gray-700">
                    <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"><Calendar size={18} /></button>
                    <div className="flex items-center gap-2 px-2 border-x border-gray-700/50">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-white py-1 outline-none font-mono text-sm uppercase" />
                    </div>
                    <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"><Calendar size={18} /></button>
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
                        setFlags={(val) => setShift(s => ({...s, flags: typeof val === 'function' ? val(s.flags) : val }))}
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
                            <Plus size={20} />
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

                {/* Reset */}
                <div className="col-span-1 lg:col-span-12 pt-8 border-t border-gray-800">
                    <button onClick={handleResetDay} className="mx-auto block text-red-500 hover:text-red-400 text-sm flex items-center gap-2">
                        <Trash2 size={16}/> Tag komplett zurücksetzen
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
