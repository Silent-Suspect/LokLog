import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper: Duration Logic (Duplicated slightly or imported? Let's keep it self-contained or pass it in)
const getDuration = (start, end) => {
    if (!start || !end) return { mins: 0, str: '0:00' };
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { mins: diff, str: `${h}:${m.toString().padStart(2, '0')}` };
};

const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const appendWorksheet = (sourceSheet, targetSheet, offsetRow) => {
    sourceSheet.eachRow({ includeEmpty: true }, (srcRow, rowNumber) => {
        const targetRowIdx = offsetRow + (rowNumber - 1);
        const targetRow = targetSheet.getRow(targetRowIdx);

        if (srcRow.height) targetRow.height = srcRow.height;

        const MAX_COL = 15; // A-O
        for (let col = 1; col <= MAX_COL; col++) {
            const srcCell = srcRow.getCell(col);
            const targetCell = targetRow.getCell(col);
            targetCell.value = srcCell.value;
            if (srcCell.style) {
                targetCell.style = JSON.parse(JSON.stringify(srcCell.style));
            }
            if (col === 15) {
                const existingBorder = targetCell.border || {};
                targetCell.border = { ...existingBorder, left: { style: 'medium' } };
            }
        }
        targetRow.commit();
    });

    if (sourceSheet.model && sourceSheet.model.merges) {
        sourceSheet.model.merges.forEach(range => {
            try {
                const matches = range.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
                if (matches) {
                    const [_, startCol, startRowStr, endCol, endRowStr] = matches;
                    const startRow = parseInt(startRowStr, 10);
                    const endRow = parseInt(endRowStr, 10);
                    const newStartRow = offsetRow + (startRow - 1);
                    const newEndRow = offsetRow + (endRow - 1);
                    const newRange = `${startCol}${newStartRow}:${endCol}${newEndRow}`;
                    targetSheet.mergeCells(newRange);

                    const srcMaster = sourceSheet.getCell(`${startCol}${startRow}`);
                    const tgtMaster = targetSheet.getCell(`${startCol}${newStartRow}`);
                    if (srcMaster.style) {
                        tgtMaster.style = JSON.parse(JSON.stringify(srcMaster.style));
                    }
                }
            } catch (e) { console.warn("Skipping merge:", range); }
        });
    }
};

const processExportData = (segmentsList) => {
    const processedSegments = [];
    const extraComments = [];
    let overflowCounter = 0;

    segmentsList.forEach(seg => {
        let note = seg.notes || '';
        if (note.length > 15) {
            overflowCounter++;
            const starMarker = '*'.repeat(overflowCounter) + ')';
            extraComments.push(`${starMarker} ${note}`);
            note = starMarker;
        }
        processedSegments.push({ ...seg, notes: note });
    });
    return { processedSegments, extraComments };
};

export const generateShiftExcel = async (data, user, templates, options = {}) => {
    const {
        shift,
        segments,
        guestRides,
        waitingTimes,
        duration, // in minutes
        date
    } = data;

    const { templateA, templateB } = templates; // base64 strings

    // 1. Load Template A
    const bufferA = base64ToArrayBuffer(templateA);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bufferA);
    const ws = workbook.getWorksheet(1);

    // 2. Header Data
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

    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    ws.getCell('N26').value = `${hours},${mins.toString().padStart(2, '0')}`;
    ws.getCell('N28').value = shift.pause ? `${shift.pause} min.` : '';

    // Counters
    const setNum = (cell, val) => {
        if (val !== '' && val !== null && val !== undefined) ws.getCell(cell).value = Number(val);
    };
    setNum('A13', shift.km_start);
    setNum('A28', shift.km_end);
    setNum('E13', shift.energy1_start);
    setNum('E28', shift.energy1_end);
    setNum('I13', shift.energy2_start);
    setNum('I28', shift.energy2_end);

    // Flags
    const flags = shift.flags || {};
    if (flags['Normaldienst']) ws.getCell('I7').value = 'X';
    if (flags['Bereitschaft']) ws.getCell('L7').value = 'X';
    if (flags['Streckenkunde / EW / BR']) ws.getCell('B7').value = 'X';
    if (flags['Ausfall vor DB']) ws.getCell('D7').value = 'X';
    if (flags['Ausfall nach DB']) ws.getCell('F7').value = 'X';
    if (flags['Streckenkunde / EW / BR']) ws.getCell('B8').value = flags.param_streckenkunde;
    if (flags['Dienst verschoben']) ws.getCell('F8').value = flags.param_dienst_verschoben;

    // 3. Resolve Station Names (Passed in via options to keep service pure? Or fetch here?)
    // The original code fetched /api/stations.
    // Ideally, the caller should provide the Resolved Map or we fetch it.
    // For simplicity, let's assume `options.stationMap` is passed, or we skip resolving if missing.
    const stationMap = options.stationMap || new Map();
    const getStationName = (code) => {
        if (!code) return '';
        return stationMap.get(code.toUpperCase()) || code;
    };

    const { processedSegments, extraComments } = processExportData(segments);
    const segmentRows = [15, 17, 19, 21, 23];
    processedSegments.slice(0, 5).forEach((seg, i) => {
        const r = segmentRows[i];
        ws.getCell(`A${r}`).value = seg.train_nr;
        ws.getCell(`C${r}`).value = seg.tfz;
        ws.getCell(`D${r}`).value = seg.departure;
        ws.getCell(`H${r}`).value = seg.arrival;
        ws.getCell(`E${r}`).value = getStationName(seg.from_code);
        ws.getCell(`I${r}`).value = getStationName(seg.to_code);
        ws.getCell(`L${r}`).value = seg.notes;
    });

    // 4. Comments
    const smartSplit = (text, limit = 80) => {
        if (!text) return [];
        const lines = [];
        const paragraphs = text.toString().split('\n');
        paragraphs.forEach(para => {
            const words = para.split(' ').filter(w => w.length > 0);
            if (words.length === 0) return;
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                if ((currentLine + ' ' + word).length <= limit) currentLine += ' ' + word;
                else { lines.push(currentLine); currentLine = word; }
            }
            if (currentLine) lines.push(currentLine);
        });
        return lines;
    };

    let allLines = [];
    extraComments.forEach(note => allLines.push(...smartSplit(note)));
    if (shift.notes) allLines.push(...smartSplit(shift.notes));

    const START_COMMENT_ROW = 30;
    let lastCommentRow = START_COMMENT_ROW - 1;
    const refCell = ws.getCell(`A${START_COMMENT_ROW}`);
    const baseStyle = JSON.parse(JSON.stringify(refCell.style));

    allLines.forEach((line, index) => {
        const currentRow = START_COMMENT_ROW + index;
        const cell = ws.getCell(`A${currentRow}`);
        cell.value = line;
        cell.style = baseStyle;
        cell.alignment = { ...baseStyle.alignment, wrapText: true, vertical: 'top' };
        try { ws.mergeCells(`A${currentRow}:N${currentRow}`); } catch (e) { }
        ws.getCell(currentRow, 15).border = { left: { style: 'medium' } };
        lastCommentRow = currentRow;
    });

    if (lastCommentRow < 32) lastCommentRow = 32;

    // 5. Template B (Footer)
    const bufferB = base64ToArrayBuffer(templateB);
    const wbB = new ExcelJS.Workbook();
    await wbB.xlsx.load(bufferB);
    const wsB = wbB.getWorksheet(1);

    const appendStartRow = lastCommentRow + 1;
    appendWorksheet(wsB, ws, appendStartRow);

    // 6. Fill Footer
    const MAX_SLOTS = 6;
    for (let i = 0; i < MAX_SLOTS; i++) {
        const currentRow = appendStartRow + 1 + i;
        // Guest Rides
        if (guestRides && guestRides[i]) {
            const r = guestRides[i];
            if (r.from && r.to && r.dep && r.arr) {
                const dur = getDuration(r.dep, r.arr);
                ws.getCell(`A${currentRow}`).value = `${r.from} - ${r.to} (${r.dep} - ${r.arr}) = ${dur.str} h`;
            }
        }
        // Waiting Times
        if (waitingTimes && waitingTimes[i]) {
            const w = waitingTimes[i];
            if (w.start && w.end) {
                ws.getCell(`I${currentRow}`).value = `${w.start} - ${w.end} ${w.loc || ''} (${w.reason || ''})`;
            }
        }
    }

    // 7. Cleanup & Formulas
    const finalContentRow = appendStartRow + (wsB.rowCount || 15);
    try { ws.spliceRows(finalContentRow + 2, 500); } catch (e) { }
    try { ws.spliceColumns(16, 20); } catch (e) { }

    const sumRowIdx = appendStartRow + 7;
    const rangeStart = appendStartRow + 1;
    const rangeEnd = appendStartRow + 6;
    const sumCell = ws.getCell(`H${sumRowIdx}`);
    sumCell.value = { formula: `SUM(H${rangeStart}:H${rangeEnd})` };
    sumCell.alignment = { horizontal: 'right' };

    return workbook.xlsx.writeBuffer();
};
