import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  TrendingUp, 
  Building2, 
  Users, 
  Sparkles, 
  Shield,
  Wallet,
  Layers,
  Rocket,
  Twitter,
  Github,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  Zap,
  Globe,
  Lock,
  BarChart3
} from 'lucide-react';
import { useUser } from '../App';

// Feature cards with enhanced details
const features = [
  {
    icon: FileText,
    title: 'Tax Dashboard',
    description: 'Automated IRS 8949 reports, 200+ jurisdictions supported with real-time calculations.',
    badge: 'Popular',
  },
  {
    icon: TrendingUp,
    title: 'Trading',
    description: 'Native XRPL DEX integration with instant settlement and minimal fees.',
    badge: null,
  },
  {
    icon: Building2,
    title: 'Tokenized Assets',
    description: 'Real estate, private equity, securities - all compliant and fractionalized.',
    badge: 'New',
  },
  {
    icon: Users,
    title: 'Guild Treasury',
    description: 'Multi-sig DAO management with automated payroll and governance.',
    badge: null,
  },
  {
    icon: Sparkles,
    title: 'Signals',
    description: 'Proof-of-engagement reputation system rewarding quality contributions.',
    badge: null,
  },
  {
    icon: Shield,
    title: 'Compliance',
    description: 'XLS-39D clawback support, KYC/AML ready for institutional adoption.',
    badge: 'Enterprise',
  },
];

// Animated stats with counting effect
const stats = [
  { label: 'Total Value Locked', value: 857, prefix: '$', suffix: 'M', duration: 2000 },
  { label: 'Assets Tokenized', value: 5, prefix: '', suffix: '', duration: 1500 },
  { label: 'Total Holders', value: 19870, prefix: '', suffix: '', duration: 2500 },
  { label: 'Dividends Paid', value: 29.7, prefix: '$', suffix: 'M', duration: 2000 },
];

// How it works steps
const steps = [
  {
    icon: Wallet,
    step: '01',
    title: 'Connect Wallet',
    description: 'Link your XUMM wallet or any XRPL-compatible wallet in seconds.',
  },
  {
    icon: Layers,
    step: '02',
    title: 'Choose Asset Type',
    description: 'Select from real estate, equity, securities, or create custom tokens.',
  },
  {
    icon: Rocket,
    step: '03',
    title: 'Launch & Distribute',
    description: 'Deploy your compliant token and distribute to verified investors.',
  },
];

// Trust badges
const trustBadges = [
  { icon: Lock, label: 'Bank-grade Security' },
  { icon: Globe, label: '200+ Jurisdictions' },
  { icon: BarChart3, label: 'Real-time Analytics' },
  { icon: Shield, label: 'Compliance Ready' },
];

// Footer links
const footerLinks = {
  Product: ['Features', 'Pricing', 'Documentation', 'API Reference'],
  Company: ['About', 'Blog', 'Careers', 'Press Kit'],
  Legal: ['Privacy', 'Terms', 'Compliance', 'Security'],
  Community: ['Discord', 'Twitter', 'GitHub', 'Forum'],
};

