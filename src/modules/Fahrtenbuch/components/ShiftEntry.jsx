import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainFront, Users, Clock, ArrowRight } from 'lucide-react';

const ShiftEntry = ({ data }) => {
    const navigate = useNavigate();
    const { shift, segments } = data;

    // --- Helpers ---

    // Date Formatting: "09.01.2026"
    const formattedDate = new Date(shift.date).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    // Time Formatting: "HH:MM"
    const formatTime = (t) => t ? t.substring(0, 5) : '??:??';
    const timeRange = shift.start_time && shift.end_time
        ? `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`
        : 'Zeit unbekannt';

    // Route Logic: "FFU - TU - EWAN"
    // We want to extract unique sequence of station codes.
    // Segment: { from_code, to_code }
    const getRouteString = (segs) => {
        if (!segs || segs.length === 0) return 'Keine Fahrten eingetragen';

        let routeParts = [];

        segs.forEach((seg, index) => {
            // Ignore empty segments
            if (!seg.from_code && !seg.to_code) return;

            // Start of a chain or a break in the chain
            if (index === 0) {
                if (seg.from_code) routeParts.push(seg.from_code);
                if (seg.to_code) routeParts.push(seg.to_code);
            } else {
                const lastCode = routeParts[routeParts.length - 1];

                // If the current 'from' is different from the last 'to', add it.
                // Otherwise skip it to avoid duplicates like "A -> B, B -> C" becoming "A - B - B - C"
                if (seg.from_code && seg.from_code !== lastCode) {
                    routeParts.push(seg.from_code);
                }

                if (seg.to_code) {
                    routeParts.push(seg.to_code);
                }
            }
        });

        if (routeParts.length === 0) return 'Keine Strecken eingetragen';
        return routeParts.join(' - ');
    };

    const routeDisplay = getRouteString(segments);

    // Check if list has content (handles array input)
    const hasContent = (list) => {
        if (!list || !Array.isArray(list) || list.length === 0) return false;

        // Filter out empty/placeholder entries (must have at least one field filled)
        return list.some(item =>
            Object.values(item).some(val => val && String(val).trim() !== '')
        );
    };

    const showGuestBadge = hasContent(shift.guest_rides);
    const showWaitBadge = hasContent(shift.waiting_times);

    return (
        <div
            onClick={() => navigate(`/loklog?date=${shift.date}`)}
            className="group bg-card border border-gray-800 rounded-xl p-4 hover:border-accent-blue/50 hover:bg-accent-blue/5 transition cursor-pointer flex flex-col md:flex-row gap-4 md:items-center"
        >
            {/* Date Box */}
            <div className="flex-shrink-0 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:gap-1 min-w-[100px] border-b md:border-b-0 md:border-r border-gray-800 pb-3 md:pb-0 md:pr-4">
                <span className="text-xl font-bold text-white font-mono">{formattedDate}</span>
                <span className="text-xs text-gray-500 font-mono bg-dark px-2 py-1 rounded border border-gray-700">
                    {timeRange}
                </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                    <TrainFront size={18} className="text-accent-blue" />
                    <span className="font-medium text-lg">{routeDisplay}</span>
                </div>

                {/* Badges */}
                <div className="flex gap-2">
                    {showGuestBadge && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-900/20 px-2 py-1 rounded border border-purple-900/50">
                            <Users size={12} /> Gastfahrt
                        </span>
                    )}
                    {showWaitBadge && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-900/50">
                            <Clock size={12} /> Wartezeit
                        </span>
                    )}
                </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:block text-gray-600 group-hover:text-accent-blue transition">
                <ArrowRight size={24} />
            </div>
        </div>
    );
};

export default ShiftEntry;
