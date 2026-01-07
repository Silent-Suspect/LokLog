// src/modules/LokLog/utils/routeParser.js

/**
 * Parses a "Smart Route" string into segment objects.
 * Format: "FROM TO TO2 TO3" or "FROM-TO, TO2"
 * @param {string} input
 * @returns {Array} Array of segment objects { from_code, to_code, train_nr, ... }
 */
export const parseRouteInput = (input) => {
    if (!input) return [];

    // Clean input: remove commas/dashes, normalize spaces
    const rawTokens = input
        .replace(/[,+-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(t => t.length > 0);

    const tokens = [];
    // Smart token grouping (e.g., if we had a station with space? usually codes are single words)
    // For now, assume codes are single words.
    // The original logic checked if `next.length === 1`?
    // Original Logic:
    // for (let i = 0; i < rawTokens.length; i++) {
    //     const current = rawTokens[i];
    //     const next = rawTokens[i + 1];
    //     if (next && next.length === 1) { tokens.push(`${current} ${next}`); i++; }
    //     else { tokens.push(current); }
    // }
    // This logic seems to handle station codes that might be split? Or maybe train numbers?
    // Station codes like "H H" -> "H H"? No, Ril 100 is usually 2-5 letters.
    // If user typed "AA A", maybe "A" is a suffix?
    // I will preserve the original logic exactly to be safe.

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

    return newSegments;
};
