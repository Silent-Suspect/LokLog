import { Clock, Plus, Trash2 } from 'lucide-react';

const WaitingTimesList = ({ waitingTimes, setWaitingTimes }) => {

    const addWait = () => {
        setWaitingTimes(prev => [...prev, { start: '', end: '', loc: '', reason: '' }]);
    };

    const updateWait = (index, field, value) => {
        setWaitingTimes(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const removeWait = (index) => {
        setWaitingTimes(prev => prev.filter((_, i) => i !== index));
    };

    const getPreviewString = (wait) => {
        if (!wait.start || !wait.end) return null;

        // Format: 10:00 - 10:30 EDO (Kaffee trinken)
        // Ensure optional fields are handled cleanly
        const locStr = wait.loc ? ` ${wait.loc}` : '';
        const reasonStr = wait.reason ? ` (${wait.reason})` : '';

        return `${wait.start} - ${wait.end}${locStr}${reasonStr}`;
    };

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Clock size={16} /> Wartezeiten
                </h3>
                <button
                    onClick={addWait}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                    <Plus size={12} /> Add
                </button>
            </div>
            {waitingTimes.map((wait, i) => (
                <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="flex gap-2">
                            <input
                                type="time"
                                value={wait.start}
                                onChange={e => updateWait(i, 'start', e.target.value)}
                                className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white"
                            />
                            <input
                                type="time"
                                value={wait.end}
                                onChange={e => updateWait(i, 'end', e.target.value)}
                                className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            <input
                                placeholder="Ort (z.B. Fulda)"
                                value={wait.loc}
                                onChange={e => updateWait(i, 'loc', e.target.value)}
                                className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white"
                            />
                            <input
                                placeholder="Grund"
                                value={wait.reason}
                                onChange={e => updateWait(i, 'reason', e.target.value)}
                                className="w-1/2 bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="text-xs text-accent-blue font-mono min-h-[1.2em]">
                            {getPreviewString(wait)}
                        </div>
                        <button
                            onClick={() => removeWait(i)}
                            className="text-red-400 hover:text-red-300"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WaitingTimesList;
