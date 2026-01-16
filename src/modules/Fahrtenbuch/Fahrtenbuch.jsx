import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Book, RefreshCw, AlertTriangle } from 'lucide-react';
import MonthNavigator from './components/MonthNavigator';
import ShiftList from './components/ShiftList';
import { useMonthlyShifts } from './hooks/useMonthlyShifts';

const Fahrtenbuch = () => {
    const { user } = useUser();
    // Default to current month
    const [currentDate, setCurrentDate] = useState(new Date());

    // Extract year and month for the hook
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 1-based index for API convenience if needed, but Date uses 0-based

    const { shifts, loading, error, refresh } = useMonthlyShifts(year, month);

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Book className="text-accent-blue" />
                        Fahrtenbuch
                    </h1>
                    <p className="text-gray-400">Übersicht deiner Fahrten</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={refresh}
                        className="p-2 bg-dark border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
                        title="Aktualisieren"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>

                    <MonthNavigator
                        currentDate={currentDate}
                        onChange={setCurrentDate}
                    />
                </div>
            </div>

            {/* Content */}
            {error ? (
                <div className="bg-red-900/20 border border-red-900/50 p-6 rounded-2xl text-red-400 flex items-center gap-3">
                    <AlertTriangle />
                    <div>
                        <p className="font-bold">Fehler beim Laden</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            ) : (
                <ShiftList shifts={shifts} loading={loading} />
            )}
        </div>
    );
};

export default Fahrtenbuch;
