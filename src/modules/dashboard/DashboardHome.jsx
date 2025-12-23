import { useState } from 'react';

const DashboardHome = () => {
    const [apiMessage, setApiMessage] = useState('');

    const callApi = async () => {
        try {
            const response = await fetch('/api/hello');
            const data = await response.json();
            setApiMessage(data.message);
        } catch (error) {
            setApiMessage('Error calling API (Backend might not be running locally)');
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Welcome to the SaaS Platform</h1>
                <p className="text-slate-500 mb-6">
                    This is the dashboard home. The layout is set up with a sidebar and top header.
                </p>

                <div className="flex gap-4 items-center">
                    <button
                        onClick={callApi}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Test Backend API
                    </button>

                    {apiMessage && (
                        <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                            {apiMessage}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
