import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  Shield, 
  Globe, 
  FileText,
  ChevronRight,
  Check,
  Zap
} from 'lucide-react';
import { useUser } from '../App';

const features = [
  {
    icon: Calculator,
    title: 'Auto-Tax Calculation',
    description: 'Real-time tax calculations with FIFO, LIFO, HIFO, and more cost basis methods.',
  },
  {
    icon: Globe,
    title: '200+ Jurisdictions',
    description: 'Support for tax rules across the US, UK, EU, and 200+ other countries.',
  },
  {
    icon: FileText,
    title: 'IRS 8949 Reports',
    description: 'Generate compliant tax reports in IRS 8949, HMRC, and other formats.',
  },
  {
    icon: Shield,
    title: 'Audit Trail',
    description: 'Complete transparency with verifiable calculation methodology.',
  },
];

const benefits = [
  'Free to use - no hidden fees',
  'Track unlimited transactions',
  'Real-time gain/loss calculations',
  'Multiple cost basis methods',
  'Export to any tax software',
  'XRPL native integration',
];

export default function Landing() {
  const [userId, setUserIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useUser();
  const navigate = useNavigate();

  const handleGetStarted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;

    setIsLoading(true);
    // Simulate a brief loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    login(userId.trim());
    navigate('/app/tax');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-verity-500 to-verity-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Verity Protocol</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/SMMM25/Verity-Protocol-VRTY-" target="_blank" rel="noopener noreferrer" 
               className="text-slate-400 hover:text-white transition-colors">
              GitHub
            </a>
            <a href="/docs" className="text-slate-400 hover:text-white transition-colors">
              Docs
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-verity-500/10 border border-verity-500/20 text-verity-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-verity-500 animate-pulse"></span>
            Now Live on XRPL Mainnet
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Crypto Tax
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-verity-400 to-verity-600"> Made Simple</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Auto-calculate your crypto taxes with support for 200+ jurisdictions. 
            Generate IRS 8949 reports, track cost basis, and stay compliant.
          </p>

          {/* Login Form */}
          <form onSubmit={handleGetStarted} className="max-w-md mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter your wallet address or username"
                value={userId}
                onChange={(e) => setUserIdInput(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!userId.trim() || isLoading}
                className="px-6 py-3 rounded-lg bg-verity-600 hover:bg-verity-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    Get Started
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-3">
              No signup required. Start calculating your taxes instantly.
            </p>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Powerful Tax Tools</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Everything you need to manage your crypto taxes in one place.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-verity-500/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-verity-500/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-verity-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">
                Why Choose Verity?
              </h2>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-verity-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-verity-400" />
                    </div>
                    <span className="text-slate-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="text-sm text-slate-400 mb-4">Tax Summary Preview</div>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Short-term Gains</span>
                  <span className="text-green-400 font-medium">+$2,450.00</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Long-term Gains</span>
                  <span className="text-green-400 font-medium">+$8,230.00</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Staking Income</span>
                  <span className="text-blue-400 font-medium">+$1,120.00</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-white font-medium">Estimated Tax</span>
                  <span className="text-xl font-bold text-white">$2,840.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
          <p>© 2026 Verity Protocol. Built on XRPL.</p>
          <p className="mt-2">
            <a href="https://github.com/SMMM25/Verity-Protocol-VRTY-" className="text-verity-400 hover:text-verity-300">
              Open Source
            </a>
            {' · '}
            <a href="/docs" className="text-verity-400 hover:text-verity-300">
              Documentation
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
