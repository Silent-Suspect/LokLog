import { useState, useEffect } from 'react';
import { Search, MapPin, AlertCircle } from 'lucide-react';

const Decoder = () => {
    // Tab State: 'search' or 'route'
    const [activeTab, setActiveTab] = useState('route');

    const [inputValue, setInputValue] = useState('');
    const [debouncedInput, setDebouncedInput] = useState('');

    const [searchResults, setSearchResults] = useState([]);
    const [routeData, setRouteData] = useState([]);
    const [totalDistance, setTotalDistance] = useState(0);

    const [loading, setLoading] = useState(false);

    // Reset data when tab changes
    useEffect(() => {
        setInputValue('');
        setDebouncedInput('');
        setSearchResults([]);
        setRouteData([]);
        setTotalDistance(0);
    }, [activeTab]);

    // Debounce Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedInput(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // Data Fetching & Logic
    useEffect(() => {
        if (!debouncedInput || debouncedInput.length < 2) {
            setSearchResults([]);
            setRouteData([]);
            setTotalDistance(0);
            return;
        }

        const fetchDecoder = async () => {
            setLoading(true);

            if (activeTab === 'search') {
                // --- SEARCH MODE ---
                try {
                    const response = await fetch(`/api/stations?q=${encodeURIComponent(debouncedInput)}`);
                    const data = await response.json();
                    setSearchResults(data.results || []);
                } catch (error) {
                    console.error("Search fetch error:", error);
                    setSearchResults([]);
                }
            } else {
                // --- ROUTE MODE ---
                // Smart Split Logic
                const rawTokens = debouncedInput
                    .replace(/[,+-]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .split(' ')
                    .filter(t => t.length > 0);

                const tokens = [];
                for (let i = 0; i < rawTokens.length; i++) {
                    const current = rawTokens[i];
                    const next = rawTokens[i + 1];
                    if (next && next.length === 1) {
                        tokens.push(`${current} ${next}`);
                        i++;
                    } else {
                        tokens.push(current);
                    }
                }

                if (tokens.length > 0) {
                    try {
                        const uniqueCodes = [...new Set(tokens)];
                        const queryParams = new URLSearchParams({ codes: uniqueCodes.join(',') });

                        const response = await fetch(`/api/stations?${queryParams}`);
                        const dbResults = await response.json();

                        let accumulatedDistance = 0;
                        const calculatedRoute = tokens.map((token, index) => {
                            const match = (dbResults.results || []).find(r =>
                                r.code.toLowerCase() === token.toLowerCase() ||
                                r.name.toLowerCase() === token.toLowerCase()
                            );

                            if (!match) {
                                return {
                                    type: 'unknown',
                                    code: token,
                                    name: 'Unknown Station',
                                    valid: false
                                };
                            }

                            let legDist = 0;
                            if (index > 0) {
                                const prev = (dbResults.results || []).find(r => r.code.toLowerCase() === tokens[index - 1].toLowerCase());
                                if (prev && prev.lat && match.lat) {
                                    legDist = calculateDistance(prev.lat, prev.lng, match.lat, match.lng);
                                    accumulatedDistance += parseFloat(legDist);
                                }
                            }

                            return {
                                ...match,
                                valid: true,
                                legDistance: index > 0 ? legDist : null
                            };
                        });

                        setRouteData(calculatedRoute);
                        setTotalDistance(accumulatedDistance.toFixed(1));
                    } catch (error) {
                        console.error("Route fetch error:", error);
                    }
                }
            }
            setLoading(false);
        };

        fetchDecoder();
    }, [debouncedInput, activeTab]);

    // Haversine Distance Helper
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371; // km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Decoder
                </h1>
                <p className="text-gray-400 mt-1">
                    Decode station codes or plan routes.
                </p>
            </div>

            {/* Tabs & Input Section */}
            <div className="sticky top-4 z-20 space-y-2">
                {/* Tabs */}
                <div className="flex p-1 bg-dark/90 backdrop-blur border border-gray-800 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('route')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'route'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <MapPin size={16} /> Route Decoder
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'search'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Search size={16} /> Station Search
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative group shadow-2xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {activeTab === 'search' ? (
                            <Search className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                        ) : (
                            <MapPin className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                        )}
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-4 border border-gray-700 rounded-xl leading-5 bg-card text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-lg font-mono shadow-lg"
                        placeholder={activeTab === 'search' ? "Search station name (e.g. Frankfurt)..." : "Enter codes (e.g. AA FF NWH)..."}
                        value={inputValue}
                        onChange={(e) => {
                            if (activeTab === 'route') {
                                setInputValue(e.target.value.toUpperCase());
                            } else {
                                setInputValue(e.target.value);
                            }
                        }}
                        autoFocus
                    />
                    {loading && (
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Area */}
            <div className="min-h-[300px]">
                {/* MODE: SEARCH */}
                {activeTab === 'search' && (
                    <div className="grid grid-cols-1 gap-3">
                        {searchResults.map((station) => (
                            <div key={station.id} className="p-4 bg-card rounded-xl border border-gray-800 hover:border-gray-700 transition flex justify-between items-center group">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-mono text-xl font-bold text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded">
                                            {station.code}
                                        </span>
                                        <span className="text-xs text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded uppercase">
                                            {station.type || 'Bf'}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-200">{station.name}</h3>
                                </div>
                                <div className="text-right text-sm text-gray-500">
                                    <div className="font-mono">{station.lat}, {station.lng}</div>
                                </div>
                            </div>
                        ))}
                        {!loading && debouncedInput.length > 1 && searchResults.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No stations found for "{debouncedInput}"
                            </div>
                        )}
                        {!loading && debouncedInput.length <= 1 && (
                            <div className="text-center py-12 text-gray-600">
                                Start typing to search...
                            </div>
                        )}
                    </div>
                )}

                {/* MODE: ROUTE */}
                {activeTab === 'route' && (
                    <div className="space-y-4">
                        {routeData.length > 0 ? (
                            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                                <div className="p-6 bg-gray-900/50 border-b border-gray-800 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                                        <MapPin className="text-purple-500" size={20} />
                                        Route Preview
                                    </h2>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-500">Total Distance</div>
                                        <div className="text-2xl font-bold text-green-400 font-mono">
                                            {totalDistance} <span className="text-sm text-gray-500">km</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 relative">
                                    <div className="absolute left-12 top-10 bottom-10 w-0.5 bg-gray-800"></div>

                                    <div className="space-y-0">
                                        {routeData.map((stop, index) => (
                                            <div key={index} className="relative pl-16 pb-8 last:pb-0 group">
                                                <div className={`absolute left-[42px] mt-1.5 w-3 h-3 rounded-full border-2 z-10 
                                                    ${stop.valid ? 'bg-purple-500 border-gray-900 group-hover:scale-125 transition' : 'bg-red-500 border-gray-900'}`
                                                }></div>

                                                {stop.legDistance > 0 && (
                                                    <div className="absolute -top-4 left-20">
                                                        <span className="text-xs font-mono font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full border border-green-900/50">
                                                            + {stop.legDistance} km
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={`p-4 rounded-xl border transition-all ${stop.valid
                                                    ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                                    : 'bg-red-900/10 border-red-900/30'
                                                    }`}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`font-mono text-xl font-bold ${stop.valid ? 'text-white' : 'text-red-400'}`}>
                                                                    {stop.code}
                                                                </span>
                                                                {!stop.valid && (
                                                                    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-900/50">
                                                                        <AlertCircle size={10} /> Not Found
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-gray-300 mt-1">{stop.name}</div>
                                                        </div>
                                                        {stop.valid && (
                                                            <div className="text-xs text-gray-600 font-mono mt-1 text-right">
                                                                {stop.short_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-600 border border-gray-800 border-dashed rounded-xl">
                                {debouncedInput.length > 0 ? "Parsing route..." : "Enter station codes to build a route..."}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Decoder;
