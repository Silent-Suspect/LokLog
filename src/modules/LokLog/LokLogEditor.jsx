import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Save, FileDown, Plus, Trash2, TrainFront, Clock, Zap, CheckSquare, Calendar, ArrowRight } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const LokLogEditor = () => {
    const { getToken } = useAuth();
    const { user } = useUser();

    // State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
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
    }, [date]);

    const loadShift = async (selectedDate) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`/api/shifts?date=${selectedDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.shift) {
                setShift({
                    ...data.shift,
                    // Map DB cols to State props
                    energy1_start: data.shift.energy_18_start,
                    energy1_end: data.shift.energy_18_end,
                    energy2_start: data.shift.energy_28_start,
                    energy2_end: data.shift.energy_28_end,
                    notes: data.shift.comments,
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
            } else {
                // Reset to defaults if no entry exists
                setShift({
                    id: null,
                    start_time: '', end_time: '', pause: 0,
                    km_start: '', km_end: '',
                    energy1_start: '', energy1_end: '',
                    energy2_start: '', energy2_end: '',
                    km_start: '', km_end: '',
                    energy1_start: '', energy1_end: '',
                    energy2_start: '', energy2_end: '',
                    flags: {},
                    notes: ''
                });
                setSegments([]);
            }
        } catch (err) {
            console.error("Load failed", err);
        } finally {
            setLoading(false);
        }
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
                        // Map Props to DB Cols
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
            setShift(s => ({ ...s, id: data.id })); // Update ID if new
            alert('✅ Saved!');
        } catch (err) {
            console.error(err);
            alert('❌ Save failed');
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
            if (!res.ok) throw new Error('Template load failed');
            const buffer = await res.arrayBuffer();

            // 2. Fill Data
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const ws = workbook.getWorksheet(1);

            // Header
            ws.getCell('H4').value = new Date(date).toLocaleDateString('de-DE');
            ws.getCell('E11').value = shift.start_time;
            ws.getCell('E26').value = shift.end_time;

            // Duration
            const hours = Math.floor(duration / 60);
            const mins = duration % 60;
            ws.getCell('N26').value = `${hours}:${mins.toString().padStart(2, '0')}`;
            ws.getCell('N28').value = shift.pause;

            // Counters
            ws.getCell('A13').value = Number(shift.km_start);
            ws.getCell('A28').value = Number(shift.km_end);
            ws.getCell('E13').value = Number(shift.energy1_start);
            ws.getCell('E28').value = Number(shift.energy1_end);
            ws.getCell('I13').value = Number(shift.energy2_start);
            ws.getCell('I28').value = Number(shift.energy2_end);

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
            if (shift.flags.param_streckenkunde) {
                ws.getCell('B8').value = shift.flags.param_streckenkunde;
            }
            if (shift.flags.param_dienst_verschoben) {
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
                ws.getCell(`E${r}`).value = seg.arrival;
                ws.getCell(`H${r}`).value = seg.from_code;
                ws.getCell(`I${r}`).value = seg.to_code;
                ws.getCell(`L${r}`).value = seg.notes;
            });

            // Footnotes & General Comments (Start at A30)
            let currentRow = 30;

            // Helper: Robust Word-Based Split (Limit 125)
            const smartSplit = (text, limit = 125) => {
                if (!text) return [];
                const lines = [];
                // Preserve manual paragraphs
                const paragraphs = text.toString().split('\n');

                paragraphs.forEach(para => {
                    if (para.length <= limit) {
                        lines.push(para);
                        return;
                    }
                    // FIX: Filter out empty strings to prevent "ghost" words
                    const words = para.split(' ').filter(w => w.length > 0);

                    if (words.length === 0) return; // Skip empty lines

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

            // Build Queue with Wrapping
            let notesQueue = [];
            // Rely on default limit 125
            extraComments.forEach(note => notesQueue.push(...smartSplit(note)));
            if (shift.notes) notesQueue.push(...smartSplit(shift.notes));

            // Capture Template Styles from Row 32 (Master Template)
            const templateRow = ws.getRow(32);
            const templateHeight = templateRow.height;
            const templateStyles = [];
            const templateMerges = [];
            let lastColIndex = 0;

            // Capture Cell Styles
            templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                templateStyles[colNumber] = JSON.parse(JSON.stringify(cell.style));
                if (colNumber > lastColIndex) lastColIndex = colNumber;
            });

            // Capture Merges in Row 32
            for (let c = 1; c <= 26; c++) {
                const cell = templateRow.getCell(c);
                if (cell.isMerged && cell.master.address === cell.address) {
                    let endCol = c;
                    for (let next = c + 1; next <= 30; next++) {
                        const nextCell = templateRow.getCell(next);
                        if (nextCell.isMerged && nextCell.master.address === cell.address) {
                            endCol = next;
                        } else {
                            break;
                        }
                    }
                    if (endCol > c) {
                        templateMerges.push({ start: c, end: endCol });
                    }
                }
                notesQueue.forEach(note => {
                    // Critical: Check for overflow at Row 35
                    if (currentRow >= 35) {
                        // 1. Use spliceRows (Cleaner insertion that shifts metadata correctly)
                        // Insert 1 empty row at currentRow
                        ws.spliceRows(currentRow, 0, []);
                        const newRow = ws.getRow(currentRow);

                        // 2. Clone Row Height from Template (Row 32)
                        newRow.height = templateHeight;

                        // 3. Clone Cell Styles from Template (Row 32)
                        // We iterate columns 1 to 14 specifically to cover the table width
                        templateStyles.forEach((style, colIdx) => {
                            if (style && colIdx <= 14) {
                                const cell = newRow.getCell(colIdx);
                                cell.style = style;
                            }
                        });

                        // 4. FIX: "Clean Slate" Merge Strategy
                        // Explicitly unmerge the target range using string address to be safe
                        try {
                            ws.unmergeCells(`A${currentRow}:N${currentRow}`);
                        } catch (e) {
                            // Ignore
                        }

                        // 5. Force Merge (A to N) using string address
                        try {
                            ws.mergeCells(`A${currentRow}:N${currentRow}`);
                        } catch (e) {
                            console.error(`Merge failed at row ${currentRow}:`, e);
                        }

                        // 6. Force Alignment on Master Cell
                        const masterCell = newRow.getCell(1);
                        masterCell.alignment = {
                            vertical: 'top',
                            horizontal: 'left',
                            wrapText: true
                        };

                        // 7. Force Right Border on Last Cell (Column N / 14)
                        const lastCell = newRow.getCell(14);
                        lastCell.border = {
                            top: lastCell.border?.top,
                            bottom: lastCell.border?.bottom,
                            left: lastCell.border?.left,
                            right: { style: 'medium', color: { argb: 'FF000000' } }
                        };
                    }

                    // Write Content
                    ws.getCell(`A${currentRow}`).value = note;
                    ws.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

                    currentRow++;
                });

                // 3. Download
                const out = await workbook.xlsx.writeBuffer();
                const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, `Schichtbericht_${date}.xlsx`);

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
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <TrainFront className="text-accent-blue" />
                            Fahrtenbuch
                        </h1>
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
                                    onChange={e => setRouteInput(e.target.value)}
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
                <div className="fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur border-t border-gray-800 p-4 md:pl-72 z-40 flex justify-end gap-4">
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
