import { Trash2, ArrowRight } from 'lucide-react';

const SegmentsList = ({ segments, setSegments }) => {

    const safeSegments = Array.isArray(segments) ? segments : [];

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

    if (safeSegments.length === 0 && segments && !Array.isArray(segments)) {
        return <div className="text-red-500 p-4 border border-red-500 rounded">Error: Invalid Segments Data</div>;
    }

    return (
        <div className="space-y-3">
            {safeSegments.map((seg, i) => (
                <div key={i} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-3 group relative hover:border-gray-700 transition">
                    <button
                        onClick={() => removeSegment(i)}
                        className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                        <Trash2 size={16} />
                    </button>

                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs font-mono border border-gray-700">
                            #{i + 1}
                        </div>
                        <div className="flex items-center gap-2 text-lg font-bold font-mono text-white">
                            <input
                                value={seg.from_code}
                                onChange={e => updateSegment(i, 'from_code', e.target.value.toUpperCase())}
                                className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none"
                                placeholder="VON"
                            />
                            <ArrowRight size={16} className="text-gray-500" />
                            <input
                                value={seg.to_code}
                                onChange={e => updateSegment(i, 'to_code', e.target.value.toUpperCase())}
                                className="bg-transparent w-16 text-center border-b border-transparent focus:border-accent-blue outline-none"
                                placeholder="NACH"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <input
                            placeholder="Zug-Nr."
                            value={seg.train_nr}
                            onChange={e => updateSegment(i, 'train_nr', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            placeholder="Tfz"
                            value={seg.tfz}
                            onChange={e => updateSegment(i, 'tfz', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            type="time"
                            value={seg.departure}
                            onChange={e => updateSegment(i, 'departure', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            type="time"
                            value={seg.arrival}
                            onChange={e => updateSegment(i, 'arrival', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                        <input
                            placeholder="Bemerkung"
                            value={seg.notes}
                            onChange={e => updateSegment(i, 'notes', e.target.value)}
                            className="bg-dark border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-accent-blue outline-none"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SegmentsList;
