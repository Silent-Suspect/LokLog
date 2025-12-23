const DashboardPage = () => {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Overview of your railway operations.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sample Widget */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Active Shifts</h3>
                    <p className="text-3xl font-bold text-slate-900">12</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Pending Reports</h3>
                    <p className="text-3xl font-bold text-slate-900">4</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Efficiency</h3>
                    <p className="text-3xl font-bold text-green-600">+94%</p>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
