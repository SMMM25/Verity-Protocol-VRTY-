import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  Briefcase,
  Landmark,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Upload,
  FileText,
  Shield,
  Globe,
  Info,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Sparkles,
} from 'lucide-react';
import { AssetType } from '../types/assets';

// Step definitions
type WizardStep = 'type' | 'basics' | 'details' | 'compliance' | 'distribution' | 'review' | 'complete';

const STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: 'type', title: 'Asset Type', description: 'Choose the type of asset to tokenize' },
  { id: 'basics', title: 'Basic Info', description: 'Name, symbol, and supply' },
  { id: 'details', title: 'Asset Details', description: 'Specific asset information' },
  { id: 'compliance', title: 'Compliance', description: 'KYC, jurisdictions, and clawback' },
  { id: 'distribution', title: 'Distribution', description: 'Initial allocation settings' },
  { id: 'review', title: 'Review', description: 'Confirm and launch' },
  { id: 'complete', title: 'Complete', description: 'Asset created' },
];

// Asset type options
const ASSET_TYPES = [
  {
    type: AssetType.REAL_ESTATE,
    title: 'Real Estate',
    description: 'Tokenize properties, REITs, and real estate investment funds',
    icon: Building2,
    color: 'blue',
    features: ['Property ownership fractional shares', 'Rental income distribution', 'Property value appreciation'],
    requirements: ['Legal entity documentation', 'Property title deed', 'Third-party appraisal', 'Insurance documentation'],
    minInvestment: 10,
    typicalYield: '4-8%',
  },
  {
    type: AssetType.PRIVATE_EQUITY,
    title: 'Private Equity',
    description: 'Company shares, venture capital, and private investment funds',
    icon: Briefcase,
    color: 'purple',
    features: ['Equity representation tokens', 'Cap table management', 'Exit proceeds distribution'],
    requirements: ['Company registration', 'Shareholder agreement', 'Financial statements', 'Legal opinion'],
    minInvestment: 1000,
    typicalYield: 'Variable',
  },
  {
    type: AssetType.SECURITY,
    title: 'Securities',
    description: 'Bonds, notes, and other regulated financial instruments',
    icon: Landmark,
    color: 'green',
    features: ['Fixed income payments', 'Maturity date tracking', 'Credit rating integration'],
    requirements: ['Prospectus document', 'Underwriter certification', 'Rating agency report', 'Regulatory filing'],
    minInvestment: 100,
    typicalYield: '3-6%',
  },
  {
    type: AssetType.COMMUNITY,
    title: 'Community Token',
    description: 'Governance tokens, utility tokens, and community currencies',
    icon: Users,
    color: 'orange',
    features: ['No KYC requirement', 'Governance voting rights', 'Platform utility access'],
    requirements: ['Token economics document', 'Smart contract audit (optional)', 'Community guidelines'],
    minInvestment: 0,
    typicalYield: 'N/A',
  },
];

// Property type options for real estate
const PROPERTY_TYPES = [
  'Commercial Office',
  'Retail Space',
  'Industrial/Warehouse',
  'Residential Multi-family',
  'Hospitality/Hotel',
  'Healthcare Facility',
  'Mixed Use',
  'Land/Development',
];

// Security type options
const SECURITY_TYPES = [
  'Corporate Bond',
  'Municipal Bond',
  'Treasury Note',
  'Convertible Note',
  'Preferred Stock',
  'Asset-Backed Security',
  'Green Bond',
  'Structured Product',
];

// Jurisdictions
const JURISDICTIONS = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'EU', name: 'European Union', flag: '🇪🇺' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
];

// Form data interface
interface FormData {
  // Type selection
  assetType: AssetType | null;
  
  // Basic info
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  decimals: number;
  website: string;
  
  // Real estate details
  propertyAddress: string;
  propertyType: string;
  squareFootage: string;
  yearBuilt: string;
  valuationUSD: string;
  annualRentIncome: string;
  occupancyRate: string;
  legalEntity: string;
  
