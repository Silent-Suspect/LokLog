import { TrainFront } from 'lucide-react';

const LokLogDashboard = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <div className="p-6 bg-accent-blue/10 rounded-full">
                <TrainFront size={64} className="text-accent-blue" />
            </div>

            <div className="space-y-2">
                <h1 className="text-4xl font-bold text-white">LokLog</h1>
                <p className="text-xl text-gray-400 max-w-md mx-auto">
                    Hier entsteht dein digitales Fahrtenbuch.
                </p>
            </div>

            <button
                disabled
                className="px-8 py-3 bg-gray-800 text-gray-500 font-semibold rounded-xl cursor-not-allowed border border-gray-700"
            >
                Neue Fahrt starten
            </button>

            <p className="text-sm text-gray-600">
                Coming Soon
            </p>
        </div>
    );
};

export default LokLogDashboard;
