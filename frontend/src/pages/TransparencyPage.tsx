/**
 * Verity Protocol - Transparency & Solvency Monitor Page
 * 
 * @description
 * Public page showing cryptographically verifiable transparency data for
 * monitored entities (Issuers, Guilds, Bridges).
 * 
 * @version 1.0.0
 * @since 2026-01-17
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Code,
  Bell,
} from 'lucide-react';

// Types matching the backend
interface TransparencyReport {
  entityId: string;
  entityType: 'ISSUER' | 'GUILD' | 'BRIDGE';
  entityName: string;
  entityDescription?: string;
  addresses: { address: string; role: string; network: string }[];
  assets: {
    total: { currency: string; issuer?: string; balance: string }[];
    byAddress: Record<string, { currency: string; issuer?: string; balance: string }[]>;
  };
  liabilities: { type: string; currency: string; amount: string; description: string }[];
  solvency: {
    status: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
    coverageRatio: number;
    netPosition: string;
    assessmentMethod: string;
  };
  risks: {
    overallLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: {
      id: string;
      level: string;
      category: string;
      title: string;
      description: string;
      detectedAt: string;
      recommendation?: string;
    }[];
    lastAssessment: string;
  };
  evidence: {
    type: string;
    reference: string;
    url?: string;
    description: string;
    timestamp: string;
  }[];
  ledgerState: {
    network: string;
    ledgerIndex: number;
    ledgerHash: string;
    closeTime: string;
  };
  snapshot: {
    version: string;
    entityId: string;
    timestamp: string;
    ledgerIndex: number;
    canonicalData: string;
    signature: string;
    signatureAlgorithm: string;
    publicKeyFingerprint: string;
    verificationUrl: string;
  };
  generatedAt: string;
  expiresAt: string;
  version: string;
}

interface Entity {
  id: string;
  type: string;
  name: string;
  description?: string;
  active: boolean;
  lastChecked?: string;
}

// Status badge component
function StatusBadge({ status }: { status: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN' }) {
  const config = {
    PASS: { icon: CheckCircle, color: 'bg-green-500', text: 'Verified' },
    WARN: { icon: AlertTriangle, color: 'bg-amber-500', text: 'Warning' },
    FAIL: { icon: XCircle, color: 'bg-red-500', text: 'Failed' },
    UNKNOWN: { icon: Activity, color: 'bg-gray-500', text: 'Unknown' },
  };
  
  const { icon: Icon, color, text } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${color} text-white font-semibold`}>
      <Icon className="w-5 h-5" />
      {text}
    </span>
  );
}

// Risk level badge
function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const config = {
    LOW: { color: 'bg-green-100 text-green-800', text: 'Low Risk' },
    MEDIUM: { color: 'bg-amber-100 text-amber-800', text: 'Medium Risk' },
    HIGH: { color: 'bg-orange-100 text-orange-800', text: 'High Risk' },
    CRITICAL: { color: 'bg-red-100 text-red-800', text: 'Critical Risk' },
  };
  
  const { color, text } = config[level];
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {text}
    </span>
  );
}

// Entity list page
function EntityList() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchEntities() {
      try {
        const response = await fetch('/api/v1/transparency/entities');
        const data = await response.json();
        if (data.success) {
          setEntities(data.data.entities);
        } else {
          setError(data.error?.message || 'Failed to load entities');
        }
      } catch (err) {
        setError('Failed to connect to API');
      } finally {
        setLoading(false);
      }
    }
    fetchEntities();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-10 h-10 text-indigo-500" />
          <h1 className="text-4xl font-bold text-gray-900">Transparency Monitor</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Cryptographically verifiable proof of reserves, liabilities, and solvency.
          Trust you can verify.
        </p>
      </div>
      
      {/* Entity Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entities.map(entity => (
          <Link
            key={entity.id}
            to={`/transparency/${entity.id}`}
            className="block bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-gray-100"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                  {entity.type}
                </span>
                <h3 className="text-xl font-semibold text-gray-900 mt-1">{entity.name}</h3>
              </div>
              {entity.active ? (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="text-gray-400 text-sm">Inactive</span>
              )}
            </div>
            
            {entity.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{entity.description}</p>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>View Report →</span>
              {entity.lastChecked && (
                <span>Last checked: {new Date(entity.lastChecked).toLocaleTimeString()}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      {entities.length === 0 && (
        <div className="text-center py-12">
          <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No monitored entities found</p>
        </div>
      )}
    </div>
  );
}

// Detail page for single entity
function EntityDetail({ entityId }: { entityId: string }) {
  const [report, setReport] = useState<TransparencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const fetchReport = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      const url = `/api/v1/transparency/report/${entityId}${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setReport(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load report');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchReport();
  }, [entityId]);
  
  const copyEmbedCode = () => {
    if (report) {
      const embedCode = `<a href="${window.location.origin}/ui/transparency/${entityId}" target="_blank" rel="noopener">
  <img src="${window.location.origin}/api/v1/transparency/badge/${entityId}.svg" alt="Verified by Verity" />
</a>`;
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Unavailable</h2>
          <p className="text-gray-600 mb-4">{error || 'Failed to load transparency report'}</p>
          <Link to="/transparency" className="text-indigo-600 hover:underline">
            ← Back to entities
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link to="/transparency" className="text-indigo-600 hover:underline text-sm mb-2 inline-block">
            ← All Entities
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            <div>
              <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                {report.entityType}
              </span>
              <h1 className="text-3xl font-bold text-gray-900">{report.entityName}</h1>
            </div>
          </div>
          {report.entityDescription && (
            <p className="text-gray-600 mt-2 max-w-xl">{report.entityDescription}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <StatusBadge status={report.solvency.status} />
        </div>
      </div>
      
      {/* Main Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Coverage Ratio */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            {report.solvency.coverageRatio >= 1 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            Coverage Ratio
          </div>
          <div className="text-4xl font-bold text-gray-900">
            {report.solvency.coverageRatio === 999 ? '∞' : `${report.solvency.coverageRatio}x`}
          </div>
          <div className="text-sm text-gray-500 mt-1">Assets / Liabilities</div>
        </div>
        
        {/* Net Position */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Activity className="w-4 h-4" />
            Net Position
          </div>
          <div className="text-2xl font-bold text-gray-900">{report.solvency.netPosition}</div>
          <div className="text-sm text-gray-500 mt-1">Assets minus Liabilities</div>
        </div>
        
        {/* Risk Level */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            Risk Assessment
          </div>
          <div className="mt-2">
            <RiskBadge level={report.risks.overallLevel} />
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {report.risks.flags.length} active flag{report.risks.flags.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      
      {/* Assets & Liabilities */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Assets */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-500" />
            Controlled Assets
          </h3>
          <div className="space-y-3">
            {report.assets.total.map((asset, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="font-medium text-gray-700">
                  {asset.currency}
                  {asset.issuer && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({asset.issuer.substring(0, 8)}...)
                    </span>
                  )}
                </span>
                <span className="font-mono text-gray-900">{parseFloat(asset.balance).toLocaleString()}</span>
              </div>
            ))}
            {report.assets.total.length === 0 && (
              <p className="text-gray-500 text-sm">No assets found</p>
            )}
          </div>
        </div>
        
        {/* Liabilities */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Unlock className="w-5 h-5 text-amber-500" />
            Liabilities / Obligations
          </h3>
          <div className="space-y-3">
            {report.liabilities.map((liability, i) => (
              <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">{liability.currency}</span>
                  <span className="font-mono text-gray-900">{parseFloat(liability.amount).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{liability.description}</p>
              </div>
            ))}
            {report.liabilities.length === 0 && (
              <p className="text-gray-500 text-sm">No liabilities found</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Risk Flags */}
      {report.risks.flags.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Risk Flags
          </h3>
          <div className="space-y-4">
            {report.risks.flags.map((flag, i) => (
              <div key={i} className={`p-4 rounded-lg ${
                flag.level === 'CRITICAL' ? 'bg-red-50 border border-red-200' :
                flag.level === 'HIGH' ? 'bg-orange-50 border border-orange-200' :
                flag.level === 'MEDIUM' ? 'bg-amber-50 border border-amber-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{flag.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                    {flag.recommendation && (
                      <p className="text-sm text-indigo-600 mt-2">
                        <strong>Recommendation:</strong> {flag.recommendation}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    flag.level === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                    flag.level === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                    flag.level === 'MEDIUM' ? 'bg-amber-200 text-amber-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {flag.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Evidence Links */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-indigo-500" />
          Verification Evidence
        </h3>
        <div className="space-y-3">
          {report.evidence.map((evidence, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <span className="text-xs font-medium text-indigo-600 uppercase">{evidence.type}</span>
                <p className="text-gray-700">{evidence.description}</p>
              </div>
              {evidence.url && (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:underline text-sm"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
        
        {/* Ledger State */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Ledger State at Time of Report</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Network</span>
              <p className="font-medium">{report.ledgerState.network}</p>
            </div>
            <div>
              <span className="text-gray-500">Ledger Index</span>
              <p className="font-mono">{report.ledgerState.ledgerIndex}</p>
            </div>
            <div>
              <span className="text-gray-500">Ledger Hash</span>
              <p className="font-mono text-xs truncate">{report.ledgerState.ledgerHash}</p>
            </div>
            <div>
              <span className="text-gray-500">Close Time</span>
              <p className="font-medium">{new Date(report.ledgerState.closeTime).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Embeddable Badge */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Code className="w-5 h-5" />
              Embed "Verified by Verity" Badge
            </h3>
            <p className="text-indigo-100 text-sm">
              Add this badge to your website to show your transparency status to users.
            </p>
          </div>
          <img
            src={`/api/v1/transparency/badge/${entityId}.svg`}
            alt="Verified by Verity badge"
            className="h-8"
          />
        </div>
        
        <div className="mt-4">
          <button
            onClick={() => setShowEmbedCode(!showEmbedCode)}
            className="text-sm underline text-indigo-100 hover:text-white"
          >
            {showEmbedCode ? 'Hide embed code' : 'Show embed code'}
          </button>
          
          {showEmbedCode && (
            <div className="mt-3">
              <div className="bg-black/20 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code>{`<a href="${window.location.origin}/ui/transparency/${entityId}">
  <img src="${window.location.origin}/api/v1/transparency/badge/${entityId}.svg" alt="Verified by Verity" />
</a>`}</code>
              </div>
              <button
                onClick={copyEmbedCode}
                className="mt-2 flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy code'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Signed Snapshot */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          Cryptographic Verification
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          This report is cryptographically signed. Third parties can verify the data hasn't been tampered with.
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Signature Algorithm</span>
            <p className="font-mono">{report.snapshot.signatureAlgorithm}</p>
          </div>
          <div>
            <span className="text-gray-500">Public Key Fingerprint</span>
            <p className="font-mono">{report.snapshot.publicKeyFingerprint}</p>
          </div>
          <div>
            <span className="text-gray-500">Snapshot Timestamp</span>
            <p className="font-medium">{new Date(report.snapshot.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Verification URL</span>
            <a
              href={`/api/v1/transparency/verify/${entityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline flex items-center gap-1"
            >
              Verify Snapshot <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
              View signature (for developers)
            </summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto font-mono">
              {report.snapshot.signature}
            </pre>
          </details>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Report generated at {new Date(report.generatedAt).toLocaleString()} •
          Expires at {new Date(report.expiresAt).toLocaleString()} •
          Version {report.version}
        </p>
      </div>
    </div>
  );
}

// Main component with routing
export default function TransparencyPage() {
  const { entityId } = useParams<{ entityId?: string }>();
  
  if (entityId) {
    return <EntityDetail entityId={entityId} />;
  }
  
  return <EntityList />;
}
