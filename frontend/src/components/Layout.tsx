import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Calculator, 
  FileText, 
  Settings, 
  LogOut, 
  Receipt,
  LayoutDashboard,
  Users,
  Zap,
  Wallet,
  LineChart,
  Landmark,
  Brain,
  ArrowRightLeft,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { useUser } from '../App';

const taxNavItems = [
  { to: '/app/tax', icon: Calculator, label: 'Tax Dashboard', exact: true },
  { to: '/app/tax/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/app/tax/reports', icon: FileText, label: 'Reports' },
  { to: '/app/tax/settings', icon: Settings, label: 'Settings' },
];

const tradingNavItems = [
  { to: '/app/trading', icon: LineChart, label: 'Trading', exact: true },
  { to: '/app/trading/portfolio', icon: Wallet, label: 'Portfolio' },
];

const guildNavItems = [
  { to: '/app/guilds', icon: Users, label: 'Guilds', exact: true },
];

const signalsNavItems = [
  { to: '/app/signals', icon: Zap, label: 'Signals', exact: true },
];

const assetsNavItems = [
  { to: '/app/assets', icon: Landmark, label: 'Tokenized Assets', exact: true },
];

const sentinelNavItems = [
  { to: '/app/sentinel', icon: Brain, label: 'AI Sentinel', exact: true },
];

const bridgeNavItems = [
  { to: '/app/bridge', icon: ArrowRightLeft, label: 'Cross-Chain Bridge', exact: true },
];

// Navigation sections config
const navSections = [
  { 
    title: 'Tax Center', 
    items: taxNavItems, 
    color: 'verity',
    badge: null 
  },
  { 
    title: 'Trading', 
    items: tradingNavItems, 
    color: 'purple',
    badge: { text: 'NEW', color: 'purple' }
  },
  { 
    title: 'Guilds & DAOs', 
    items: guildNavItems, 
    color: 'green',
    badge: { text: 'NEW', color: 'green' }
  },
  { 
    title: 'Signals', 
    items: signalsNavItems, 
    color: 'yellow',
    badge: { text: 'NEW', color: 'yellow' }
  },
  { 
    title: 'RWA Tokenization', 
    items: assetsNavItems, 
    color: 'indigo',
    badge: { text: 'NEW', color: 'indigo' }
  },
  { 
    title: 'AI Sentinel', 
    items: sentinelNavItems, 
    color: 'purple',
    badge: { text: 'NEW', color: 'purple' }
  },
  { 
    title: 'Cross-Chain', 
    items: bridgeNavItems, 
    color: 'cyan',
    badge: { text: 'NEW', color: 'cyan' }
  },
];

const colorClasses: Record<string, { active: string; badge: string }> = {
  verity: { active: 'bg-violet-600', badge: 'bg-violet-600/30 text-violet-400' },
  purple: { active: 'bg-purple-600', badge: 'bg-purple-600/30 text-purple-400' },
  green: { active: 'bg-green-600', badge: 'bg-green-600/30 text-green-400' },
  yellow: { active: 'bg-yellow-600', badge: 'bg-yellow-600/30 text-yellow-400' },
  indigo: { active: 'bg-indigo-600', badge: 'bg-indigo-600/30 text-indigo-400' },
  cyan: { active: 'bg-cyan-600', badge: 'bg-cyan-600/30 text-cyan-400' },
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userId, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get current page title for mobile header
  const getCurrentPageTitle = () => {
    for (const section of navSections) {
      const item = section.items.find(i => location.pathname.startsWith(i.to));
      if (item) return item.label;
    }
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-white hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Verity</span>
          </div>
          
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
        
        {/* Breadcrumb */}
        <div className="px-4 pb-2 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Dashboard</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-white font-medium">{getCurrentPageTitle()}</span>
        </div>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-64 bg-slate-800 border-r border-slate-700 flex flex-col
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Verity</h1>
              <p className="text-xs text-slate-400">Protocol</p>
            </div>
          </div>
          
          {/* Close button (mobile only) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {section.title}
                {section.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorClasses[section.badge.color].badge}`}>
                    {section.badge.text}
                  </span>
                )}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                          isActive
                            ? `${colorClasses[section.color].active} text-white shadow-lg`
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                      <span className="font-medium">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-medium shadow-lg shadow-violet-500/25">
              {userId.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userId}</p>
              <p className="text-xs text-slate-400">Free Plan</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900 lg:p-6 pt-24 lg:pt-6 pb-6 px-4">
        <Outlet />
      </main>

      {/* Animation styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
