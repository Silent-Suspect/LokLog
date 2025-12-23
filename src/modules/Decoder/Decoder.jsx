import { useState, useEffect } from 'react';
import { Search, MapPin, AlertCircle } from 'lucide-react';

const Decoder = () => {
    const [inputValue, setInputValue] = useState('');
    const [debouncedInput, setDebouncedInput] = useState('');

    // Modes: 'search' (single word) or 'route' (multiple words)
    const [mode, setMode] = useState('search');

    const [searchResults, setSearchResults] = useState([]);
    const [routeData, setRouteData] = useState([]);
    const [totalDistance, setTotalDistance] = useState(0);

    const [loading, setLoading] = useState(false);

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

            // 1. Parsing: Smart Split
            // Handles "AA AABG" -> ["AA", "AABG"] and "AAH A" -> ["AAH A"] (Merge single letter suffix)
            const rawTokens = debouncedInput
                .replace(/[,+-]/g, ' ')      // Replace separators with space
                .replace(/\s+/g, ' ')        // Collapse multiple spaces
                .trim()
                .split(' ')
                .filter(t => t.length > 0);

            const tokens = [];
            for (let i = 0; i < rawTokens.length; i++) {
                const current = rawTokens[i];
                const next = rawTokens[i + 1];

                // Check rule: Merge if next token exists and is exactly 1 char
                if (next && next.length === 1) {
                    tokens.push(`${current} ${next}`);
                    i++; // skip 'next' as it is consumed
                } else {
                    tokens.push(current);
                }
            }

            if (tokens.length > 1) {
                // --- ROUTE MODE ---
                setMode('route');
                try {
                    // Fetch all unique codes to minimize URL length
                    const uniqueCodes = [...new Set(tokens)];
                    const queryParams = new URLSearchParams({ codes: uniqueCodes.join(',') });

                    const response = await fetch(`/api/stations?${queryParams}`);
                    const dbResults = await response.json();

                    // Map results back to the original token sequence
                    // This is crucial: The DB returns unsorted rows, we need the user's order.
                    let accumulatedDistance = 0;
                    const calculatedRoute = tokens.map((token, index) => {
                        // Find matching station logic (Case-insensitive check recommended if API doesn't handle it, 
                        // but usually best to rely on what API returned. 
                        // Our API does `code IN (...)` which is usually case-insensitive in SQL, but let's be safe).
                        const match = (dbResults.results || []).find(r =>
                            r.code.toLowerCase() === token.toLowerCase() ||
                            r.name.toLowerCase() === token.toLowerCase() // basic fallback
                        );

                        if (!match) {
                            return {
                                type: 'unknown',
                                code: token,
                                name: 'Unknown Station',
                                valid: false
                            };
                        }

                        // Distance Calculation (if not the first item)
                        let legDist = 0;
                        if (index > 0) {
                            const prev = (dbResults.results || []).find(r => r.code.toLowerCase() === tokens[index - 1].toLowerCase());
                            // Only calculate if BOTH current and prev are valid physical stations
                            if (prev && prev.lat && match.lat) {
                                legDist = calculateDistance(prev.lat, prev.lng, match.lat, match.lng);
                                accumulatedDistance += parseFloat(legDist);
                            }
                        }

                        return {
                            ...match, // includes type: 'Hp', 'Bf' etc from DB
                            valid: true,
                            legDistance: index > 0 ? legDist : null
                        };
                    });

                    setRouteData(calculatedRoute);
                    setTotalDistance(accumulatedDistance.toFixed(1));

                } catch (error) {
                    console.error("Route fetch error:", error);
                }
            } else {
                // --- SEARCH MODE ---
                setMode('search');
                try {
                    const response = await fetch(`/api/stations?q=${encodeURIComponent(tokens[0])}`);
                    const data = await response.json();
                    setSearchResults(data.results || []);
                } catch (error) {
                    console.error("Search fetch error:", error);
                    setSearchResults([]);
                }
            }

            setLoading(false);
        };

        fetchDecoder();
    }, [debouncedInput]);

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
                    Decode station codes or plan routes. Type multiple codes (e.g., "AA AABG") to see a route.
                </p>
            </div>

            {/* Sticky Search Bar */}
            <div className="sticky top-4 z-20 bg-dark/95 backdrop-blur-md py-4 -mx-4 px-4 border-b border-gray-800/50">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-4 border border-gray-700 rounded-xl leading-5 bg-card text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-lg font-mono shadow-lg"
                        placeholder="Search stations (e.g. 'München') or route (e.g. 'MHP MH NWH')"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
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
                {mode === 'search' && (
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
                    </div>
                )}

                {/* MODE: ROUTE */}
                {mode === 'route' && (
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
                            {/* Vertical Line */}<div className="absolute left-12 top-10 bottom-10 w-0.5 bg-gray-800"></div>

                            <div className="space-y-0">
                                {routeData.map((stop, index) => (
                                    <div key={index} className="relative pl-16 pb-8 last:pb-0 group">
                                        {/* Dot on Line */}
                                        <div className={`absolute left-[42px] mt-1.5 w-3 h-3 rounded-full border-2 z-10 
                                            ${stop.valid ? 'bg-purple-500 border-gray-900 group-hover:scale-125 transition' : 'bg-red-500 border-gray-900'}`
                                        }></div>

                                        {/* Leg Distance Label (between nodes) */}
                                        {stop.legDistance > 0 && (
                                            <div className="absolute -top-4 left-20">
                                                <span className="text-xs font-mono font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full border border-green-900/50">
                                                    + {stop.legDistance} km
                                                </span>
                                            </div>
                                        )}

                                        {/* Content Card */}
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
                )}
            </div>
        </div>
    );
};

export default Decoder;
