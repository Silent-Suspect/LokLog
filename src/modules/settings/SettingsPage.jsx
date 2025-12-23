const SettingsPage = () => {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                <p className="text-slate-500">Manage your account and preferences.</p>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">General Settings</h3>
                </div>
                <div className="p-6">
                    <p className="text-slate-500">Settings configuration will appear here.</p>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
