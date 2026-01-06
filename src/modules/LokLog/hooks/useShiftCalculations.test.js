import { describe, it, expect } from 'vitest';
import { calculateDuration, calculateSuggestedPause, getMinutes } from './useShiftCalculations';

describe('Shift Calculations', () => {

    it('parses time strings to minutes', () => {
        expect(getMinutes('01:00')).toBe(60);
        expect(getMinutes('00:00')).toBe(0);
        expect(getMinutes('12:30')).toBe(750);
    });

    it('calculates duration within same day', () => {
        expect(calculateDuration('08:00', '16:00')).toBe(480); // 8 hours
        expect(calculateDuration('08:00', '08:30')).toBe(30);
    });

    it('calculates duration crossing midnight', () => {
        expect(calculateDuration('23:00', '01:00')).toBe(120); // 2 hours
        expect(calculateDuration('22:00', '06:00')).toBe(480); // 8 hours
    });

    it('suggests correct pause', () => {
        expect(calculateSuggestedPause(100)).toBe(0);
        expect(calculateSuggestedPause(361)).toBe(30); // > 6h
        expect(calculateSuggestedPause(541)).toBe(45); // > 9h
    });
});
