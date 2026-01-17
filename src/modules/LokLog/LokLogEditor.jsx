import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, PawPrint, Trash2, TrainFront, CheckSquare, ChevronsLeft, ChevronsRight, Cloud, RefreshCw, Bug, Loader2 } from 'lucide-react';

// New Hook
import { useShiftForm } from './hooks/useShiftForm';

// Refactored Components
import ShiftTimesInput from './components/ShiftTimesInput';
import ShiftCounters from './components/ShiftCounters';
import ShiftFlags from './components/ShiftFlags';
import SegmentsList from './components/SegmentsList';
import GuestRidesList from './components/GuestRidesList';
import WaitingTimesList from './components/WaitingTimesList';

const LokLogEditor = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize date from URL or default to today
    const [date, setDate] = useState(() => {
        return searchParams.get('date') || new Date().toISOString().split('T')[0];
    });

    // Sync URL when date changes
    useEffect(() => {
        setSearchParams({ date });
    }, [date, setSearchParams]);

    // Initialize Form Hook
    const { formState, actions, uiState } = useShiftForm(date);

    // Destructure for easier usage in JSX
    const { shift, segments, guestRides, waitingTimes, routeInput, durationString } = formState;
    const {
        setShift, setSegments, setGuestRides, setWaitingTimes, setRouteInput,
        handleRouteAdd, handleResetDay, handleForceResync, handleExport
    } = actions;
    const { isOnline, isConnected, status, toast, exporting, settingsLoading } = uiState;

    // HELPERS
    const changeDate = (offset) => {
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + offset);
        setDate(currentDate.toISOString().split('T')[0]);
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
            {/* FORCE REMOUNT ON DATE CHANGE */}
            <div key={date} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

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
                    disabled={exporting || settingsLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border transition ${isConnected ? 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/30' : 'bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30'}`}
                >
                    {settingsLoading ? (
                        <span className="flex items-center gap-2"><Loader2 size={20} className="animate-spin" /> Loading...</span>
                    ) : (
                        <>
                            {isConnected ? <Cloud size={20} /> : <FileDown size={20} />}
                            {isConnected ? (exporting ? 'Uploading...' : 'Save to Drive') : 'Export Excel'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default LokLogEditor;
