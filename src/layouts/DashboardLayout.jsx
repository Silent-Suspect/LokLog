import { Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import Sidebar from '../components/Sidebar';

const DashboardLayout = () => {
    return (
        <div className="min-h-screen bg-dark flex text-white">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 ml-64 flex flex-col">
                {/* Top Header */}
                <header className="h-16 bg-card border-b border-gray-800 flex items-center justify-end px-8 sticky top-0 z-10">
                    <UserButton />
                </header>

                <main className="flex-1 p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
