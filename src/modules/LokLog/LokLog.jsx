import { useState, useEffect } from 'react';
import { Send, User, Clock } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';

const LokLog = () => {
    const { user } = useUser();
    const [entries, setEntries] = useState([]);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchEntries = async () => {
        try {
            const res = await fetch('/api/loklog');
            if (!res.ok) throw new Error('Failed to fetch entries');
            const data = await res.json();
            setEntries(data || []);
        } catch (err) {
            console.error(err);
            setError('Could not load entries. (Ensure backend is running)');
        }
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content) return;

        setLoading(true);
        setError('');

        try {
            // Use logged-in user's full name, or first name, or fallback
            const userName = user.fullName || user.firstName || 'Unknown User';

            const res = await fetch('/api/loklog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: userName, content }),
            });

            if (!res.ok) throw new Error('Failed to save entry');

            setContent('');
            fetchEntries();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-slate-900">LokLog</h1>
                <p className="text-slate-500">Digital Shifts & Notes</p>
            </header>

            {/* Input Form */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* User Info Display */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="bg-blue-600 text-white rounded-full p-1">
                            <User size={16} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                            Logged in as: <span className="font-bold text-slate-900">{user?.fullName}</span>
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Log Message</label>
                        <textarea
                            placeholder="What happened on this shift?"
                            rows="3"
                            className="w-full p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-red-500">{error}</span>
                        <button
                            type="submit"
                            disabled={loading || !content}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <Send size={18} />
                            {loading ? 'Saving...' : 'Post Entry'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Feed */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-800">Recent Logs</h2>

                {entries.length === 0 && !error && (
                    <p className="text-slate-400 italic">No entries yet. Be the first to write something!</p>
                )}

                <div className="grid gap-4">
                    {entries.map((entry) => (
                        <div key={entry.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                        {entry.user.substring(0, 2)}
                                    </div>
                                    <span className="font-semibold text-slate-900">{entry.user}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <Clock size={14} />
                                    {formatDate(entry.timestamp)}
                                </div>
                            </div>
                            <p className="text-slate-700 whitespace-pre-wrap pl-10">{entry.content}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LokLog;