  // Private equity details
  companyName: string;
  equityPercentage: string;
  fundSize: string;
  investmentStage: string;
  
  // Security details
  securityType: string;
  maturityDate: string;
  couponRate: string;
  creditRating: string;
  cusipNumber: string;
  isinNumber: string;
  
  // Compliance
  requiresKYC: boolean;
  enableClawback: boolean;
  jurisdictions: string[];
  accreditedOnly: boolean;
  qualifiedPurchaserOnly: boolean;
  maxInvestorsPerJurisdiction: string;
  
  // Distribution
  minInvestmentUSD: string;
  dividendYield: string;
  dividendFrequency: string;
  reservePercentage: string;
  lockupPeriodDays: string;
  
  // Documents
  documents: Array<{ name: string; type: string; file: File | null }>;
}

const initialFormData: FormData = {
  assetType: null,
  name: '',
  symbol: '',
  description: '',
  totalSupply: '',
  decimals: 6,
  website: '',
  propertyAddress: '',
  propertyType: '',
  squareFootage: '',
  yearBuilt: '',
  valuationUSD: '',
  annualRentIncome: '',
  occupancyRate: '',
  legalEntity: '',
  companyName: '',
  equityPercentage: '',
  fundSize: '',
  investmentStage: '',
  securityType: '',
  maturityDate: '',
  couponRate: '',
  creditRating: '',
  cusipNumber: '',
  isinNumber: '',
  requiresKYC: true,
  enableClawback: true,
  jurisdictions: ['US'],
  accreditedOnly: false,
  qualifiedPurchaserOnly: false,
  maxInvestorsPerJurisdiction: '',
  minInvestmentUSD: '10',
  dividendYield: '',
  dividendFrequency: 'QUARTERLY',
  reservePercentage: '10',
  lockupPeriodDays: '0',
  documents: [],
};

