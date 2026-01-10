import { TrainFront, Plus, Trash2 } from 'lucide-react';
import { calculateDuration } from '../hooks/useShiftCalculations';

const GuestRidesList = ({ guestRides, setGuestRides }) => {

    const addRide = () => {
        setGuestRides(prev => [...prev, { from: '', to: '', dep: '', arr: '' }]);
    };

    const updateRide = (index, field, value) => {
        setGuestRides(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const removeRide = (index) => {
        setGuestRides(prev => prev.filter((_, i) => i !== index));
    };

    const getPreviewString = (ride) => {
        if (!ride.from || !ride.to || !ride.dep || !ride.arr) return null;

        const diffMins = calculateDuration(ride.dep, ride.arr);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const durationStr = `${hours}:${mins.toString().padStart(2, '0')}`;

        return `${ride.from} - ${ride.to} (${ride.dep} - ${ride.arr}) = ${durationStr} h`;
    };

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <TrainFront size={16} /> Gastfahrten
                </h3>
                <button
                    onClick={addRide}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                    <Plus size={12} /> Add
                </button>
            </div>
            {guestRides.map((ride, i) => (
                <div key={i} className="bg-dark/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input
                            placeholder="VON"
                            value={ride.from}
                            onChange={e => updateRide(i, 'from', e.target.value.toUpperCase())}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            placeholder="NACH"
                            value={ride.to}
                            onChange={e => updateRide(i, 'to', e.target.value.toUpperCase())}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            type="time"
                            value={ride.dep}
                            onChange={e => updateRide(i, 'dep', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            type="time"
                            value={ride.arr}
                            onChange={e => updateRide(i, 'arr', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="text-xs text-accent-blue font-mono min-h-[1.2em]">
                            {getPreviewString(ride)}
                        </div>
                        <button
                            onClick={() => removeRide(i)}
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

export default GuestRidesList;
