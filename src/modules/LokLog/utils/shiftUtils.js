
export const isDayEmpty = (data) => {
    if (!data) return true;
    const { shift, segments, guestRides, waitingTimes } = data;

    // Check Arrays
    if (segments && segments.length > 0) return false;
    if (guestRides && guestRides.length > 0) return false;
    if (waitingTimes && waitingTimes.length > 0) return false;

    // Check Shift Object
    if (shift) {
        // Text Fields
        if (shift.start_time) return false;
        if (shift.end_time) return false;
        if (shift.km_start) return false;
        if (shift.km_end) return false;

        if (shift.energy1_start) return false;
        if (shift.energy1_end) return false;
        if (shift.energy2_start) return false;
        if (shift.energy2_end) return false;

        if (shift.notes) return false;

        // Flags: Check if any key is true
        if (shift.flags) {
            const hasActiveFlag = Object.values(shift.flags).some(val => val === true);
            if (hasActiveFlag) return false;
        }

        // We explicitly IGNORE 'pause' as per requirements
    }

    return true;
};