// Calculate tokenization fee
function calculateFee(valuationUSD: number): { fee: number; percentage: number } {
  const percentage = 0.0025; // 0.25%
  let fee = valuationUSD * percentage;
  fee = Math.max(fee, 100); // Minimum $100
  fee = Math.min(fee, 25000); // Maximum $25,000
  return { fee, percentage: percentage * 100 };
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface AssetIssuanceWizardProps {
  onClose: () => void;
  onComplete?: (assetId: string) => void;
}

export default function AssetIssuanceWizard({ onClose, onComplete }: AssetIssuanceWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  // Mutation for creating asset
  const createAssetMutation = useMutation({
    mutationFn: async () => {
      // In demo mode, simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { data: { id: 'asset_demo_' + Date.now() } };
    },
    onSuccess: (data) => {
      setCreatedAssetId(data.data.id);
      setCurrentStep('complete');
      onComplete?.(data.data.id);
    },
  });

  // Update form data
  const updateForm = useCallback((updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    Object.keys(updates).forEach(key => {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    });
  }, []);

  // Validate current step
  const validateStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 'type':
        if (!formData.assetType) {
          newErrors.assetType = 'Please select an asset type';
        }
        break;

      case 'basics':
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.symbol.trim()) newErrors.symbol = 'Symbol is required';
        else if (!/^[A-Z0-9]{2,10}$/.test(formData.symbol)) {
          newErrors.symbol = 'Symbol must be 2-10 uppercase letters/numbers';
        }
        if (!formData.totalSupply) newErrors.totalSupply = 'Total supply is required';
        else if (Number(formData.totalSupply) <= 0) {
          newErrors.totalSupply = 'Total supply must be positive';
        }
        if (!formData.description.trim()) newErrors.description = 'Description is required';
        break;

      case 'details':
        if (formData.assetType === AssetType.REAL_ESTATE) {
          if (!formData.propertyAddress.trim()) newErrors.propertyAddress = 'Property address is required';
          if (!formData.propertyType) newErrors.propertyType = 'Property type is required';
          if (!formData.valuationUSD) newErrors.valuationUSD = 'Valuation is required';
        } else if (formData.assetType === AssetType.PRIVATE_EQUITY) {
          if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
          if (!formData.valuationUSD) newErrors.valuationUSD = 'Valuation is required';
        } else if (formData.assetType === AssetType.SECURITY) {
          if (!formData.securityType) newErrors.securityType = 'Security type is required';
          if (!formData.valuationUSD) newErrors.valuationUSD = 'Face value is required';
        }
        break;

      case 'compliance':
        if (formData.assetType !== AssetType.COMMUNITY) {
          if (formData.jurisdictions.length === 0) {
            newErrors.jurisdictions = 'Select at least one jurisdiction';
          }
        }
        break;

      case 'distribution':
        if (!formData.minInvestmentUSD) newErrors.minInvestmentUSD = 'Minimum investment is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  // Navigation
  const goNext = useCallback(() => {
    if (!validateStep()) return;

    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex < STEPS.length - 2) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  }, [currentStep, validateStep]);

  const goBack = useCallback(() => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(() => {
    if (!validateStep()) return;
    createAssetMutation.mutate();
  }, [validateStep, createAssetMutation]);

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Calculate fee preview
  const feePreview = formData.valuationUSD 
    ? calculateFee(Number(formData.valuationUSD))
    : null;

  // Get color classes for selected asset type
  const selectedType = ASSET_TYPES.find(t => t.type === formData.assetType);
  const colorClasses: Record<string, { bg: string; text: string; border: string; light: string }> = {
    blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', light: 'bg-blue-50' },
    purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600', light: 'bg-purple-50' },
    green: { bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-600', light: 'bg-green-50' },
    orange: { bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-600', light: 'bg-orange-50' },
  };
  const typeColor = selectedType ? colorClasses[selectedType.color] : colorClasses.blue;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Asset Tokenization Wizard
            </h2>
            <p className="text-sm text-indigo-100 mt-0.5">
              {STEPS[currentStepIndex]?.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        {currentStep !== 'complete' && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              {STEPS.slice(0, -1).map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className={`text-xs mt-1 font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {step.title}
                      </div>
                    </div>
                    {index < STEPS.length - 2 && (
                      <div className={`w-16 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Asset Type Selection */}
          {currentStep === 'type' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Choose Asset Type</h3>
                <p className="text-gray-600 mt-2">
                  Select the type of real-world asset you want to tokenize on XRPL
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ASSET_TYPES.map(option => {
                  const isSelected = formData.assetType === option.type;
                  const colors = colorClasses[option.color];
                  
                  return (
                    <button
                      key={option.type}
                      onClick={() => updateForm({ assetType: option.type })}
                      className={`text-left p-6 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${colors.border} ${colors.light} shadow-lg`
                          : 'border-gray-200 hover:border-gray-300 hover:shadow'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${isSelected ? colors.bg : 'bg-gray-100'}`}>
                          <option.icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{option.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                          
                          <div className="mt-4 space-y-1">
                            {option.features.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                                <CheckCircle2 className={`w-4 h-4 ${isSelected ? colors.text : 'text-gray-400'}`} />
                                {feature}
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                            <span>Min: ${option.minInvestment}</span>
                            <span>Typical Yield: {option.typicalYield}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className={`w-6 h-6 ${colors.text}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {errors.assetType && (
                <p className="text-red-500 text-sm text-center">{errors.assetType}</p>
              )}
            </div>
          )}

          {/* Step 2: Basic Information */}
          {currentStep === 'basics' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Basic Information</h3>
                <p className="text-gray-600 mt-2">
                  Define the fundamental properties of your tokenized asset
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="e.g., Manhattan Tower REIT"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token Symbol <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => updateForm({ symbol: e.target.value.toUpperCase() })}
                      placeholder="e.g., MTWR"
                      maxLength={10}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono ${
                        errors.symbol ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.symbol && <p className="text-red-500 text-sm mt-1">{errors.symbol}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Supply <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.totalSupply}
                      onChange={(e) => updateForm({ totalSupply: e.target.value })}
                      placeholder="e.g., 10000000"
                      min="1"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.totalSupply ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.totalSupply && <p className="text-red-500 text-sm mt-1">{errors.totalSupply}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    placeholder="Describe your asset, its value proposition, and investment thesis..."
                    rows={4}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                      errors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Decimal Places
                    </label>
                    <select
                      value={formData.decimals}
                      onChange={(e) => updateForm({ decimals: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0}>0 (Whole tokens only)</option>
                      <option value={2}>2 (Like dollars)</option>
                      <option value={6}>6 (Default)</option>
                      <option value={8}>8 (High precision)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => updateForm({ website: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Asset Details */}
          {currentStep === 'details' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">
                  {formData.assetType === AssetType.REAL_ESTATE && 'Property Details'}
                  {formData.assetType === AssetType.PRIVATE_EQUITY && 'Investment Details'}
                  {formData.assetType === AssetType.SECURITY && 'Security Details'}
                  {formData.assetType === AssetType.COMMUNITY && 'Token Details'}
                </h3>
                <p className="text-gray-600 mt-2">
                  Provide specific information about your asset
                </p>
              </div>

              {/* Real Estate Details */}
              {formData.assetType === AssetType.REAL_ESTATE && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Property Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.propertyAddress}
                      onChange={(e) => updateForm({ propertyAddress: e.target.value })}
                      placeholder="123 Main Street, City, State ZIP"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.propertyAddress ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.propertyAddress && <p className="text-red-500 text-sm mt-1">{errors.propertyAddress}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Property Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.propertyType}
                        onChange={(e) => updateForm({ propertyType: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                          errors.propertyType ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select type...</option>
                        {PROPERTY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      {errors.propertyType && <p className="text-red-500 text-sm mt-1">{errors.propertyType}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valuation (USD) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={formData.valuationUSD}
                          onChange={(e) => updateForm({ valuationUSD: e.target.value })}
                          placeholder="450000000"
                          className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                            errors.valuationUSD ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {errors.valuationUSD && <p className="text-red-500 text-sm mt-1">{errors.valuationUSD}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Square Footage
                      </label>
                      <input
                        type="number"
                        value={formData.squareFootage}
                        onChange={(e) => updateForm({ squareFootage: e.target.value })}
                        placeholder="50000"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year Built
                      </label>
                      <input
                        type="number"
                        value={formData.yearBuilt}
                        onChange={(e) => updateForm({ yearBuilt: e.target.value })}
                        placeholder="2020"
                        min="1800"
                        max={new Date().getFullYear()}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Occupancy Rate (%)
                      </label>
                      <input
                        type="number"
                        value={formData.occupancyRate}
                        onChange={(e) => updateForm({ occupancyRate: e.target.value })}
                        placeholder="95"
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Annual Rent Income (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={formData.annualRentIncome}
                          onChange={(e) => updateForm({ annualRentIncome: e.target.value })}
                          placeholder="5000000"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Legal Entity Name
                      </label>
                      <input
                        type="text"
                        value={formData.legalEntity}
                        onChange={(e) => updateForm({ legalEntity: e.target.value })}
                        placeholder="Property Holdings LLC"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Private Equity Details */}
              {formData.assetType === AssetType.PRIVATE_EQUITY && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company/Fund Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => updateForm({ companyName: e.target.value })}
                      placeholder="TechVentures Growth Fund"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.companyName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.companyName && <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valuation (USD) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={formData.valuationUSD}
                          onChange={(e) => updateForm({ valuationUSD: e.target.value })}
                          placeholder="50000000"
                          className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                            errors.valuationUSD ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {errors.valuationUSD && <p className="text-red-500 text-sm mt-1">{errors.valuationUSD}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Equity Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={formData.equityPercentage}
                        onChange={(e) => updateForm({ equityPercentage: e.target.value })}
                        placeholder="100"
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Investment Stage
                      </label>
                      <select
                        value={formData.investmentStage}
                        onChange={(e) => updateForm({ investmentStage: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select stage...</option>
                        <option value="seed">Seed</option>
                        <option value="series_a">Series A</option>
                        <option value="series_b">Series B</option>
                        <option value="series_c">Series C+</option>
                        <option value="growth">Growth</option>
                        <option value="pre_ipo">Pre-IPO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Legal Entity Name
                      </label>
                      <input
                        type="text"
                        value={formData.legalEntity}
                        onChange={(e) => updateForm({ legalEntity: e.target.value })}
                        placeholder="Fund Management LLC"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Details */}
              {formData.assetType === AssetType.SECURITY && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Security Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.securityType}
                        onChange={(e) => updateForm({ securityType: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                          errors.securityType ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select type...</option>
                        {SECURITY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      {errors.securityType && <p className="text-red-500 text-sm mt-1">{errors.securityType}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Face Value (USD) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={formData.valuationUSD}
                          onChange={(e) => updateForm({ valuationUSD: e.target.value })}
                          placeholder="100000000"
                          className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                            errors.valuationUSD ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {errors.valuationUSD && <p className="text-red-500 text-sm mt-1">{errors.valuationUSD}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Coupon Rate (%)
                      </label>
                      <input
                        type="number"
                        value={formData.couponRate}
                        onChange={(e) => updateForm({ couponRate: e.target.value })}
                        placeholder="5.25"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maturity Date
                      </label>
                      <input
                        type="date"
                        value={formData.maturityDate}
                        onChange={(e) => updateForm({ maturityDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Credit Rating
                      </label>
                      <select
                        value={formData.creditRating}
                        onChange={(e) => updateForm({ creditRating: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select rating...</option>
                        <option value="AAA">AAA</option>
                        <option value="AA+">AA+</option>
                        <option value="AA">AA</option>
                        <option value="AA-">AA-</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="A-">A-</option>
                        <option value="BBB+">BBB+</option>
                        <option value="BBB">BBB</option>
                        <option value="BBB-">BBB- (Investment Grade)</option>
                        <option value="BB+">BB+ (High Yield)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CUSIP Number
                      </label>
                      <input
                        type="text"
                        value={formData.cusipNumber}
                        onChange={(e) => updateForm({ cusipNumber: e.target.value })}
                        placeholder="123456789"
                        maxLength={9}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ISIN Number
                      </label>
                      <input
                        type="text"
                        value={formData.isinNumber}
                        onChange={(e) => updateForm({ isinNumber: e.target.value })}
                        placeholder="US1234567890"
                        maxLength={12}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Community Token Details */}
              {formData.assetType === AssetType.COMMUNITY && (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-orange-900">Community Token Guidelines</div>
                        <p className="text-sm text-orange-700 mt-1">
                          Community tokens don't require KYC and have fewer compliance requirements.
                          They're ideal for governance, utility, and community engagement purposes.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Utility Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateForm({ description: e.target.value })}
                      placeholder="Describe what the token can be used for, governance rights, access it provides..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Fee Preview */}
              {feePreview && formData.assetType !== AssetType.COMMUNITY && (
                <div className="mt-6 p-4 bg-indigo-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Estimated Tokenization Fee</div>
                      <div className="text-xs text-indigo-700">
                        {feePreview.percentage}% of {formatCurrency(Number(formData.valuationUSD))}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {formatCurrency(feePreview.fee)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Compliance */}
          {currentStep === 'compliance' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Compliance Settings</h3>
                <p className="text-gray-600 mt-2">
                  Configure regulatory compliance and investor requirements
                </p>
              </div>

              {formData.assetType !== AssetType.COMMUNITY ? (
                <div className="space-y-6">
                  {/* KYC & Clawback Toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.requiresKYC ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <Shield className={`w-5 h-5 ${formData.requiresKYC ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <div className="font-medium text-gray-900">Require KYC</div>
                          <div className="text-xs text-gray-500">Verify investor identity</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.requiresKYC}
                        onChange={(e) => updateForm({ requiresKYC: e.target.checked })}
                        className="w-5 h-5 rounded text-green-600"
                      />
                    </label>

                    <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.enableClawback ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <Lock className={`w-5 h-5 ${formData.enableClawback ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <div className="font-medium text-gray-900">XLS-39D Clawback</div>
                          <div className="text-xs text-gray-500">Regulatory recovery option</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.enableClawback}
                        onChange={(e) => updateForm({ enableClawback: e.target.checked })}
                        className="w-5 h-5 rounded text-green-600"
                      />
                    </label>
                  </div>

                  {/* Investor Requirements */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Investor Requirements</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${
                        formData.accreditedOnly ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                      }`}>
                        <div>
                          <div className="font-medium text-gray-900">Accredited Investors Only</div>
                          <div className="text-xs text-gray-500">SEC accreditation required</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.accreditedOnly}
                          onChange={(e) => updateForm({ accreditedOnly: e.target.checked })}
                          className="w-5 h-5 rounded text-indigo-600"
                        />
                      </label>

                      <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${
                        formData.qualifiedPurchaserOnly ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                      }`}>
                        <div>
                          <div className="font-medium text-gray-900">Qualified Purchasers Only</div>
                          <div className="text-xs text-gray-500">$5M+ investment assets</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.qualifiedPurchaserOnly}
                          onChange={(e) => updateForm({ qualifiedPurchaserOnly: e.target.checked })}
                          className="w-5 h-5 rounded text-indigo-600"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Jurisdictions */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">
                      Supported Jurisdictions <span className="text-red-500">*</span>
                    </h4>
                    <p className="text-sm text-gray-600">
                      Select jurisdictions where investors can participate. Each jurisdiction has specific regulatory requirements.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {JURISDICTIONS.map(j => (
                        <label
                          key={j.code}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                            formData.jurisdictions.includes(j.code)
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.jurisdictions.includes(j.code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateForm({ jurisdictions: [...formData.jurisdictions, j.code] });
                              } else {
                                updateForm({ jurisdictions: formData.jurisdictions.filter(c => c !== j.code) });
                              }
                            }}
                            className="hidden"
                          />
                          <span className="text-lg">{j.flag}</span>
                          <span className="text-sm font-medium text-gray-700">{j.code}</span>
                        </label>
                      ))}
                    </div>
                    {errors.jurisdictions && <p className="text-red-500 text-sm">{errors.jurisdictions}</p>}
                  </div>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-orange-900">Community Token Compliance</div>
                      <p className="text-sm text-orange-700 mt-2">
                        Community tokens have simplified compliance requirements:
                      </p>
                      <ul className="mt-3 space-y-2">
                        <li className="flex items-center gap-2 text-sm text-orange-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          No KYC requirement
                        </li>
                        <li className="flex items-center gap-2 text-sm text-orange-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          No jurisdictional restrictions
                        </li>
                        <li className="flex items-center gap-2 text-sm text-orange-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Clawback disabled by default
                        </li>
                        <li className="flex items-center gap-2 text-sm text-orange-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Open to all participants
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Distribution */}
          {currentStep === 'distribution' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Distribution Settings</h3>
                <p className="text-gray-600 mt-2">
                  Configure investment minimums and dividend distribution
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Investment (USD) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formData.minInvestmentUSD}
                        onChange={(e) => updateForm({ minInvestmentUSD: e.target.value })}
                        placeholder="10"
                        min="0"
                        className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                          errors.minInvestmentUSD ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    {errors.minInvestmentUSD && <p className="text-red-500 text-sm mt-1">{errors.minInvestmentUSD}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lockup Period (Days)
                    </label>
                    <input
                      type="number"
                      value={formData.lockupPeriodDays}
                      onChange={(e) => updateForm({ lockupPeriodDays: e.target.value })}
                      placeholder="0"
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {formData.assetType !== AssetType.COMMUNITY && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expected Dividend Yield (%)
                        </label>
                        <input
                          type="number"
                          value={formData.dividendYield}
                          onChange={(e) => updateForm({ dividendYield: e.target.value })}
                          placeholder="5.5"
                          step="0.1"
                          min="0"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dividend Frequency
                        </label>
                        <select
                          value={formData.dividendFrequency}
                          onChange={(e) => updateForm({ dividendFrequency: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="SEMI_ANNUAL">Semi-Annual</option>
                          <option value="ANNUAL">Annual</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reserve for Operations (%)
                      </label>
                      <input
                        type="number"
                        value={formData.reservePercentage}
                        onChange={(e) => updateForm({ reservePercentage: e.target.value })}
                        placeholder="10"
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Percentage of tokens reserved for operational expenses and future distributions
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Document Upload Section */}
              {formData.assetType !== AssetType.COMMUNITY && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Required Documents
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Upload required documentation for compliance verification. Documents will be hashed and stored on-chain.
                    </p>
                    <div className="space-y-2">
                      {selectedType?.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <Upload className="w-5 h-5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">{req}</span>
                          </div>
                          <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                            Upload
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      * Document upload is available after initial submission. Demo mode skips document verification.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Review & Confirm</h3>
                <p className="text-gray-600 mt-2">
                  Please review all details before launching your tokenized asset
                </p>
              </div>

              <div className="space-y-4">
                {/* Asset Overview */}
                <div className={`rounded-xl p-6 ${typeColor.light}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${typeColor.bg}`}>
                      {selectedType && <selectedType.icon className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{formData.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-gray-600">{formData.symbol}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor.text} ${typeColor.light}`}>
                          {selectedType?.title}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Total Supply</div>
                    <div className="font-semibold text-gray-900">
                      {Number(formData.totalSupply).toLocaleString()} tokens
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Valuation</div>
                    <div className="font-semibold text-gray-900">
                      {formData.valuationUSD ? formatCurrency(Number(formData.valuationUSD)) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Min Investment</div>
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(Number(formData.minInvestmentUSD))}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Expected Yield</div>
                    <div className="font-semibold text-gray-900">
                      {formData.dividendYield ? `${formData.dividendYield}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Compliance Summary */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h5 className="font-medium text-gray-900 mb-3">Compliance Settings</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      {formData.requiresKYC ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">KYC Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.enableClawback ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">XLS-39D Clawback</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.accreditedOnly ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">Accredited Only</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-indigo-500" />
                      <span className="text-sm text-gray-700">
                        {formData.jurisdictions.length} Jurisdictions
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fee Summary */}
                {feePreview && (
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-indigo-900">Tokenization Fee</h5>
                        <p className="text-sm text-indigo-700">
                          {feePreview.percentage}% of asset value (min $100, max $25,000)
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatCurrency(feePreview.fee)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-yellow-900">Important Notice</div>
                      <p className="text-sm text-yellow-700 mt-1">
                        By proceeding, you confirm that all information provided is accurate and you have 
                        the legal authority to tokenize this asset. The tokenization fee will be deducted 
                        upon successful issuance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Asset Created Successfully!</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Your tokenized asset has been submitted for review. You'll receive a notification once it's approved and live on the marketplace.
              </p>

              {createdAssetId && (
                <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-sm text-gray-500 mb-2">Asset ID</div>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-lg font-mono text-gray-900">{createdAssetId}</code>
                    <button className="p-2 hover:bg-gray-200 rounded-lg">
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  View in Dashboard
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Explorer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep !== 'complete' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <button
              onClick={currentStep === 'type' ? onClose : goBack}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {currentStep === 'type' ? 'Cancel' : 'Back'}
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={createAssetMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {createAssetMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Launch Asset
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                className={`px-6 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 ${typeColor.bg} text-white hover:opacity-90`}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
