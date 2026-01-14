import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  ArrowRightLeft
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
        <nav className="flex-1 p-4 overflow-y-auto">
          {/* Tax Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tax Center</p>
            <ul className="space-y-1">
              {taxNavItems.map((item) => (
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

          {/* Trading Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Trading
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {tradingNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white'
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

          {/* Guilds Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Guilds & DAOs
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-600/30 text-green-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {guildNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-green-600 text-white'
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

          {/* Signals Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Signals
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-yellow-600/30 text-yellow-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {signalsNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-yellow-600 text-white'
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

          {/* Tokenized Assets Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              RWA Tokenization
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {assetsNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
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

          {/* AI Sentinel Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              AI Sentinel
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {sentinelNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white'
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

          {/* Cross-Chain Bridge Section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Cross-Chain
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-cyan-600/30 text-cyan-400">NEW</span>
            </p>
            <ul className="space-y-1">
              {bridgeNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-cyan-600 text-white'
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
      <main className="flex-1 overflow-auto bg-gray-900 p-6">
        <Outlet />
      </main>
    </div>
  );
}
