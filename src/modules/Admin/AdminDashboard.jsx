import { useUser } from '@clerk/clerk-react';
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import StationManager from './StationManager';

const AdminDashboard = () => {
    const { user } = useUser();

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-4 border-b border-red-900/30 pb-6">
                <div className="p-3 bg-red-900/20 rounded-xl">
                    <ShieldAlert size={32} className="text-red-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Admin Console</h1>
                    <p className="text-red-400">Restricted Access Area</p>
                </div>
            </div>

            {/* Debug Info */}
            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 flex items-center gap-3 text-red-300">
                <AlertTriangle size={20} />
                <span className="font-mono text-sm">
                    Logged in as Admin: <strong>{user?.fullName}</strong> (ID: {user?.id})
                </span>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 gap-8">

                {/* STATION MANAGER */}
                <StationManager />

                {/* Legacy/Cleanup Actions (Visual Placeholder for now) */}
                <div className="bg-card border border-gray-800 rounded-2xl p-6 hover:border-red-900/50 transition group cursor-pointer opacity-75">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-red-900/20 transition">
                            <Trash2 className="text-gray-400 group-hover:text-red-500" size={24} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-800 px-2 py-1 rounded">
                            Coming Soon
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">LokLog Cleanup</h3>
                    <p className="text-gray-400 text-sm">
                        Batch delete old log entries or wipe specific tables.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
