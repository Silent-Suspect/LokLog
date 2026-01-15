import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export const useMonthlyShifts = (year, month) => {
    const { getToken } = useAuth();
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchShifts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();

            // Calculate start and end dates for the month
            // We construct strings manually to avoid timezone shifts (UTC vs Local) that occur with toISOString()

            // Start: YYYY-MM-01
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;

            // End: Last day of the month
            // Create date for day 0 of next month to get last day of current
            const lastDay = new Date(year, month, 0).getDate();
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const res = await fetch(`/api/shifts?start=${startStr}&end=${endStr}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();

            // API returns { results: [{ shift, segments }, ...] }
            // Normalization helper
            const normalizeSegments = (segments) => {
                return (segments || []).map(seg => ({
                    ...seg,
                    from_code: seg.from_station || seg.from_code,
                    to_code: seg.to_station || seg.to_code,
                    tfz: seg.loco_nr || seg.tfz
                }));
            };

            // Apply normalization and sort
            const sorted = (data.results || []).map(item => ({
                ...item,
                segments: normalizeSegments(item.segments)
            })).sort((a, b) =>
                new Date(a.shift.date) - new Date(b.shift.date)
            );

            setShifts(sorted);

        } catch (err) {
            console.error("Failed to fetch monthly shifts:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [year, month, getToken]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    return { shifts, loading, error, refresh: fetchShifts };
};
