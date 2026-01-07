import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { RotateCcw, AlertOctagon, CalendarClock } from 'lucide-react';

const DataRestoreTool = ({ users }) => {
    const { getToken } = useAuth();
    const [targetUser, setTargetUser] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [historyList, setHistoryList] = useState([]);

    // Load available backups when user is selected
    useEffect(() => {
        if (!targetUser) {
            setHistoryList([]);
            return;
        }

        const fetchHistory = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/admin/history?userId=${targetUser}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setHistoryList(data.history || []);
            } catch (e) {
                console.error("Failed to load history", e);
            }
        };
        fetchHistory();
    }, [targetUser, getToken]);

    const handleRestore = async () => {
        if (!targetUser || !targetDate) return;
        if (!window.confirm(`RESTORE ${targetDate} for user ${targetUser}?\nThis will overwrite current data!`)) return;

        setLoading(true);
        setResult(null);

        try {
            const token = await getToken();
            const params = new URLSearchParams({ userId: targetUser, date: targetDate });

            const res = await fetch(`/api/admin/restore?${params}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setResult({ type: 'success', msg: `Restored! (Source: ${new Date(data.restored_from).toLocaleString()})` });
            } else {
                setResult({ type: 'error', msg: data.error || "Failed to restore" });
            }
        } catch (e) {
            setResult({ type: 'error', msg: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-card border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-900/20 rounded-xl">
                    <RotateCcw size={24} className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Data Restore</h3>
                    <p className="text-gray-400 text-xs">Recover deleted shifts from History Backup</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <select
                    value={targetUser}
                    onChange={e => setTargetUser(e.target.value)}
                    className="bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                >
                    <option value="">-- Select Driver --</option>
                    {users.map(u => (
                        <option key={u.user_id} value={u.user_id}>{u.lastName}, {u.firstName}</option>
                    ))}
                </select>

                <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                />

                <button
                    onClick={handleRestore}
                    disabled={!targetUser || !targetDate || loading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold rounded-xl px-4 py-3 transition flex items-center justify-center gap-2"
                >
                    {loading ? 'Restoring...' : 'Restore Backup'}
                </button>
            </div>

            {result && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${result.type === 'success' ? 'bg-green-900/20 border-green-900 text-green-400' : 'bg-red-900/20 border-red-900 text-red-400'}`}>
                    <AlertOctagon size={18} />
                    <span className="text-sm font-mono">{result.msg}</span>
                </div>
            )}

            {/* Backup List */}
            {targetUser && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                    <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                        <CalendarClock size={16} /> Available Backups
                    </h4>
                    {historyList.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No backup history found for this user.</p>
                    ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                            {historyList.map((h, i) => (
                                <button
                                    key={i}
                                    onClick={() => setTargetDate(h.date)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition ${targetDate === h.date ? 'bg-blue-900/30 text-blue-300 border border-blue-800' : 'bg-dark/50 text-gray-300 hover:bg-dark'}`}
                                >
                                    <span className="font-mono">{h.date}</span>
                                    <span className="text-xs text-gray-500">
                                        {h.count} versions • Last: {new Date(h.latest_ts).toLocaleTimeString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataRestoreTool;
