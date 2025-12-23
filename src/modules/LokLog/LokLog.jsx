import { useState, useEffect } from 'react';
import { Send, User, Clock, FileText } from 'lucide-react';
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
        <div className="max-w-4xl mx-auto space-y-8 pb-8">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-accent-blue bg-opacity-10 rounded-xl">
                    <FileText className="text-accent-blue" size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">LokLog</h1>
                    <p className="text-gray-400">Digital Shifts & Notes</p>
                </div>
            </header>

            {/* Input Form */}
            <div className="bg-card rounded-2xl shadow-lg border border-gray-800 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* User Info Display */}
                    <div className="flex items-center gap-3 p-3 bg-dark rounded-xl border border-gray-800">
                        <div className="bg-accent-blue text-white rounded-full p-1.5">
                            <User size={16} />
                        </div>
                        <span className="text-sm font-medium text-gray-300">
                            Logged in as: <span className="font-bold text-white">{user?.fullName}</span>
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Log Message</label>
                        <textarea
                            placeholder="What happened on this shift?"
                            rows="3"
                            className="w-full p-4 rounded-xl bg-dark border border-gray-800 text-white focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none transition resize-none placeholder-gray-600"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-red-400">{error}</span>
                        <button
                            type="submit"
                            disabled={loading || !content}
                            className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-900/20"
                        >
                            <Send size={20} />
                            {loading ? 'Saving...' : 'Post Entry'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Feed */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Recent Logs</h2>

                {entries.length === 0 && !error && (
                    <p className="text-gray-500 italic p-4 text-center border border-dashed border-gray-800 rounded-xl">No entries yet. Be the first to write something!</p>
                )}

                <div className="grid gap-4">
                    {entries.map((entry) => (
                        <div key={entry.id} className="bg-card p-6 rounded-2xl border border-gray-800 shadow-sm hover:border-gray-700 transition group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-dark border border-gray-800 text-accent-blue flex items-center justify-center font-bold text-sm uppercase">
                                        {entry.user.substring(0, 2)}
                                    </div>
                                    <span className="font-semibold text-white">{entry.user}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-dark px-3 py-1 rounded-full border border-gray-800 group-hover:border-gray-700 transition">
                                    <Clock size={14} />
                                    {formatDate(entry.timestamp)}
                                </div>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap pl-[3.25rem] leading-relaxed">{entry.content}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LokLog;
