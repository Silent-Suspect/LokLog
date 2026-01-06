import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Save, FileDown, Plus, Trash2, TrainFront, Clock, Zap, CheckSquare, Calendar, ArrowRight, Cloud, RefreshCw } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { useUserSettings } from '../../hooks/useUserSettings';

// New Modules
import { useShiftSync } from './hooks/useShiftSync';
import { useShiftCalculations } from './hooks/useShiftCalculations';
import { generateShiftExcel } from './services/exportService';

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
    const { localShift, saveLocal, status, lastSync } = useShiftSync(date, isOnline);

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

    // Load from DB into State
    useEffect(() => {
        if (localShift) {
            setShift({
                start_time: localShift.start_time || '',
                end_time: localShift.end_time || '',
                pause: localShift.pause || 0,
                km_start: localShift.km_start || '',
                km_end: localShift.km_end || '',
                energy1_start: localShift.energy1_start || '',
                energy1_end: localShift.energy1_end || '',
                energy2_start: localShift.energy2_start || '',
                energy2_end: localShift.energy2_end || '',
                flags: typeof localShift.flags === 'string' ? JSON.parse(localShift.flags || '{}') : (localShift.flags || {}),
                notes: localShift.notes || ''
            });
            setSegments(localShift.segments || []);

            const safeParse = (val) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val); } catch (e) { return []; }
            };
            setGuestRides(safeParse(localShift.guest_rides));
            setWaitingTimes(safeParse(localShift.waiting_times));
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
    }, [localShift, date]);

    // 3. AUTO-SAVE (State -> Dexie)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (localShift === undefined && status === 'idle') return; // Wait for initial load

            const currentData = {
                shift,
                segments,
                guestRides,
                waitingTimes
            };
            saveLocal(currentData);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [shift, segments, guestRides, waitingTimes, saveLocal]);

    // 4. CALCULATIONS HOOK
    const { duration, durationString, suggestedPause } = useShiftCalculations(shift);

    useEffect(() => {
        if (suggestedPause > 0 && (!shift.pause || shift.pause === 0)) {
            setShift(s => ({ ...s, pause: suggestedPause }));
        }
    }, [suggestedPause]);


    // HELPERS
    const updateGuestRide = (index, field, value) => {
        setGuestRides(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    const removeGuestRide = (index) => setGuestRides(prev => prev.filter((_, i) => i !== index));

    const updateWaitingTime = (index, field, value) => {
        setWaitingTimes(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    const removeWaitingTime = (index) => setWaitingTimes(prev => prev.filter((_, i) => i !== index));

    const changeDate = (offset) => {
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + offset);
        setDate(currentDate.toISOString().split('T')[0]);
    };

    const handleRouteAdd = () => {
        if (!routeInput) return;
        const rawTokens = routeInput.replace(/[,+-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(t => t.length > 0);
        const tokens = [];
        for (let i = 0; i < rawTokens.length; i++) {
            const current = rawTokens[i];
            const next = rawTokens[i + 1];
            if (next && next.length === 1) { tokens.push(`${current} ${next}`); i++; }
            else { tokens.push(current); }
        }
        const newSegments = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            newSegments.push({
                train_nr: '', tfz: '',
                from_code: tokens[i].toUpperCase(),
                to_code: tokens[i + 1].toUpperCase(),
                departure: '', arrival: '', notes: ''
            });
        }
        setSegments([...segments, ...newSegments]);
        setRouteInput('');
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
        }
    };

    // EXPORT
    const [exporting, setExporting] = useState(false);
    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/template');
            if (!res.ok) throw new Error("Template load failed");
            const templates = await res.json();
            if (!templates.templateA) throw new Error("Missing templates");

            const uniqueCodes = [...new Set(segments.flatMap(s => [s.from_code, s.to_code].filter(Boolean)))];
            const stationMap = new Map();
            if (uniqueCodes.length > 0) {
                try {
                    const q = new URLSearchParams({ codes: uniqueCodes.join(',') });
                    const stRes = await fetch(`/api/stations?${q}`);
                    if (stRes.ok) {
                        const stData = await stRes.json();
                        (stData.results || []).forEach(st => stationMap.set(st.code.toUpperCase(), st.name));
                    }
                } catch (e) { console.warn("Station lookup failed", e); }
            }

            const blobData = await generateShiftExcel({
                shift, segments, guestRides, waitingTimes, duration, date
            }, user, templates, { stationMap });

            const blob = new Blob([blobData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `${date}_Fahrtbericht_${user?.lastName || ''}, ${user?.firstName || ''}.xlsx`;

            // Use Server Settings for Download Preference
            // Default to true if loading or undefined, but hook returns default true anyway
            const downloadCopy = settings.pref_download_copy !== false;

            if (isConnected) {
                showToast('Uploading to Drive...', 'info');
                await uploadFile(blob, fileName);
                showToast('✅ Saved to Drive!', 'success');

                if (downloadCopy) saveAs(blob, fileName);
            } else {
                saveAs(blob, fileName);
            }

        } catch (err) {
            console.error(err);
            showToast('❌ Export Error: ' + err.message, 'error');
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
                    <p className="text-gray-400">Erfasse deine Schicht für den {new Date(date).toLocaleDateString('de-DE')}</p>
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
                            <span className="text-gray-400">Dauer: <span className="text-accent-blue font-bold">{durationString}</span></span>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">Pause:</span>
                                <input type="number" value={shift.pause} onChange={e => setShift(s => ({ ...s, pause: e.target.value }))} className="w-16 bg-dark border border-gray-700 rounded p-1 text-center text-white" />
                                <span className="text-gray-500">min</span>
                            </div>
                        </div>
                    </div>

                    {/* Counters */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><Zap size={16} /> Zählerstände</h3>
                        <div className="overflow-hidden rounded-lg border border-gray-700">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr><th className="px-4 py-2">Zähler</th><th className="px-4 py-2">Start</th><th className="px-4 py-2">Ende</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr className="bg-dark">
                                        <td className="px-4 py-2 font-medium text-white">Km</td>
                                        <td className="px-2 py-1"><input type="number" value={shift.km_start} onChange={e => setShift(s => ({ ...s, km_start: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                        <td className="px-2 py-1"><input type="number" value={shift.km_end} onChange={e => setShift(s => ({ ...s, km_end: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                    </tr>
                                    <tr className="bg-dark">
                                        <td className="px-4 py-2 font-medium text-white">EZ 1.8</td>
                                        <td className="px-2 py-1"><input type="number" value={shift.energy1_start} onChange={e => setShift(s => ({ ...s, energy1_start: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                        <td className="px-2 py-1"><input type="number" value={shift.energy1_end} onChange={e => setShift(s => ({ ...s, energy1_end: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                    </tr>
                                    <tr className="bg-dark">
                                        <td className="px-4 py-2 font-medium text-white">EZ 2.8</td>
                                        <td className="px-2 py-1"><input type="number" value={shift.energy2_start} onChange={e => setShift(s => ({ ...s, energy2_start: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                        <td className="px-2 py-1"><input type="number" value={shift.energy2_end} onChange={e => setShift(s => ({ ...s, energy2_end: e.target.value }))} className="w-full bg-transparent border-none text-white p-1" placeholder="..." /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Flags */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><CheckSquare size={16} /> Status</h3>
                        <div className="space-y-2">
                            {["Streckenkunde / EW / BR", "Ausfall vor DB", "Ausfall nach DB", "Normaldienst", "Bereitschaft", "Dienst verschoben"].map(option => (
                                <label key={option} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                                    <input type="checkbox" checked={!!shift.flags[option]} onChange={(e) => setShift(s => ({ ...s, flags: { ...s.flags, [option]: e.target.checked } }))} className="w-4 h-4 rounded text-accent-blue bg-dark border-gray-600 focus:ring-accent-blue" />
                                    <span className="text-gray-200 text-sm">{option}</span>
                                </label>
                            ))}
                        </div>
                        {shift.flags["Streckenkunde / EW / BR"] && (
                            <input type="text" value={shift.flags.param_streckenkunde || ''} onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_streckenkunde: e.target.value } }))} placeholder="Details Streckenkunde..." className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm" />
                        )}
                        {shift.flags["Dienst verschoben"] && (
                            <input type="text" value={shift.flags.param_dienst_verschoben || ''} onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_dienst_verschoben: e.target.value } }))} placeholder="Zeit / Details..." className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm" />
                        )}
                    </div>
                </div>

                {/* RIGHT: Segments & Extras */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* Smart Route */}
                    <div className="bg-accent-blue/5 border border-accent-blue/20 p-4 rounded-2xl flex gap-2">
                        <input type="text" placeholder="Smart Route: e.g. 'AA AABG' generates AA -> AABG" className="flex-1 bg-dark border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-accent-blue outline-none" value={routeInput} onChange={e => setRouteInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleRouteAdd()} />
                        <button onClick={handleRouteAdd} className="bg-accent-blue text-white p-3 rounded-xl hover:bg-blue-600 transition"><Plus size={20} /></button>
                    </div>

                    {/* Segments List */}
                    <div className="space-y-3">
                        {segments.map((seg, i) => (
                            <div key={i} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-3 group relative hover:border-gray-700 transition">
                                <button onClick={() => setSegments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16} /></button>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs font-mono border border-gray-700">#{i + 1}</div>
                                    <div className="flex items-center gap-2 text-lg font-bold font-mono text-white">
                                        <input value={seg.from_code} onChange={e => { const v = e.target.value.toUpperCase(); setSegments(p => p.map((x, idx) => idx === i ? { ...x, from_code: v } : x)); }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="VON" />
                                        <ArrowRight size={16} className="text-gray-500" />
                                        <input value={seg.to_code} onChange={e => { const v = e.target.value.toUpperCase(); setSegments(p => p.map((x, idx) => idx === i ? { ...x, to_code: v } : x)); }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="NACH" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    <input placeholder="Zug-Nr." value={seg.train_nr} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, train_nr: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input placeholder="Tfz" value={seg.tfz} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, tfz: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input type="time" value={seg.departure} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, departure: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input type="time" value={seg.arrival} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, arrival: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input placeholder="Bemerkung" value={seg.notes} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Guest Rides */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2"><TrainFront size={16} /> Gastfahrten</h3>
                            <button onClick={() => setGuestRides([...guestRides, { from: '', to: '', dep: '', arr: '' }])} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"><Plus size={12} /> Add</button>
                        </div>
                        {guestRides.map((ride, i) => (
                             <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <input placeholder="VON" value={ride.from} onChange={e => updateGuestRide(i, 'from', e.target.value.toUpperCase())} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input placeholder="NACH" value={ride.to} onChange={e => updateGuestRide(i, 'to', e.target.value.toUpperCase())} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input type="time" value={ride.dep} onChange={e => updateGuestRide(i, 'dep', e.target.value)} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                    <input type="time" value={ride.arr} onChange={e => updateGuestRide(i, 'arr', e.target.value)} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-500">Duration...</span>
                                    <button onClick={() => removeGuestRide(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                                </div>
                             </div>
                        ))}
                    </div>

                    {/* Waiting Times */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2"><Clock size={16} /> Wartezeiten</h3>
                            <button onClick={() => setWaitingTimes([...waitingTimes, { start: '', end: '', loc: '', reason: '' }])} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"><Plus size={12} /> Add</button>
                        </div>
                        {waitingTimes.map((wait, i) => (
                             <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="flex gap-2">
                                        <input type="time" value={wait.start} onChange={e => updateWaitingTime(i, 'start', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                                        <input type="time" value={wait.end} onChange={e => updateWaitingTime(i, 'end', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                                    </div>
                                    <div className="flex gap-2">
                                        <input placeholder="Ort" value={wait.loc} onChange={e => updateWaitingTime(i, 'loc', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                                        <input placeholder="Grund" value={wait.reason} onChange={e => updateWaitingTime(i, 'reason', e.target.value)} className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-500">...</span>
                                    <button onClick={() => removeWaitingTime(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                                </div>
                             </div>
                        ))}
                    </div>

                    {/* Notes */}
                    <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-2">
                        <h3 className="font-bold text-white uppercase tracking-wider text-sm">Sonstige Bemerkungen</h3>
                        <textarea value={shift.notes} onChange={e => setShift(s => ({ ...s, notes: e.target.value }))} className="w-full h-32 bg-dark border border-gray-700 rounded-xl p-4 text-white resize-none" placeholder="Hier tippen..." />
                    </div>
                </div>

                {/* Reset */}
                <div className="col-span-1 lg:col-span-12 pt-8 border-t border-gray-800">
                    <button onClick={handleResetDay} className="mx-auto block text-red-500 hover:text-red-400 text-sm flex items-center gap-2"><Trash2 size={16}/> Tag komplett zurücksetzen</button>
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

                <button onClick={handleExport} disabled={exporting} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border transition ${isConnected ? 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/30' : 'bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30'}`}>
                    {isConnected ? <Cloud size={20} /> : <FileDown size={20} />}
                    {isConnected ? (exporting ? 'Uploading...' : 'Save to Drive') : 'Export Excel'}
                </button>
                {/* Manual Save removed as per "The button can be removed". Auto-save handles DB sync. Status shown in header. */}
            </div>
        </div>
    );
};

export default LokLogEditor;
