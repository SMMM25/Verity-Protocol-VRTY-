import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Shield, Zap, Globe, Users, BarChart3, Lock } from 'lucide-react';

export default function Whitepaper() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img 
              src="/ui/assets/branding/vrty-logo-64.png" 
              alt="VRTY Logo" 
              className="w-10 h-10 rounded-xl shadow-lg shadow-violet-500/25"
            />
            <span className="text-xl font-bold text-white">Verity</span>
          </Link>
          <Link 
            to="/"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 text-violet-300 text-sm font-medium mb-8">
            <BookOpen className="w-4 h-4" />
            Official Whitepaper
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Verity Protocol
          </h1>
          <p className="text-xl text-white/60 mb-4">
            The Platform Oversight Hub for XRP Ledger
          </p>
          <p className="text-lg text-violet-400 font-medium mb-8">
            Verified Financial Operating System
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-white/40">
            <span>Version 1.0.0</span>
            <span>•</span>
            <span>January 2026</span>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Supply', value: '1B VRTY' },
            { label: 'Blockchain', value: 'XRP Ledger' },
            { label: 'Transaction Time', value: '3-5 sec' },
            { label: 'Jurisdictions', value: '200+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Table of Contents */}
          <div className="bg-white/5 rounded-2xl p-8 mb-12 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">Table of Contents</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                '1. Executive Summary',
                '2. Problem Statement',
                '3. Solution Overview',
                '4. Technical Architecture',
                '5. VRTY Token Economics',
                '6. Governance Model',
                '7. Compliance Framework',
                '8. Product Features',
                '9. Roadmap',
                '10. Team',
                '11. Token Distribution',
                '12. Risk Factors',
                '13. Conclusion',
              ].map((item) => (
                <a 
                  key={item} 
                  href={`#section-${item.split('.')[0]}`}
                  className="text-white/70 hover:text-violet-400 transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <section id="section-1" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">1</span>
              Executive Summary
            </h2>
            
            <div className="prose prose-invert max-w-none">
              <h3 className="text-xl font-semibold text-white mb-4">Vision</h3>
              <p className="text-white/70 mb-6 leading-relaxed">
                Verity Protocol is a hybrid financial platform built natively on the XRP Ledger (XRPL) 
                that serves as the trusted infrastructure layer for compliant asset tokenization, 
                social coordination, and automated treasury management.
              </p>
              <p className="text-white/70 mb-6 leading-relaxed">
                We bridge the gap between traditional finance's regulatory requirements and blockchain's 
                transparency and efficiency, creating a platform where institutional compliance meets 
                decentralized innovation.
              </p>
              <blockquote className="border-l-4 border-violet-500 pl-6 my-8 italic text-white/80">
                <strong>"Verity"</strong> — Latin for <em>Truth</em> — reflects our core mission: 
                providing verifiable truth in every transaction.
              </blockquote>

              <h3 className="text-xl font-semibold text-white mb-4">The Opportunity</h3>
              <p className="text-white/70 mb-6 leading-relaxed">
                The global tokenization market is projected to reach <strong className="text-violet-400">$16 trillion by 2030</strong> (Boston Consulting Group), 
                yet adoption remains hampered by regulatory uncertainty, poor user experience, 
                lack of standardized tax reporting, and absence of institutional-grade compliance mechanisms.
              </p>

              <h3 className="text-xl font-semibold text-white mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-8">
                {[
                  { label: 'Total Token Supply', value: '1,000,000,000 VRTY' },
                  { label: 'Blockchain', value: 'XRP Ledger (Mainnet)' },
                  { label: 'Transaction Finality', value: '3-5 seconds' },
                  { label: 'Transaction Cost', value: '~$0.0001' },
                  { label: 'Jurisdictions Supported', value: '200+' },
                  { label: 'Carbon Footprint', value: 'Carbon-neutral' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-white/50 mb-1">{metric.label}</div>
                    <div className="text-white font-medium">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: Problem Statement */}
          <section id="section-2" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">2</span>
              Problem Statement
            </h2>
            
            <div className="space-y-8">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-3">The Compliance Paradox</h3>
                <p className="text-white/70 leading-relaxed">
                  Blockchain promises transparency and trust, yet the asset tokenization industry faces a fundamental paradox:
                  <strong className="text-red-400 block mt-2">
                    Regulators require compliance mechanisms that seem antithetical to decentralization.
                  </strong>
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-3">The Tax Complexity Crisis</h3>
                <p className="text-white/70 mb-4 leading-relaxed">
                  Cryptocurrency users face an impossible tax compliance burden:
                </p>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    74% of crypto users underreport taxes (Chainalysis)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Average audit costs: $10,000-$50,000
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Growing regulatory enforcement globally
                  </li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-3">The User Experience Gap</h3>
                <p className="text-white/70 leading-relaxed">
                  Current blockchain platforms require users to manage private keys, understand gas fees, 
                  navigate complex DeFi interfaces, and trust centralized exchanges with custody.
                  <strong className="text-violet-400 block mt-2">
                    This excludes 95% of potential users who want blockchain benefits without technical complexity.
                  </strong>
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Solution Overview */}
          <section id="section-3" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">3</span>
              Solution Overview
            </h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Hybrid Architecture</h3>
                <div className="bg-slate-900 rounded-xl p-6 border border-white/10 font-mono text-sm overflow-x-auto">
                  <pre className="text-green-400">
{`┌─────────────────────────────────────────────────────┐
│              APPLICATION LAYER                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │  Simple   │  │    Pro    │  │    Dev    │       │
│  │   Mode    │  │   Mode    │  │   Mode    │       │
│  └───────────┘  └───────────┘  └───────────┘       │
├─────────────────────────────────────────────────────┤
│                SERVICE LAYER                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ Auto-Tax™ │  │  KYC/AML  │  │    AI     │       │
│  │  Engine   │  │  Gateway  │  │ Sentinel  │       │
│  └───────────┘  └───────────┘  └───────────┘       │
│        (Centralized where legally required)         │
├─────────────────────────────────────────────────────┤
│               PROTOCOL LAYER                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │  XAO-DOW  │  │Native DEX │  │ Multi-Sig │       │
│  │ (XLS-39D) │  │  Trading  │  │ Treasury  │       │
│  └───────────┘  └───────────┘  └───────────┘       │
│           (100% Decentralized on XRPL)              │
└─────────────────────────────────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Why XRP Ledger?</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 text-white/50 font-medium">Feature</th>
                        <th className="text-center py-3 text-violet-400 font-medium">XRPL</th>
                        <th className="text-center py-3 text-white/50 font-medium">Ethereum</th>
                        <th className="text-center py-3 text-white/50 font-medium">Solana</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/70">
                      <tr className="border-b border-white/5">
                        <td className="py-3">Transaction Time</td>
                        <td className="text-center text-green-400">3-5 sec</td>
                        <td className="text-center">12-15 sec</td>
                        <td className="text-center">0.4 sec</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-3">Transaction Cost</td>
                        <td className="text-center text-green-400">$0.0001</td>
                        <td className="text-center">$1-50</td>
                        <td className="text-center">$0.001</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-3">Native DEX</td>
                        <td className="text-center text-green-400">✅ Built-in</td>
                        <td className="text-center text-red-400">❌</td>
                        <td className="text-center text-red-400">❌</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-3">Clawback (XLS-39D)</td>
                        <td className="text-center text-green-400">✅ Native</td>
                        <td className="text-center text-red-400">❌</td>
                        <td className="text-center text-red-400">❌</td>
                      </tr>
                      <tr>
                        <td className="py-3">Regulatory Clarity</td>
                        <td className="text-center text-green-400">✅ Clear</td>
                        <td className="text-center text-yellow-400">⚠️</td>
                        <td className="text-center text-yellow-400">⚠️</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {
                    icon: Users,
                    title: 'Simple Mode',
                    desc: 'Email signup, managed custody, guided workflows for beginners',
                  },
                  {
                    icon: Zap,
                    title: 'Pro Mode',
                    desc: 'Direct wallet connection, full self-custody, advanced features',
                  },
                  {
                    icon: BarChart3,
                    title: 'Developer Mode',
                    desc: 'Full API access, white-label options, enterprise support',
                  },
                ].map((mode) => (
                  <div key={mode.title} className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <mode.icon className="w-8 h-8 text-violet-400 mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">{mode.title}</h4>
                    <p className="text-sm text-white/60">{mode.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 5: Token Economics */}
          <section id="section-5" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">5</span>
              VRTY Token Economics
            </h2>
            
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Name', value: 'Verity Protocol Token' },
                  { label: 'Symbol', value: 'VRTY' },
                  { label: 'Total Supply', value: '1,000,000,000 (fixed)' },
                  { label: 'Decimals', value: '6' },
                  { label: 'Blockchain', value: 'XRP Ledger' },
                  { label: 'Issuer Address', value: 'rBeHfq...SxAH8f' },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 rounded-lg p-4 border border-white/10 flex justify-between">
                    <span className="text-white/50">{item.label}</span>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Token Distribution</h3>
                <div className="space-y-4">
                  <div className="bg-violet-600/20 rounded-lg p-4 border border-violet-500/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">Protocol Treasury</span>
                      <span className="text-violet-400 font-bold">65%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-violet-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <p className="text-sm text-white/50 mt-2">650,000,000 VRTY — Ecosystem development, grants, liquidity</p>
                  </div>
                  <div className="bg-indigo-600/20 rounded-lg p-4 border border-indigo-500/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">Founder</span>
                      <span className="text-indigo-400 font-bold">20%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                    </div>
                    <p className="text-sm text-white/50 mt-2">200,000,000 VRTY — 4-year vesting, 1-year cliff</p>
                  </div>
                  <div className="bg-cyan-600/20 rounded-lg p-4 border border-cyan-500/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">Ecosystem Fund</span>
                      <span className="text-cyan-400 font-bold">15%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                    </div>
                    <p className="text-sm text-white/50 mt-2">150,000,000 VRTY — Developer grants, marketing, partnerships</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Staking Tiers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 text-white/50">Tier</th>
                        <th className="text-right py-3 text-white/50">VRTY Required</th>
                        <th className="text-left py-3 text-white/50 pl-4">Benefits</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/70">
                      <tr className="border-b border-white/5">
                        <td className="py-3 text-amber-600 font-medium">Bronze</td>
                        <td className="text-right">1,000</td>
                        <td className="pl-4">10% fee discount</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-3 text-slate-400 font-medium">Silver</td>
                        <td className="text-right">10,000</td>
                        <td className="pl-4">25% fee discount, governance boost</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-3 text-yellow-500 font-medium">Gold</td>
                        <td className="text-right">100,000</td>
                        <td className="pl-4">40% fee discount, early features</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-violet-400 font-medium">Platinum</td>
                        <td className="text-right">1,000,000</td>
                        <td className="pl-4">50% fee discount, priority support</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Section 8: Product Features */}
          <section id="section-8" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">8</span>
              Product Features
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Shield,
                  title: 'Asset Tokenization',
                  items: ['Real Estate', 'Private Equity', 'Securities', 'Creator Economy'],
                  highlight: 'Minimum Investment: $10',
                },
                {
                  icon: Zap,
                  title: 'Auto-Tax™ Engine',
                  items: ['IRS 8949 Reports', 'FIFO/LIFO/HIFO', 'Real-time Calculations', 'Audit Trail'],
                  highlight: '200+ Jurisdictions',
                },
                {
                  icon: Users,
                  title: 'Guild Treasury',
                  items: ['Multi-sig Control', 'Payment Workflows', 'Revenue Sharing', 'Cross-border Payments'],
                  highlight: 'DAO Management',
                },
                {
                  icon: Globe,
                  title: 'Cross-Chain Bridge',
                  items: ['XRP Ledger (Native)', 'Solana (wVRTY)', 'Ethereum (Planned)', '1:1 Backing'],
                  highlight: 'Lock & Mint',
                },
              ].map((feature) => (
                <div key={feature.title} className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <feature.icon className="w-10 h-10 text-violet-400 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <ul className="space-y-2 mb-4">
                    {feature.items.map((item) => (
                      <li key={item} className="text-white/60 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="inline-block px-3 py-1 bg-violet-500/20 rounded-full text-violet-300 text-sm">
                    {feature.highlight}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 9: Roadmap */}
          <section id="section-9" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-lg">9</span>
              Roadmap
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Completed
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    'XRPL Integration',
                    'Auto-Tax™ Engine',
                    'AI Sentinel v1',
                    'Fee Relayer System',
                    'XRPL Escrow & Vesting',
                    'All 7 Platform Dashboards',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-white/70 bg-green-500/10 rounded-lg px-4 py-2 border border-green-500/20">
                      <span className="text-green-400">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  In Progress — Q1 2026
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    'Token Escrow Setup',
                    'XRPL DEX Listing',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-white/70 bg-yellow-500/10 rounded-lg px-4 py-2 border border-yellow-500/20">
                      <span className="text-yellow-400">◐</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white/50 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white/30"></span>
                  Planned — Q2-Q4 2026
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    'wVRTY Solana Mainnet',
                    'Mobile Applications',
                    'Enterprise Features',
                    'Full Platform Launch',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-white/50 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
                      <span>○</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="mb-16">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Important Disclaimer
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                This whitepaper is for informational purposes only and does not constitute financial, 
                legal, or investment advice. VRTY tokens are utility tokens and do not represent equity, 
                ownership, or any form of security. Token purchases involve significant risk, including 
                the potential loss of all invested capital. Past performance is not indicative of future results.
              </p>
            </div>
          </section>

          {/* Conclusion */}
          <section id="section-13" className="text-center py-12">
            <h2 className="text-3xl font-bold text-white mb-6">The Future of Finance is Verified</h2>
            <p className="text-white/60 max-w-2xl mx-auto mb-8">
              Verity Protocol represents a new paradigm in blockchain infrastructure — 
              one that embraces regulatory compliance as a feature, not a bug.
            </p>
            <Link 
              to="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:scale-105 transition-transform"
            >
              Launch App
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </Link>
          </section>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10 text-center">
        <p className="text-white/40 text-sm">
          © 2026 Verity Protocol. All rights reserved.
        </p>
        <p className="text-white/30 text-xs mt-2">
          Document Version 1.0.0 | Last Updated: January 2026
        </p>
      </footer>
    </div>
  );
}
