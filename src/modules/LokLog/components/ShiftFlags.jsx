import { CheckSquare } from 'lucide-react';

const ShiftFlags = ({ flags, setFlags }) => {

    const toggleFlag = (option, checked) => {
        setFlags(prev => ({ ...prev, [option]: checked }));
    };

    const updateParam = (key, value) => {
        setFlags(prev => ({ ...prev, [key]: value }));
    };

    const options = [
        "Streckenkunde / EW / BR",
        "Ausfall vor DB",
        "Ausfall nach DB",
        "Normaldienst",
        "Bereitschaft",
        "Dienst verschoben"
    ];

    return (
        <div className="bg-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2">
                <CheckSquare size={16} /> Status
            </h3>
            <div className="space-y-2">
                {options.map(option => (
                    <label key={option} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                        <input
                            type="checkbox"
                            checked={!!flags[option]}
                            onChange={(e) => toggleFlag(option, e.target.checked)}
                            className="w-4 h-4 rounded text-accent-blue bg-dark border-gray-600 focus:ring-accent-blue"
                        />
                        <span className="text-gray-200 text-sm">{option}</span>
                    </label>
                ))}
            </div>
            {flags["Streckenkunde / EW / BR"] && (
                <input
                    type="text"
                    value={flags.param_streckenkunde || ''}
                    onChange={e => updateParam('param_streckenkunde', e.target.value)}
                    placeholder="Details Streckenkunde..."
                    className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm"
                />
            )}
            {flags["Dienst verschoben"] && (
                <input
                    type="text"
                    value={flags.param_dienst_verschoben || ''}
                    onChange={e => updateParam('param_dienst_verschoben', e.target.value)}
                    placeholder="Zeit / Details..."
                    className="w-full mt-1 bg-dark border border-gray-700 rounded p-2 text-white text-sm"
                />
            )}
        </div>
    );
};

export default ShiftFlags;
