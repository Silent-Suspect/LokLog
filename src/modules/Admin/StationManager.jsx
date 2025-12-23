import { useState, useEffect, useCallback } from 'react';
import { Search, Save, CheckCircle, AlertCircle, MapPin } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

const StationManager = () => {
    const { getToken } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Track edits: { [stationCode]: { lat: '...', lng: '...' } }
    const [edits, setEdits] = useState({});

    // Track save status: { [stationCode]: 'success' | 'error' | null }
    const [saveStatus, setSaveStatus] = useState({});
    // Track global error (e.g. auth failed)
    const [globalError, setGlobalError] = useState(null);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch Data
    useEffect(() => {
        if (!debouncedTerm || debouncedTerm.length < 2) {
            setResults([]);
            return;
        }

        const fetchStations = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/stations?q=${encodeURIComponent(debouncedTerm)}`);
                const data = await res.json();
                setResults(data.results || []);
                // Clear old edits/status when searching new things to avoid confusion
                setEdits({});
                setSaveStatus({});
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStations();
    }, [debouncedTerm]);

    // Handle Input Change
    const handleInputChange = (code, field, value) => {
        setEdits(prev => ({
            ...prev,
            [code]: {
                ...prev[code],
                [field]: value
            }
        }));
        // Reset status on edit
        if (saveStatus[code]) {
            setSaveStatus(prev => {
                const next = { ...prev };
                delete next[code];
                return next;
            });
        }
    };

    // Save Changes
    const handleSave = async (station) => {
        const edit = edits[station.code];
        if (!edit) return;

        // Merge edited values with original values (if one field wasn't touched)
        // Note: station.lat/lng might be numeric or null, edit.lat/lng are strings from input
        const latToSend = edit.lat !== undefined ? edit.lat : station.lat;
        const lngToSend = edit.lng !== undefined ? edit.lng : station.lng;

        try {
            setSaveStatus(prev => ({ ...prev, [station.code]: 'saving' }));
            setGlobalError(null);

            const token = await getToken();

            const res = await fetch('/api/stations', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: station.code,
                    lat: latToSend,
                    lng: lngToSend
                })
            });

            if (res.ok) {
                const updatedData = await res.json();
                setSaveStatus(prev => ({ ...prev, [station.code]: 'success' }));

                // Update local result list to reflect saved values as "original"
                setResults(prev => prev.map(s =>
                    s.code === station.code ? { ...s, lat: latToSend, lng: lngToSend } : s
                ));

                // Clear edit state for this row as it matches now
                setEdits(prev => {
                    const next = { ...prev };
                    delete next[station.code];
                    return next;
                });

                // Clear success message after 3 seconds
                setTimeout(() => {
                    setSaveStatus(prev => {
                        const next = { ...prev };
                        delete next[station.code];
                        return next;
                    });
                }, 3000);

            } else {
                if (res.status === 401 || res.status === 403) {
                    setGlobalError("Permission Denied: You are not authorized to edit stations.");
                } else {
                    setGlobalError("Update Failed");
                }
                throw new Error('Save failed');
            }
        } catch (err) {
            console.error("Save error:", err);
            setSaveStatus(prev => ({ ...prev, [station.code]: 'error' }));
        }
    };

    return (
        <div className="bg-card border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <MapPin className="text-accent-blue" size={24} />
                <h2 className="text-xl font-bold text-white">Station GPS Editor</h2>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-500" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-accent-blue transition-all"
                    placeholder="Search station to edit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Global Error Banner */}
            {globalError && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-300 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" />
                    <span>{globalError}</span>
                </div>
            )}

            {/* Results */}
            <div className="space-y-2">
                {results.map(station => {
                    const edit = edits[station.code] || {};
                    const currentLat = edit.lat !== undefined ? edit.lat : (station.lat || '');
                    const currentLng = edit.lng !== undefined ? edit.lng : (station.lng || '');

                    // Simple check if dirty: simple string comparison handling null <-> empty string
                    const originalLat = station.lat === null ? '' : String(station.lat);
                    const originalLng = station.lng === null ? '' : String(station.lng);
                    const isDirty = String(currentLat) !== originalLat || String(currentLng) !== originalLng;

                    const status = saveStatus[station.code];

                    return (
                        <div key={station.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-gray-800/30 rounded-xl border border-gray-800/50 hover:border-gray-700 transition">

                            {/* Info */}
                            <div className="md:col-span-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-lg font-bold text-accent-blue">{station.code}</span>
                                    <span className="text-xs text-gray-500 border border-gray-700 px-1 rounded uppercase">{station.type}</span>
                                </div>
                                <div className="text-gray-300 truncate">{station.name}</div>
                            </div>

                            {/* Inputs */}
                            <div className="md:col-span-3">
                                <label className="block text-xs text-gray-500 mb-1 font-mono">Latitude</label>
                                <input
                                    type="text"
                                    className={`w-full bg-gray-900 border rounded px-2 py-1.5 text-sm text-white font-mono focus:border-accent-blue outline-none transition-colors ${!currentLat ? 'border-red-500/80 bg-red-950/20' : 'border-gray-700'
                                        }`}
                                    placeholder="e.g. 52.518"
                                    value={currentLat}
                                    onChange={(e) => handleInputChange(station.code, 'lat', e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs text-gray-500 mb-1 font-mono">Longitude</label>
                                <input
                                    type="text"
                                    className={`w-full bg-gray-900 border rounded px-2 py-1.5 text-sm text-white font-mono focus:border-accent-blue outline-none transition-colors ${!currentLng ? 'border-red-500/80 bg-red-950/20' : 'border-gray-700'
                                        }`}
                                    placeholder="e.g. 13.408"
                                    value={currentLng}
                                    onChange={(e) => handleInputChange(station.code, 'lng', e.target.value)}
                                />
                            </div>

                            {/* Actions */}
                            <div className="md:col-span-2 flex justify-end items-center">
                                {status === 'success' ? (
                                    <span className="flex items-center gap-1 text-green-500 text-sm font-medium animate-in fade-in slide-in-from-right-2">
                                        <CheckCircle size={16} /> Saved
                                    </span>
                                ) : status === 'error' ? (
                                    <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
                                        <AlertCircle size={16} /> Error
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleSave(station)}
                                        disabled={!isDirty || status === 'saving'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isDirty
                                            ? 'bg-accent-blue text-white hover:bg-blue-600 shadow-lg shadow-blue-900/20'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        <Save size={18} />
                                        {status === 'saving' ? '...' : 'Save'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {!loading && debouncedTerm.length > 1 && results.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No stations found.</div>
                )}
                {loading && (
                    <div className="text-center py-8 text-gray-500 animate-pulse">Loading...</div>
                )}
            </div>
        </div>
    );
};

export default StationManager;
