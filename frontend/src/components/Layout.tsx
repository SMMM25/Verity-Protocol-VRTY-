import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  FileText, 
  Settings, 
  LogOut, 
  Receipt,
  LayoutDashboard,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { useUser } from '../App';

const navItems = [
  { to: '/app/tax', icon: Calculator, label: 'Tax Dashboard', exact: true },
  { to: '/app/tax/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/app/tax/reports', icon: FileText, label: 'Reports' },
  { to: '/app/tax/settings', icon: Settings, label: 'Settings' },
];

const comingSoonItems = [
  { icon: TrendingUp, label: 'Trading', badge: 'Soon' },
  { icon: Users, label: 'Guilds', badge: 'Soon' },
  { icon: Zap, label: 'Signals', badge: 'Soon' },
];

export default function Layout() {
  const { userId, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-verity-500 to-verity-600 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Verity</h1>
              <p className="text-xs text-slate-400">Protocol</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tax Center</p>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-verity-600 text-white'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Coming Soon</p>
            <ul className="space-y-1">
              {comingSoonItems.map((item) => (
                <li key={item.label}>
                  <div className="flex items-center gap-3 px-3 py-2 text-slate-500 cursor-not-allowed">
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                      {item.badge}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-verity-600 flex items-center justify-center text-white text-sm font-medium">
              {userId.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userId}</p>
              <p className="text-xs text-slate-400">Free Plan</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
