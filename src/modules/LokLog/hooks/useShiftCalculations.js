import { useMemo } from 'react';

// Pure Helper Functions (Exported for Testing)
export const getMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

export const calculateDuration = (start, end) => {
    if (!start || !end) return 0;
    const startMin = getMinutes(start);
    const endMin = getMinutes(end);

    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60; // Midnight crossing
    return diff;
};

export const calculateSuggestedPause = (duration) => {
    if (duration > 540) return 45; // > 9h
    if (duration > 360) return 30; // > 6h
    return 0;
};

export const useShiftCalculations = (shift) => {
    // Derived State
    const duration = useMemo(() => {
        return calculateDuration(shift.start_time, shift.end_time);
    }, [shift.start_time, shift.end_time]);

    // Helper: Formatted String (HH:MM) for UI
    const durationString = useMemo(() => {
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    }, [duration]);

    const suggestedPause = useMemo(() => {
        return calculateSuggestedPause(duration);
    }, [duration]);

    return {
        duration,
        durationString,
        suggestedPause,
        calculateDuration,
        getMinutes
    };
};
