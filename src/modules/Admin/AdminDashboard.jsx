import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Trash2, AlertTriangle, ShieldAlert, Search } from 'lucide-react';
import StationManager from './StationManager';

const AdminDashboard = () => {
    const { user } = useUser();
    const { getToken } = useAuth(); // Need getToken for API calls

    // Monitor State
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [monitoredShifts, setMonitoredShifts] = useState([]);

    // Load Users
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setUsers(data || []);
            } catch (e) { console.error("Admin: Failed to load users", e); }
        };
        fetchUsers();
    }, [getToken]);

    // Load Shifts when User/Month changes
    useEffect(() => {
        if (!selectedUser || !selectedMonth) return;

        const fetchShifts = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/admin/shifts?userId=${selectedUser}&month=${selectedMonth}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setMonitoredShifts(data.shifts || []);
            } catch (e) { console.error("Admin: Failed to load shifts", e); }
        };
        fetchShifts();
    }, [selectedUser, selectedMonth, getToken]);

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

                {/* MODULE: FAHRTEN-MONITOR */}
                <div className="col-span-1 lg:col-span-2 bg-card p-6 rounded-2xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Search size={20} className="text-purple-400" />
                            Fahrten-Monitor
                        </h2>

                        <div className="flex gap-4">
                            {/* User Select */}
                            <select
                                value={selectedUser}
                                onChange={e => setSelectedUser(e.target.value)}
                                className="bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none"
                            >
                                <option value="">-- Fahrer wählen --</option>
                                {users.map(u => (
                                    <option key={u.user_id} value={u.user_id}>
                                        {u.lastName}, {u.firstName} ({u.email})
                                    </option>
                                ))}
                            </select>

                            {/* Month Picker */}
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500 transition"
                            />
                        </div>
                    </div>

                    {/* Shifts Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-700">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3">Datum</th>
                                    <th className="px-4 py-3">Zeit</th>
                                    <th className="px-4 py-3">Strecke</th>
                                    <th className="px-4 py-3 text-right">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {monitoredShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500 italic">
                                            Keine Fahrten gefunden oder User nicht gewählt.
                                        </td>
                                    </tr>
                                ) : (
                                    monitoredShifts.map(s => (
                                        <tr key={s.id} className="bg-dark hover:bg-gray-800/50 transition">
                                            <td className="px-4 py-3 font-medium text-white">
                                                {new Date(s.date).toLocaleDateString('de-DE')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {s.start_time} - {s.end_time}
                                            </td>
                                            <td className="px-4 py-3">
                                                {/* Da Segmente separat sind, zeigen wir hier nur grobe Infos oder KM */}
                                                {s.km_start} &rarr; {s.km_end} km
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {/* Button to view Details could go here */}
                                                <span className="text-xs bg-gray-700 px-2 py-1 rounded">View</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

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
