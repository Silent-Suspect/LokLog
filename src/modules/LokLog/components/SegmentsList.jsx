import { Trash2, ArrowRight, TrainTrack, Plus } from 'lucide-react';

const SegmentsList = ({ segments, setSegments }) => {

    // DEFENSIVE CODING: Ensure segments is always an array
    const safeSegments = Array.isArray(segments) ? segments : [];

    const addSegment = () => {
        setSegments(prev => {
            const list = Array.isArray(prev) ? prev : [];
            return [...list, { from_code: '', to_code: '', train_nr: '', tfz: '', departure: '', arrival: '', notes: '' }];
        });
    };

    const updateSegment = (index, field, value) => {
        setSegments(prev => {
            const list = Array.isArray(prev) ? prev : [];
            return list.map((item, i) => i === index ? { ...item, [field]: value } : item);
        });
    };

    const removeSegment = (index) => {
        setSegments(prev => {
            const list = Array.isArray(prev) ? prev : [];
            return list.filter((_, i) => i !== index);
        });
    };

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <TrainTrack size={16} /> Fahrdienste
                </h3>
                <button
                    onClick={addSegment}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                    <Plus size={12} /> Add
                </button>
            </div>

            <div className="space-y-3">
                {safeSegments.map((seg, i) => (
                    <div key={i} className="bg-dark/50 p-4 rounded-xl border border-gray-700/50 flex flex-col gap-3 group relative hover:border-gray-600 transition">
                        <button
                            onClick={() => removeSegment(i)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                            title="Remove Segment"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs font-mono border border-gray-700">
                                #{i + 1}
                            </div>
                            <div className="flex items-center gap-2 text-lg font-bold font-mono text-white">
                                <input
                                    name={`segment_from_${i}`}
                                    value={seg.from_code}
                                    onChange={e => updateSegment(i, 'from_code', e.target.value.toUpperCase())}
                                    className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none"
                                    placeholder="VON"
                                />
                                <ArrowRight size={16} className="text-gray-500" />
                                <input
                                    name={`segment_to_${i}`}
                                    value={seg.to_code}
                                    onChange={e => updateSegment(i, 'to_code', e.target.value.toUpperCase())}
                                    className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none"
                                    placeholder="NACH"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <input
                                name={`segment_train_nr_${i}`}
                                placeholder="Zug-Nr."
                                value={seg.train_nr}
                                onChange={e => updateSegment(i, 'train_nr', e.target.value)}
                                className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                            />
                            <input
                                name={`segment_tfz_${i}`}
                                placeholder="Tfz-Nr."
                                value={seg.tfz}
                                onChange={e => updateSegment(i, 'tfz', e.target.value)}
                                className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                            />
                            <input
                                name={`segment_departure_${i}`}
                                type="time"
                                value={seg.departure}
                                onChange={e => updateSegment(i, 'departure', e.target.value)}
                                className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                            />
                            <input
                                name={`segment_arrival_${i}`}
                                type="time"
                                value={seg.arrival}
                                onChange={e => updateSegment(i, 'arrival', e.target.value)}
                                className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                            />
                            <input
                                name={`segment_notes_${i}`}
                                placeholder="Bemerkung"
                                value={seg.notes}
                                onChange={e => updateSegment(i, 'notes', e.target.value)}
                                className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SegmentsList;
