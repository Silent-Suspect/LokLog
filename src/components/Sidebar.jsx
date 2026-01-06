import { LayoutGrid, Binary, TrainFront, ShieldAlert, Settings, Mail } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

const Sidebar = ({ isOpen }) => {
  const isAdmin = useAdmin();

  const apps = [
    { icon: LayoutGrid, label: 'Dashboard', path: '/' },
    { icon: TrainFront, label: 'LokLog', path: '/loklog' },
    { icon: Binary, label: 'Decoder', path: '/decoder' },
    { icon: Mail, label: 'Email Vorlagen', path: '/email-templates' },
  ];

  const system = [
    { icon: Settings, label: 'Einstellungen', path: '/settings' },
  ];

  if (isAdmin) {
    system.unshift({ icon: ShieldAlert, label: 'Admin Konsole', path: '/admin' });
  }

  const NavItem = ({ item }) => (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive && item.path !== '#'
          ? 'bg-accent-blue text-white shadow-lg shadow-blue-900/20'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <item.icon size={20} />
      <span className="text-sm">{item.label}</span>
    </NavLink>
  );

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

      <nav className="flex-1 p-4 space-y-6 mt-2 overflow-y-auto">

        {/* APPS SECTION */}
        <div>
          <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apps</div>
          <div className="space-y-1">
            {apps.map((item) => <NavItem key={item.label} item={item} />)}
          </div>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-gray-800 mx-4"></div>

        {/* SYSTEM SECTION */}
        <div>
          <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</div>
          <div className="space-y-1">
            {system.map((item) => <NavItem key={item.label} item={item} />)}
          </div>
        </div>

      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-center text-gray-500">
          v0.2.0 • Beta
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
