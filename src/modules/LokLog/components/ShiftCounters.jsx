import { Zap } from 'lucide-react';

const ShiftCounters = ({ shift, setShift }) => {
    const handleChange = (field, value) => {
        setShift(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Zap size={16} /> Zählerstände
            </h3>
            <div className="overflow-hidden rounded-lg border border-gray-700">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                        <tr>
                            <th className="px-4 py-2">Zähler</th>
                            <th className="px-4 py-2">Start</th>
                            <th className="px-4 py-2">Ende</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        <tr className="bg-dark">
                            <td className="px-4 py-2 font-medium text-white">Km</td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.km_start} onChange={e => handleChange('km_start', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.km_end} onChange={e => handleChange('km_end', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                        </tr>
                        <tr className="bg-dark">
                            <td className="px-4 py-2 font-medium text-white">EZ 1.8</td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.energy1_start} onChange={e => handleChange('energy1_start', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.energy1_end} onChange={e => handleChange('energy1_end', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                        </tr>
                        <tr className="bg-dark">
                            <td className="px-4 py-2 font-medium text-white">EZ 2.8</td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.energy2_start} onChange={e => handleChange('energy2_start', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                            <td className="px-2 py-1">
                                <input type="number" value={shift.energy2_end} onChange={e => handleChange('energy2_end', e.target.value)} className="w-full bg-transparent border-none text-white p-1" placeholder="..." />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShiftCounters;
