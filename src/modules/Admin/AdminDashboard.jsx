import { useUser } from '@clerk/clerk-react';
import { Trash2, MapPin, AlertTriangle, ShieldAlert } from 'lucide-react';

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

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1 */}
                <div className="bg-card border border-gray-800 rounded-2xl p-6 hover:border-red-900/50 transition group cursor-pointer">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-red-900/20 transition">
                            <Trash2 className="text-gray-400 group-hover:text-red-500" size={24} />
                        </div>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider bg-red-900/20 px-2 py-1 rounded">
                            Danger
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">LokLog Cleanup</h3>
                    <p className="text-gray-400 text-sm">
                        Batch delete old log entries or wipe specific tables. Proceed with caution.
                    </p>
                </div>

                {/* Card 2 */}
                <div className="bg-card border border-gray-800 rounded-2xl p-6 hover:border-accent-blue/50 transition group cursor-pointer">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-accent-blue/20 transition">
                            <MapPin className="text-gray-400 group-hover:text-accent-blue" size={24} />
                        </div>
                        <span className="text-xs font-bold text-accent-blue uppercase tracking-wider bg-blue-900/20 px-2 py-1 rounded">
                            Beta
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Station Editor</h3>
                    <p className="text-gray-400 text-sm">
                        Modify GPS coordinates or fix station names directly in the D1 database.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
