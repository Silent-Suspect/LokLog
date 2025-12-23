import { useState, useEffect } from 'react';
import { Search, MapPin, Navigation } from 'lucide-react';

const Decoder = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStation, setSelectedStation] = useState(null);

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (query.length >= 2) {
                searchStations();
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const searchStations = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/stations?q=${query}`);
            const data = await res.json();
            setResults(data || []);
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d.toFixed(1);
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };

    const handleSelect = (station) => {
        setSelectedStation(station);
        setQuery(''); // Optional: Keep query or clear it? Clearing for next search.
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-accent-purple bg-opacity-10 rounded-xl">
                    <Search className="text-accent-purple" size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Decoder</h1>
                    <p className="text-gray-400">Station Search & Lookup</p>
                </div>
            </header>

            {/* Selected Station (Reference for Distance) */}
            {selectedStation && (
                <div className="bg-accent-purple bg-opacity-10 border border-accent-purple border-opacity-30 rounded-xl p-4 flex justify-between items-center animate-fade-in">
                    <div>
                        <span className="text-xs text-accent-purple uppercase font-bold tracking-wider">Reference Station</span>
                        <h3 className="text-xl font-bold text-white">{selectedStation.name}</h3>
                        <p className="text-sm text-gray-300 font-mono">{selectedStation.code}</p>
                    </div>
                    <button
                        onClick={() => setSelectedStation(null)}
                        className="text-xs text-gray-400 hover:text-white underline"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="sticky top-4 z-20">
                <div className="relative">
                    <Search className="absolute left-4 top-4 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search code (e.g. MHP) or name (e.g. München)..."
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-card border border-gray-800 text-white focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none shadow-xl transition text-lg placeholder-gray-600"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {loading && (
                        <div className="absolute right-4 top-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent-purple"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results List */}
            <div className="grid gap-3">
                {results.map((station) => {
                    const distance = selectedStation ? calculateDistance(selectedStation.lat, selectedStation.lng, station.lat, station.lng) : null;

                    return (
                        <div
                            key={station.code}
                            className="bg-card p-4 rounded-xl border border-gray-800 hover:border-accent-purple transition group cursor-pointer flex justify-between items-center"
                            onClick={() => handleSelect(station)}
                        >
                            <div>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-2xl font-bold text-accent-purple font-mono">{station.code}</span>
                                    <h3 className="text-lg font-semibold text-white">{station.name}</h3>
                                </div>
                                {station.short_name && station.short_name !== station.name && (
                                    <p className="text-sm text-gray-500 mt-1">{station.short_name}</p>
                                )}
                            </div>

                            <div className="text-right">
                                {distance && (
                                    <div className="flex items-center gap-1 text-accent-green mb-1 justify-end">
                                        <Navigation size={14} />
                                        <span className="font-bold">{distance} km</span>
                                    </div>
                                )}
                                {station.lat && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <MapPin size={12} />
                                        <span>{station.lat}, {station.lng}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {query.length >= 2 && results.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-500">
                        No stations found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Decoder;
