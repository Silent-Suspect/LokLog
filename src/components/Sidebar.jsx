import { LayoutDashboard, Settings, Wrench, FileText, TrainFront, ShieldAlert } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

const Sidebar = ({ isOpen }) => {
  const isAdmin = useAdmin();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'LokLog', path: '/loklog' },
    { icon: Wrench, label: 'Tools', path: '/tools' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  if (isAdmin) {
    navItems.push({ icon: ShieldAlert, label: 'Admin', path: '/admin' });
  }

  return (
    <aside className={`
        w-64 bg-card flex flex-col h-screen border-r border-gray-800
        fixed top-0 left-0 z-50
        transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-accent-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <TrainFront className="text-white" size={24} />
          </div>
          LokLog
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-4 rounded-xl transition-all font-medium ${isActive
                ? 'bg-accent-blue text-white shadow-lg shadow-blue-900/20'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon size={22} />
            <span className="text-base">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-center text-gray-500">
          v0.1.0 • Alpha
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
