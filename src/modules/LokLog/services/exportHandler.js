// src/modules/LokLog/services/exportHandler.js
import { generateShiftExcel } from './exportService';
import { saveAs } from 'file-saver';

const stationCache = new Map();

/**
 * Handles the full export process: fetching templates, stations, generating Excel, and saving.
 * @param {Object} data - { shift, segments, guestRides, waitingTimes, duration, date }
 * @param {Object} user - Clerk user object
 * @param {Object} settings - User settings
 * @param {Function} uploadFile - Drive upload function
 * @param {Function} showToast - Toast notifier
 * @param {boolean} isConnected - Drive connection status
 */
export const handleExportLogic = async (data, user, settings, uploadFile, showToast, isConnected) => {
    try {
        // 1. Load Template
        const res = await fetch('/api/template');
        if (!res.ok) throw new Error("Template load failed");
        const templates = await res.json();
        if (!templates.templateA) throw new Error("Missing templates");

        // 2. Load Stations (Optimize: only unique codes)
        const uniqueCodes = [...new Set(data.segments.flatMap(s => [s.from_code, s.to_code].filter(Boolean)))];

        // Safety: Clear cache if it grows too large before processing
        if (stationCache.size > 500) {
            stationCache.clear();
        }

        // Identify missing codes not in cache
        const missingCodes = uniqueCodes.filter(code => !stationCache.has(code.toUpperCase()));

        if (missingCodes.length > 0) {
            try {
                const q = new URLSearchParams({ codes: missingCodes.join(',') });
                const stRes = await fetch(`/api/stations?${q}`);
                if (stRes.ok) {
                    const stData = await stRes.json();
                    (stData.results || []).forEach(st => {
                        stationCache.set(st.code.toUpperCase(), st.name);
                    });
                }
            } catch (e) {
                console.warn("Station lookup failed", e);
            }
        }

        // Build the map for this export from cache
        const stationMap = new Map();
        uniqueCodes.forEach(code => {
            const upperCode = code.toUpperCase();
            if (stationCache.has(upperCode)) {
                stationMap.set(upperCode, stationCache.get(upperCode));
            }
        });

        // 3. Generate Excel
        const blobData = await generateShiftExcel(
            data,
            user,
            templates,
            { stationMap }
        );

        const blob = new Blob([blobData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = `${data.date}_Fahrtbericht_${user?.lastName || ''}, ${user?.firstName || ''}.xlsx`;

        // 4. Save/Upload
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
        throw err; // Re-throw to let component know
    }
};