// Animated counter hook
function useCountUp(end: number, duration: number, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(!startOnView);

  useEffect(() => {
    if (!hasStarted) return;
    
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(end * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, hasStarted]);

  return { count, start: () => setHasStarted(true) };
}

// Stat card component with animation
function StatCard({ stat, index }: { stat: typeof stats[0]; index: number }) {
  const { count, start } = useCountUp(stat.value, stat.duration);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      start();
    }, index * 200);
    return () => clearTimeout(timer);
  }, [index, start]);

  const formatValue = (val: number) => {
    if (stat.suffix === 'M' && stat.value < 100) {
      return val.toFixed(1);
    }
    return Math.round(val).toLocaleString();
  };

  return (
    <div 
      className={`text-center transform transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
        {stat.prefix}{formatValue(count)}{stat.suffix}
      </div>
      <div className="text-white/60 text-sm sm:text-base">{stat.label}</div>
    </div>
  );
}

export default function Landing() {
  const [userId, setUserIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const { login } = useUser();
  const navigate = useNavigate();

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    login(userId.trim());
    navigate('/app/tax');
  };

  const handleLaunchApp = () => {
    // For demo, use a generated wallet ID
    const demoId = `demo_${Date.now()}`;
    login(demoId);
    navigate('/app/assets');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className={`mx-4 mt-4 rounded-2xl border transition-all duration-300 ${
          scrollY > 50 
            ? 'bg-slate-950/80 backdrop-blur-xl border-white/10 shadow-lg shadow-black/20' 
            : 'bg-transparent border-transparent'
        }`}>
          <div className="container mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Verity</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-white/60 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#how-it-works" className="text-white/60 hover:text-white transition-colors text-sm font-medium">
                How it Works
              </a>
              <a 
                href="https://github.com/SMMM25/Verity-Protocol-VRTY-" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors text-sm font-medium"
              >
                GitHub
              </a>
            </nav>
            <button 
              onClick={handleLaunchApp}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all duration-300 hover:scale-105 border border-white/10"
            >
              Launch App
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          />
        </div>

        {/* Floating Orbs with Parallax */}
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          style={{ transform: `translate(${scrollY * 0.05}px, ${scrollY * 0.02}px)` }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"
          style={{ transform: `translate(-${scrollY * 0.03}px, -${scrollY * 0.04}px)` }}
        />
        <div 
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl"
          style={{ transform: `translate(${scrollY * 0.02}px, ${scrollY * 0.03}px)` }}
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Status Badge */}
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-sm text-white/80">Built on XRP Ledger</span>
          </div>

          {/* Main Heading */}
          <h1 
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            Tokenize Real-World
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient">
              Assets on XRPL
            </span>
          </h1>

          {/* Subheading */}
          <p 
            className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            Compliant asset tokenization with automated tax reporting, built on the XRP Ledger. 
            Launch institutional-grade tokens in minutes.
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            <button 
              onClick={handleLaunchApp}
              className="group relative bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-105 flex items-center gap-2 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Launch App
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <a 
              href="https://github.com/SMMM25/Verity-Protocol-VRTY-"
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-white/20 bg-white/5 text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              View Documentation
              <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>

          {/* Trust Badges */}
          <div 
            className="flex flex-wrap justify-center gap-6 mt-16 animate-fade-in"
            style={{ animationDelay: '0.5s' }}
          >
            {trustBadges.map((badge) => (
              <div 
                key={badge.label}
                className="flex items-center gap-2 text-white/50 text-sm"
              >
                <badge.icon className="w-4 h-4" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1">
              <div className="w-1.5 h-3 bg-white/50 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need to
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent"> Tokenize Assets</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              A complete suite of tools for compliant asset tokenization, trading, and management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group relative bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6 hover:bg-white/10 transition-all duration-500 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer hover:-translate-y-1"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards',
                  opacity: 0,
                }}
              >
                {/* Badge */}
                {feature.badge && (
                  <span className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-medium ${
                    feature.badge === 'New' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : feature.badge === 'Popular'
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {feature.badge}
                  </span>
                )}

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4 group-hover:from-violet-500/30 group-hover:to-indigo-500/30 transition-all duration-300 group-hover:scale-110">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-white/60 leading-relaxed text-sm">
                  {feature.description}
                </p>

                {/* Hover Arrow */}
                <div className="mt-4 flex items-center text-violet-400 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-2">
                  <span className="text-sm font-medium">Learn more</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-violet-950/50 via-purple-950/50 to-indigo-950/50 border-y border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} stat={stat} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Launch in
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent"> Three Steps</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              From connection to distribution in minutes, not months.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div key={step.title} className="relative group">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5">
                    <div className="w-full h-full bg-gradient-to-r from-violet-500/50 to-transparent" />
                  </div>
                )}
                
                <div className="relative text-center">
                  {/* Step Number Background */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-7xl font-bold text-white/[0.03] select-none">
                    {step.step}
                  </div>
                  
                  {/* Icon Container */}
                  <div className="relative z-10 w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-all duration-300 group-hover:scale-110">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                  <p className="text-white/60 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <button 
              onClick={handleLaunchApp}
              className="group relative bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-10 py-4 text-lg font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-105 flex items-center gap-2 mx-auto overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Now
                <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Start Form Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950 to-indigo-950/30">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start?
          </h2>
          <p className="text-white/60 mb-8">
            Enter your wallet address to access the platform instantly. No signup required.
          </p>
          
          <form onSubmit={handleGetStarted} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter your wallet address or username"
                value={userId}
                onChange={(e) => setUserIdInput(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all duration-300"
                aria-label="Wallet address or username"
              />
            </div>
            <button
              type="submit"
              disabled={!userId.trim() || isLoading}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Access Dashboard
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          <p className="text-sm text-white/40 mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Verity</span>
              </div>
              <p className="text-white/50 text-sm mb-4 leading-relaxed">
                Institutional-grade asset tokenization on XRPL.
              </p>
              
              {/* Social Links */}
              <div className="flex gap-3">
                <a 
                  href="https://twitter.com/VerityProtocol" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-110"
                  aria-label="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a 
                  href="https://github.com/SMMM25/Verity-Protocol-VRTY-" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-110"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a 
                  href="https://discord.gg/verity" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-110"
                  aria-label="Discord"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-white font-semibold mb-4">{category}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a 
                        href="#" 
                        className="text-white/50 hover:text-white transition-colors text-sm inline-flex items-center gap-1 group"
                      >
                        {link}
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm">
              © 2026 Verity Protocol. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <span>Built with</span>
              <span className="text-red-400">❤️</span>
              <span>on the</span>
              <span className="text-violet-400 font-medium">XRP Ledger</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes gradient {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }
        
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        
        .animate-fade-in {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
