import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import pathfinderLogo from '../../assets/images/MY PATHFINDER LOGO.JPG.jpeg';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <img src={pathfinderLogo} alt="My Pathfinder" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
                        <span className="font-bold text-slate-800">My Pathfinder</span>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto animate-in fade-in duration-500">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
