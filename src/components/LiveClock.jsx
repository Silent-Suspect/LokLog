import { useState, useEffect } from 'react';

const LiveClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-center py-6">
            <div className="text-5xl font-bold tabular-nums tracking-wider text-white">
                {time.toLocaleTimeString('de-DE')}
            </div>
            <div className="text-lg text-gray-400 mt-2 font-medium">
                {time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
        </div>
    );
};

export default LiveClock;
