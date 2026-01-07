import { Clock } from 'lucide-react';

const ShiftTimesInput = ({ shift, setShift, durationString }) => {
    const handleChange = (field, value) => {
        setShift(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Clock size={16} /> Dienstzeiten
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500">Beginn</label>
                    <input
                        type="time"
                        value={shift.start_time}
                        onChange={e => handleChange('start_time', e.target.value)}
                        className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Ende</label>
                    <input
                        type="time"
                        value={shift.end_time}
                        onChange={e => handleChange('end_time', e.target.value)}
                        className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    />
                </div>
            </div>
            <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-gray-400">
                    Dauer: <span className="text-accent-blue font-bold">{durationString}</span>
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">Pause:</span>
                    <input
                        type="number"
                        value={shift.pause}
                        onChange={e => handleChange('pause', e.target.value)}
                        className="w-16 bg-dark border border-gray-700 rounded p-1 text-center text-white"
                    />
                    <span className="text-gray-500">min</span>
                </div>
            </div>
        </div>
    );
};

export default ShiftTimesInput;
