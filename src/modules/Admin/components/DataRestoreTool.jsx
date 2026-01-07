import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { RotateCcw, AlertOctagon } from 'lucide-react';

const DataRestoreTool = ({ users }) => {
    const { getToken } = useAuth();
    const [targetUser, setTargetUser] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

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
        </div>
    );
};

export default DataRestoreTool;
