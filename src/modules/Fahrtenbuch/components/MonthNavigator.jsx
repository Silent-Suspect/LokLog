import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

const MonthNavigator = ({ currentDate, onChange }) => {

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        onChange(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        onChange(newDate);
    };

    const handleMonthChange = (e) => {
        const [y, m] = e.target.value.split('-');
        const newDate = new Date(parseInt(y), parseInt(m) - 1, 1);
        onChange(newDate);
    };

    // Format for input value: YYYY-MM
    const inputValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Format for display: "Januar 2024"
    const displayValue = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    return (
        <div className="flex items-center gap-1 bg-dark p-1 rounded-lg border border-gray-700 relative">
            <button
                onClick={handlePrev}
                className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"
            >
                <ChevronsLeft size={18} />
            </button>

            <div className="relative px-2 border-x border-gray-700/50 min-w-[140px] text-center group">
                {/* Visual Label */}
                <span className="text-white font-bold text-sm pointer-events-none">
                    {displayValue}
                </span>

                {/* Hidden Input Overlay for functionality */}
                <input
                    type="month"
                    value={inputValue}
                    onChange={handleMonthChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
            </div>

            <button
                onClick={handleNext}
                className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition"
            >
                <ChevronsRight size={18} />
            </button>
        </div>
    );
};

export default MonthNavigator;
