import React from 'react';
import ShiftEntry from './ShiftEntry';
import { Loader2, CalendarX } from 'lucide-react';

const ShiftList = ({ shifts, loading }) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 size={40} className="animate-spin mb-4 text-accent-blue" />
                <p>Lade Fahrten...</p>
            </div>
        );
    }

    if (!shifts || shifts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-2xl bg-card/50">
                <CalendarX size={48} className="mb-4 text-gray-600" />
                <p className="text-lg font-medium">Keine Fahrten in diesem Monat gefunden.</p>
                <p className="text-sm">Wechsle zum Fahrtbericht, um neue Einträge zu erstellen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {shifts.map((item) => (
                <ShiftEntry key={item.shift.id} data={item} />
            ))}
        </div>
    );
};

export default ShiftList;
