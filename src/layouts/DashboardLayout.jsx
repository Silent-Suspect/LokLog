import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const DashboardLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-dark flex text-white relative">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar isOpen={isMobileMenuOpen} />

            {/* Main Content Area */}
            {/* Added transition-all for smooth resizing if needed, but mainly removed ml-64 on mobile */}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all duration-300">
                {/* Top Header */}
                <header className="h-16 bg-card border-b border-gray-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
                    {/* Mobile Menu Toggle */}
                    <button
                        className="p-2 -ml-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white md:hidden"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <Menu size={24} />
                    </button>

                    {/* Spacer for desktop to keep UserButton on right */}
                    <div className="hidden md:block"></div>

                    <UserButton />
                </header>

                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
