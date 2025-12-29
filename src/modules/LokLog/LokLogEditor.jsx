import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Save, FileDown, Plus, Trash2, TrainFront, Clock, Zap, CheckSquare, Calendar, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const LokLogEditor = () => {
    const { getToken } = useAuth();
    const { user } = useUser();

    // State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Toast State
    const [toast, setToast] = useState({ message: '', type: '', visible: false });

    // Toast Helper
    const showToast = (message, type = 'info') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Online Status Listener
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    const [shift, setShift] = useState({
        id: null,
        start_time: '', end_time: '', pause: 0,
        km_start: '', km_end: '',
        energy1_start: '', energy1_end: '',
        energy2_start: '', energy2_end: '',
        flags: {}, // Dynamic keys for checkboxes + params
        notes: ''
    });
    const [segments, setSegments] = useState([]);

    // Smart Input
    const [routeInput, setRouteInput] = useState('');

    // Load Data
    useEffect(() => {
        loadShift(date);
    }, [date, isOnline]); // Reload when date changes OR connection comes back

    // Auto-Save Draft Hook (DATE SPECIFIC)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only save if there is some data
            if (shift.start_time || shift.km_start || Object.keys(shift.flags).length > 0 || segments.length > 0) {
                const draftData = {
                    date,
                    shift,
                    segments,
                    timestamp: new Date().getTime()
                };
                localStorage.setItem(`loklog_draft_${date}`, JSON.stringify(draftData));
                setHasDraft(true);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [shift, segments, date]);

    const loadShift = async (selectedDate) => {
        setLoading(true);
        setHasDraft(false);
        const draftKey = `loklog_draft_${selectedDate}`;

        try {
            // STRATEGY: 
            // 1. If Offline -> Load Local Only
            // 2. If Online -> Try API -> If Fail/Empty, Load Local

            if (!isOnline) {
                console.log("Offline Mode: Loading from local storage");
                loadFromLocal(draftKey, selectedDate);
                setLoading(false);
                return;
            }

            // Online: Try Fetch
            try {
                const token = await getToken();
                const res = await fetch(`/api/shifts?date=${selectedDate}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('API Error');

                const data = await res.json();

                if (data.shift) {
                    setShift({
                        ...data.shift,
                        energy1_start: data.shift.energy_18_start,
                        energy1_end: data.shift.energy_18_end,
                        energy2_start: data.shift.energy_28_start,
                        energy2_end: data.shift.energy_28_end,
                        notes: data.shift.comments,
                        flags: JSON.parse(data.shift.status_json || '{}')
                    });
                    setSegments(data.segments.map(s => ({
                        ...s,
                        tfz: s.loco_nr,
                        from_code: s.from_station,
                        to_code: s.to_station
                    })) || []);
                    // We found server data, so technically no "unsaved draft" needed unless we want to keep it?
                    // Usually server is authority.
                    setHasDraft(false);
                } else {
                    // Server has no data -> Check Local
                    const loaded = loadFromLocal(draftKey, selectedDate);
                    if (!loaded) resetShift();
                }
            } catch (apiErr) {
                console.warn("API Fetch failed, falling back to local:", apiErr);
                const loaded = loadFromLocal(draftKey, selectedDate);
                if (!loaded) resetShift();
            }

        } catch (err) {
            console.error("Critical Load Error", err);
        } finally {
            setLoading(false);
        }
    };

    const loadFromLocal = (key, expectedDate) => {
        const savedDraft = localStorage.getItem(key);
        if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            if (parsed.date === expectedDate) {
                setShift(parsed.shift);
                setSegments(parsed.segments);
                setHasDraft(true);
                return true;
            }
        }
        return false;
    };

    const resetShift = () => {
        setShift({
            id: null,
            start_time: '', end_time: '', pause: 0,
            km_start: '', km_end: '',
            energy1_start: '', energy1_end: '',
            energy2_start: '', energy2_end: '',
            flags: {},
            notes: ''
        });
        setSegments([]);
    };

    // Calculations
    const calculateDuration = () => {
        if (!shift.start_time || !shift.end_time) return 0;
        const [h1, m1] = shift.start_time.split(':').map(Number);
        const [h2, m2] = shift.end_time.split(':').map(Number);

        const start = h1 * 60 + m1;
        const end = h2 * 60 + m2;

        let diff = end - start;
        if (diff < 0) diff += 24 * 60; // Over midnight
        return diff;
    };

    const duration = calculateDuration();

    // Auto-Pause Suggestion
    useEffect(() => {
        if (duration > 540) setShift(s => ({ ...s, pause: 45 })); // > 9h
        else if (duration > 360) setShift(s => ({ ...s, pause: 30 })); // > 6h
        else setShift(s => ({ ...s, pause: 0 }));
    }, [duration]);

    // Smart Router Logic
    const handleRouteAdd = () => {
        if (!routeInput) return;

        // Smart Split Algorithm
        const rawTokens = routeInput
            .replace(/[,+-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(t => t.length > 0);

        const tokens = [];
        for (let i = 0; i < rawTokens.length; i++) {
            const current = rawTokens[i];
            const next = rawTokens[i + 1];
            if (next && next.length === 1) {
                tokens.push(`${current} ${next}`);
                i++;
            } else {
                tokens.push(current);
            }
        }

        // Create Segments (A -> B, B -> C)
        const newSegments = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            newSegments.push({
                train_nr: '',
                tfz: '',
                from_code: tokens[i].toUpperCase(),
                to_code: tokens[i + 1].toUpperCase(),
                departure: '',
                arrival: '',
                notes: ''
            });
        }

        setSegments([...segments, ...newSegments]);
        setRouteInput('');
    };

    // Save Logic
    const handleSave = async () => {
        setSaving(true);
        const draftKey = `loklog_draft_${date}`;

        // 1. ALWAYS Save Locally First
        try {
            const draftData = {
                date,
                shift,
                segments,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
            setHasDraft(true);
        } catch (e) {
            console.error("Local Save failed", e);
            showToast("Warning: Could not save locally.", 'error');
            setSaving(false);
            return;
        }

        // 2. Check Online Status
        if (!isOnline) {
            setSaving(false);
            showToast("📡 Offline Mode: Saved to device safely.", 'success');
            return;
        }

        // 3. Online: Try Sync
        try {
            const token = await getToken();
            const res = await fetch('/api/shifts', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    shift: {
                        ...shift,
                        date,
                        energy_18_start: shift.energy1_start,
                        energy_18_end: shift.energy1_end,
                        energy_28_start: shift.energy2_start,
                        energy_28_end: shift.energy2_end
                    },
                    segments
                })
            });
            if (!res.ok) throw new Error('Save failed');
            const data = await res.json();
            setShift(s => ({ ...s, id: data.id }));

            // Note: We keeping the draft as a backup even after sync, 
            // or we could clear it?
            // "Clear Draft: Update the handleSave function. Upon a successful API response... remove... localStorage"
            // The user requested previously to remove it.
            // But now specifically for "Offline First", keeping it as "last known good" is sometimes nice.
            // However, following instructions:
            // "Updated handleSave... if NO (offline): show toast... if YES (online): proceed"
            // The previous request #339 cleared it.
            // Let's clear it to be clean.
            setHasDraft(false);

            showToast('✅ Synced to Cloud!', 'success');
        } catch (err) {
            console.error(err);
            showToast('❌ Cloud Sync failed. Saved locally.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Export Logic Helper
    const processExportData = (segmentsList) => {
        const processedSegments = [];
        const extraComments = [];
        let overflowCounter = 0;

        segmentsList.forEach(seg => {
            let note = seg.notes || '';
            if (note.length > 15) {
                overflowCounter++;
                const starMarker = '*'.repeat(overflowCounter) + ')';
                // Prefix removed as per request (redundant with star link)

                extraComments.push(`${starMarker} ${note}`);
                note = starMarker;
            }
            processedSegments.push({ ...seg, notes: note });
        });

        return { processedSegments, extraComments };
    };

    // Excel Export
    const handleExport = async () => {
        try {
            // 1. Get Template
            const res = await fetch('/api/template');
            if (!res.ok) throw new Error(`Template load failed: ${res.statusText}`);

            // Check for HTML response (SPA Fallback issue in local dev)
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error("Local Env Error: The API returned HTML instead of an Excel file. This usually means the proxy for '/api/template' is missing or the TEMPLATE_URL is not configured locally.");
            }

            const buffer = await res.arrayBuffer();

            // 2. Fill Data
            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.load(buffer);
            } catch (zipErr) {
                console.error("ZIP Parse Error details:", zipErr); // Debug
                throw new Error("Failed to parse Excel file. The downloaded content is likely corrupted or not a valid .xlsx file.");
            }
            const ws = workbook.getWorksheet(1);

            // Header
            const dObj = new Date(date);
            const dayStr = String(dObj.getDate()).padStart(2, '0');
            const monthStr = String(dObj.getMonth() + 1).padStart(2, '0');
            const yearStr = String(dObj.getFullYear()).slice(-2);
            ws.getCell('H4').value = `${dayStr}/${monthStr}/${yearStr}`;

            ws.getCell('A4').value = `${user?.lastName || ''}, ${user?.firstName || ''}`;

            if (segments.length > 0) {
                ws.getCell('A11').value = segments[0].from_code;
                ws.getCell('A26').value = segments[segments.length - 1].to_code;
            }

            ws.getCell('E11').value = shift.start_time;
            ws.getCell('E26').value = shift.end_time;

            // Duration
            const hours = Math.floor(duration / 60);
            const mins = duration % 60;
            ws.getCell('N26').value = `${hours},${mins.toString().padStart(2, '0')}`;
            ws.getCell('N28').value = `${shift.pause}min.`;

            // Counters
            // Counters (Only write if not empty string, to distinguish 0 from empty)
            const setNum = (cell, val) => {
                if (val !== '' && val !== null && val !== undefined) {
                    ws.getCell(cell).value = Number(val);
                }
            };

            setNum('A13', shift.km_start);
            setNum('A28', shift.km_end);
            setNum('E13', shift.energy1_start);
            setNum('E28', shift.energy1_end);
            setNum('I13', shift.energy2_start);
            setNum('I28', shift.energy2_end);

            // Status Logic (Checkboxes)
            // "Normaldienst" -> F7
            if (shift.flags['Normaldienst']) ws.getCell('F7').value = 'X';

            // "Bereitschaft" -> B (I7)
            if (shift.flags['Bereitschaft']) ws.getCell('I7').value = 'X';

            // "Streckenkunde / EW / BR" -> K (B7)
            if (shift.flags['Streckenkunde / EW / BR']) ws.getCell('B7').value = 'X';

            // "Ausfall vor DB" -> A1 (D7)
            if (shift.flags['Ausfall vor DB']) ws.getCell('D7').value = 'X';

            // "Ausfall nach DB" -> A2 (L7)
            if (shift.flags['Ausfall nach DB']) ws.getCell('L7').value = 'X';

            // Status Text Inputs (Specific Cells)
            if (shift.flags['Streckenkunde / EW / BR']) {
                ws.getCell('B8').value = shift.flags.param_streckenkunde;
            }
            if (shift.flags['Dienst verschoben']) {
                ws.getCell('F8').value = shift.flags.param_dienst_verschoben;
            }

            // Process Segments & Comments
            const { processedSegments, extraComments } = processExportData(segments);

            // Segments (Rows 15, 17, 19, 21, 23)
            const rows = [15, 17, 19, 21, 23];
            processedSegments.slice(0, 5).forEach((seg, i) => {
                const r = rows[i];
                ws.getCell(`A${r}`).value = seg.train_nr;
                ws.getCell(`C${r}`).value = seg.tfz;
                ws.getCell(`D${r}`).value = seg.departure;
                ws.getCell(`H${r}`).value = seg.arrival;
                ws.getCell(`E${r}`).value = seg.from_code;
                ws.getCell(`I${r}`).value = seg.to_code;
                ws.getCell(`L${r}`).value = seg.notes;
            });

            // 3. NOTES PROCESSING (FIXED 2026 LOGIC)
            const REF_ROW_IDX = 31;
            const refRow = ws.getRow(REF_ROW_IDX);
            const refCell = ws.getCell(`A${REF_ROW_IDX}`);

            // Deep copy style and height
            const baseStyle = JSON.parse(JSON.stringify(refCell.style));
            const baseHeight = refRow.height;

            // Helper: Word-Based Split
            const smartSplit = (text, limit = 135) => {
                if (!text) return [];
                const lines = [];
                const paragraphs = text.toString().split('\n');
                paragraphs.forEach(para => {
                    const words = para.split(' ').filter(w => w.length > 0);
                    if (words.length === 0) return;
                    let currentLine = words[0];
                    for (let i = 1; i < words.length; i++) {
                        const word = words[i];
                        if ((currentLine + ' ' + word).length <= limit) {
                            currentLine += ' ' + word;
                        } else {
                            lines.push(currentLine);
                            currentLine = word;
                        }
                    }
                    if (currentLine) lines.push(currentLine);
                });
                return lines;
            };

            // 1. COLLECT CONTENT
            let allLines = [];
            extraComments.forEach(note => allLines.push(...smartSplit(note)));
            if (shift.notes) allLines.push(...smartSplit(shift.notes));

            // 2. CALCULATE SPACE
            // Standard space is rows 30, 31, 32.
            const STANDARD_CAPACITY = 3;
            const rowsToAdd = Math.max(0, allLines.length - STANDARD_CAPACITY);

            // 3. INSERT & SANITIZE (If needed)
            if (rowsToAdd > 0) {
                const INSERT_AT = 33; // Push "Gastfahrten" (Row 33) down

                // Insert blank rows
                ws.spliceRows(INSERT_AT, 0, new Array(rowsToAdd).fill(null));

                // Loop through NEW rows to Clean
                for (let i = 0; i < rowsToAdd; i++) {
                    const r = INSERT_AT + i;
                    const newRow = ws.getRow(r);
                    newRow.height = baseHeight;

                    // A. Clear Styles first
                    for (let c = 1; c <= 15; c++) {
                        ws.getCell(r, c).style = {};
                        ws.getCell(r, c).border = {};
                        ws.getCell(r, c).value = null;
                    }

                    // B. PRECISE UNMERGE STRATEGY
                    // The original row 33 likely had merges A-G and H-N.
                    // We must unmerge these specific ranges if they were copied to the new row.
                    try { ws.unMergeCells(`A${r}:G${r}`); } catch (e) { }
                    try { ws.unMergeCells(`H${r}:N${r}`); } catch (e) { }
                    // Just in case, try the full row unmerge too
                    try { ws.unMergeCells(`A${r}:N${r}`); } catch (e) { }

                    newRow.commit(); // Save clean state

                    // C. Now Safe to Merge A-N
                    try {
                        ws.mergeCells(r, 1, r, 14);
                    } catch (e) {
                        console.warn("Merge conflict resolved by ignoring:", e);
                    }

                    // D. Apply Style
                    const cell = ws.getCell(`A${r}`);
                    cell.style = baseStyle;

                    // E. Border for Neighbor (Column O)
                    const neighbor = ws.getCell(r, 15);
                    neighbor.border = { left: { style: 'medium' } };
                }
            }

            // 4. WRITE CONTENT
            allLines.forEach((line, index) => {
                const currentRow = 30 + index;
                const cell = ws.getCell(`A${currentRow}`);
                cell.value = line;
                cell.alignment = { ...baseStyle.alignment, wrapText: true, vertical: 'top' };
            });

            // 5. UPDATE FORMULA (Footer Shift)
            // Original Sum: H40, Range: H34:H39
            if (rowsToAdd >= 0) {
                const newSumRow = 40 + rowsToAdd;
                const startRange = 34 + rowsToAdd;
                const endRange = 39 + rowsToAdd;

                const sumCell = ws.getCell(`H${newSumRow}`);
                // Re-apply a basic border style to the sum cell if it lost it during the shift
                sumCell.value = { formula: `SUM(H${startRange}:H${endRange})` };
            }

            // 3. Download
            const out = await workbook.xlsx.writeBuffer();
            const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const fileName = `${date}_Fahrtenbericht_${user?.lastName || ''}, ${user?.firstName || ''}.xlsx`;
            saveAs(blob, fileName);

        } catch (err) {
            console.error(err);
            alert('Export Error: ' + err.message);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header / Date Picker */}
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
                                Offline Mode
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400">Erfasse deine Schicht für {new Date(date).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="flex items-center gap-2 bg-dark p-1 rounded-lg border border-gray-700">
                    <Calendar size={18} className="text-gray-400 ml-2" />
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-transparent text-white p-2 outline-none font-mono"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 animate-pulse text-gray-500">Loading Report...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Shift Data */}
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
                                <span className="text-gray-400">Dauer: <span className="text-accent-blue font-bold">{Math.floor(duration / 60)}h {duration % 60}m</span></span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Pause:</span>
                                    <input type="number" value={shift.pause} onChange={e => setShift(s => ({ ...s, pause: e.target.value }))} className="w-16 bg-dark border border-gray-700 rounded p-1 text-center text-white" />
                                    <span className="text-gray-500">min</span>
                                </div>
                            </div>
                        </div>


                        {/* 2. Zählerstände (Table Layout) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><Zap size={16} /> Zählerstände</h3>
                            <div className="overflow-hidden rounded-lg border border-gray-700">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2">Zähler</th>
                                            <th className="px-4 py-2">Start</th>
                                            <th className="px-4 py-2">Ende</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">Kilometerstand</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.km_start} onChange={e => setShift(s => ({ ...s, km_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.km_end} onChange={e => setShift(s => ({ ...s, km_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">EZ (Aufn.) 1.8</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy1_start} onChange={e => setShift(s => ({ ...s, energy1_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy1_end} onChange={e => setShift(s => ({ ...s, energy1_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                        <tr className="bg-dark">
                                            <td className="px-4 py-2 font-medium text-white">EZ (Rücksp.) 2.8</td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy2_start} onChange={e => setShift(s => ({ ...s, energy2_start: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input type="number" value={shift.energy2_end} onChange={e => setShift(s => ({ ...s, energy2_end: e.target.value }))} className="w-full bg-transparent border-none focus:ring-0 text-white p-1" placeholder="..." />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 1. Status Section (New Requirements) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><CheckSquare size={16} /> Status</h3>

                            <div className="space-y-2">
                                {[
                                    "Streckenkunde / EW / BR",
                                    "Ausfall vor DB",
                                    "Ausfall nach DB",
                                    "Normaldienst",
                                    "Bereitschaft",
                                    "Dienst verschoben"
                                ].map(option => (
                                    <label key={option} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                                        <input
                                            type="checkbox"
                                            checked={!!shift.flags[option]}
                                            onChange={(e) => setShift(s => ({ ...s, flags: { ...s.flags, [option]: e.target.checked } }))}
                                            className="w-4 h-4 rounded text-accent-blue bg-dark border-gray-600 focus:ring-accent-blue focus:ring-2"
                                        />
                                        <span className="text-gray-200 text-sm">{option}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Conditional Inputs */}
                            {shift.flags["Streckenkunde / EW / BR"] && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs text-gray-500 ml-1">Streckenkunde bei...</label>
                                    <input
                                        type="text"
                                        value={shift.flags.param_streckenkunde || ''}
                                        onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_streckenkunde: e.target.value } }))}
                                        placeholder="Name / Details..."
                                        className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-accent-blue transition"
                                    />
                                </div>
                            )}

                            {shift.flags["Dienst verschoben"] && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs text-gray-500 ml-1">Dienst verschoben um...</label>
                                    <input
                                        type="text"
                                        value={shift.flags.param_dienst_verschoben || ''}
                                        onChange={e => setShift(s => ({ ...s, flags: { ...s.flags, param_dienst_verschoben: e.target.value } }))}
                                        placeholder="Zeit / Details..."
                                        className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-accent-blue transition"
                                    />
                                </div>
                            )}

                        </div>
                    </div>

                    {/* RIGHT COLUMN: Segments */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* Smart Router */}
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

                        {/* List */}
                        <div className="space-y-3">
                            {segments.map((seg, i) => (
                                <div key={i} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-3 group relative hover:border-gray-700 transition">
                                    <button
                                        onClick={() => setSegments(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs font-mono border border-gray-700">#{i + 1}</div>
                                        <div className="flex items-center gap-2 text-lg font-bold font-mono text-white">
                                            <input value={seg.from_code} onChange={e => {
                                                const v = e.target.value.toUpperCase();
                                                setSegments(p => p.map((x, idx) => idx === i ? { ...x, from_code: v } : x));
                                            }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="VON" />
                                            <ArrowRight size={16} className="text-gray-500" />
                                            <input value={seg.to_code} onChange={e => {
                                                const v = e.target.value.toUpperCase();
                                                setSegments(p => p.map((x, idx) => idx === i ? { ...x, to_code: v } : x));
                                            }} className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none" placeholder="NACH" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">Zug-Nr.</label>
                                            <input placeholder="12345" value={seg.train_nr} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, train_nr: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">Tfz-Nr.</label>
                                            <input placeholder="185 123" value={seg.tfz} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, tfz: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">AB</label>
                                            <input type="time" value={seg.departure} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, departure: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase">AN</label>
                                            <input type="time" value={seg.arrival} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, arrival: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                        <div className="flex flex-col md:col-span-1">
                                            <label className="text-[10px] text-gray-500 uppercase">Bemerkung</label>
                                            <input placeholder="..." value={seg.notes} onChange={e => setSegments(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {segments.length === 0 && (
                                <div className="text-center py-10 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                                    Noch keine Fahrten eingetragen. Nutze die Smart Route oben für automatische Split-Ups!
                                </div>
                            )}
                        </div>

                        {/* 4. Sonstige Bemerkungen (Bottom) */}
                        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-2 mt-4">
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm">Sonstige Bemerkungen</h3>
                            <p className="text-xs text-gray-500">Sonstige Hinweise, Lokzustand, Störungen, Mängel an Fahrzeugen, Fehlende Fahrplanunterlagen, Dienstplanwünsche, etc.</p>
                            <textarea
                                value={shift.notes}
                                onChange={e => setShift(s => ({ ...s, notes: e.target.value }))}
                                className="w-full h-32 bg-dark border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:border-accent-blue outline-none resize-none"
                                placeholder="Hier tippen..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur border-t border-gray-800 p-4 md:pl-72 z-40 flex justify-end items-center gap-4">

                {/* TOAST NOTIFICATION */}
                {toast.visible && (
                    <div className={`fixed bottom-24 right-4 z-50 px-6 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-bold flex items-center gap-3
                        ${toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-gray-900/90 border-green-500 text-white'}
                    `}>
                        {toast.type === 'error' ? (
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                        {toast.message}
                    </div>
                )}


                {hasDraft && (
                    <span className="text-xs text-green-500 font-mono flex items-center gap-1 animate-pulse mr-auto md:mr-0">
                        <CheckSquare size={14} /> Draft saved locally
                    </span>
                )}
                <button
                    onClick={handleExport}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/30 transition"
                >
                    <FileDown size={20} /> Export Excel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-accent-blue text-white shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition"
                >
                    <Save size={20} />
                    {saving ? 'Saving...' : 'Save Report'}
                </button>
            </div>
        </div>
    );
};

export default LokLogEditor;
