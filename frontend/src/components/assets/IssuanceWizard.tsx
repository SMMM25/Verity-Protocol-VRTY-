/**
 * Verity Protocol - Asset Issuance Wizard
 * Multi-step wizard for tokenizing real-world assets
 * Supports: Real Estate, Private Equity, Securities, Community Tokens
 */

import { useState, useCallback } from 'react';
import {
  Building2,
  Briefcase,
  Landmark,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  FileText,
  Shield,
  Globe,
  DollarSign,
  Upload,
  Coins,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { assetsApi } from '../../api/client';
// Asset types are defined locally in AssetCategory

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
  isCompleted: boolean;
  isActive: boolean;
}

type AssetCategory = 'REAL_ESTATE' | 'PRIVATE_EQUITY' | 'SECURITIES' | 'COMMUNITY';

interface RealEstateFormData {
  // Property Details
  propertyAddress: string;
  propertyType: 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'LAND' | 'MIXED_USE';
  squareFootage: string;
  yearBuilt: string;
  occupancyRate: string;
  annualRentIncome: string;
  // Valuation
  valuationUSD: string;
  appraisalDate: string;
  appraisalProvider: string;
  // Legal
  legalEntity: string;
  propertyManagement: string;
  // Insurance
  insuranceProvider: string;
  insuranceCoverage: string;
  insuranceExpiry: string;
}

interface PrivateEquityFormData {
  // Company Details
  companyName: string;
  companyDescription: string;
  industry: string;
  foundedYear: string;
  headquarters: string;
  // Financials
  valuationUSD: string;
  equityPercentage: string;
  annualRevenue: string;
  ebitda: string;
  // Legal
  legalEntity: string;
  boardSeats: string;
}

interface SecuritiesFormData {
  // Security Details
  securityType: 'BOND' | 'NOTE' | 'PREFERRED_STOCK' | 'CONVERTIBLE';
  issuerName: string;
  // Identification
  cusipNumber: string;
  isinNumber: string;
  // Financial Terms
  valuationUSD: string;
  couponRate: string;
  maturityDate: string;
  faceValue: string;
  // Rating
  ratingAgency: string;
  creditRating: string;
}

interface CommunityFormData {
  description: string;
  website: string;
  twitter: string;
  discord: string;
  governance: 'DAO' | 'MULTISIG' | 'NONE';
}

interface TokenFormData {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: string;
  tokenPriceUSD: string;
}

interface ComplianceFormData {
  jurisdictions: string[];
  requiresKYC: boolean;
  accreditedOnly: boolean;
  qualifiedPurchaserOnly: boolean;
  enableClawback: boolean;
  maxInvestors: string;
  minInvestmentUSD: string;
  holdingPeriodDays: string;
}

interface DividendFormData {
  enableDividends: boolean;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  expectedYield: string;
  paymentCurrency: 'XRP' | 'VRTY' | 'USD';
  autoDistribute: boolean;
}

interface DocumentsFormData {
  titleDeed: File | null;
  appraisalReport: File | null;
  legalOpinion: File | null;
  financialStatements: File | null;
  insuranceCertificate: File | null;
  memorandum: File | null;
  prospectus: File | null;
}

// FormDataByCategory can be used for form type mapping
type FormDataByCategory = {
  REAL_ESTATE: RealEstateFormData;
  PRIVATE_EQUITY: PrivateEquityFormData;
  SECURITIES: SecuritiesFormData;
  COMMUNITY: CommunityFormData;
};

// Export to prevent unused warning
export type { FormDataByCategory };

interface IssuanceWizardProps {
  onComplete?: (assetId: string) => void;
  onCancel?: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const ASSET_CATEGORIES = [
  {
    id: 'REAL_ESTATE' as const,
    title: 'Real Estate',
    description: 'Tokenize properties, REITs, and real estate funds',
    icon: Building2,
    color: 'blue',
    features: ['Fractional ownership', 'Rental income distribution', 'Property management'],
    minTokenization: '$100,000',
    compliance: ['KYC Required', 'XLS-39D Clawback'],
  },
  {
    id: 'PRIVATE_EQUITY' as const,
    title: 'Private Equity',
    description: 'Tokenize company shares and investment funds',
    icon: Briefcase,
    color: 'purple',
    features: ['Equity representation', 'Cap table management', 'Exit proceeds'],
    minTokenization: '$50,000',
    compliance: ['KYC Required', 'Accredited Investors Only'],
  },
  {
    id: 'SECURITIES' as const,
    title: 'Securities',
    description: 'Bonds, notes, and regulated securities',
    icon: Landmark,
    color: 'green',
    features: ['Coupon payments', 'Maturity tracking', 'Rating integration'],
    minTokenization: '$25,000',
    compliance: ['KYC Required', 'SEC/FINRA Compliance'],
  },
  {
    id: 'COMMUNITY' as const,
    title: 'Community Token',
    description: 'Governance and utility tokens',
    icon: Users,
    color: 'orange',
    features: ['No KYC required', 'Governance voting', 'Utility features'],
    minTokenization: 'None',
    compliance: ['Optional Clawback'],
  },
];

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

const PROPERTY_TYPES = [
  { id: 'COMMERCIAL', label: 'Commercial Office' },
  { id: 'RESIDENTIAL', label: 'Residential' },
  { id: 'INDUSTRIAL', label: 'Industrial/Warehouse' },
  { id: 'LAND', label: 'Land' },
  { id: 'MIXED_USE', label: 'Mixed Use' },
];

const SECURITY_TYPES = [
  { id: 'BOND', label: 'Bond' },
  { id: 'NOTE', label: 'Note' },
  { id: 'PREFERRED_STOCK', label: 'Preferred Stock' },
  { id: 'CONVERTIBLE', label: 'Convertible Security' },
];

const DEFAULT_REAL_ESTATE: RealEstateFormData = {
  propertyAddress: '',
  propertyType: 'COMMERCIAL',
  squareFootage: '',
  yearBuilt: '',
  occupancyRate: '',
  annualRentIncome: '',
  valuationUSD: '',
  appraisalDate: '',
  appraisalProvider: '',
  legalEntity: '',
  propertyManagement: '',
  insuranceProvider: '',
  insuranceCoverage: '',
  insuranceExpiry: '',
};

const DEFAULT_PRIVATE_EQUITY: PrivateEquityFormData = {
  companyName: '',
  companyDescription: '',
  industry: '',
  foundedYear: '',
  headquarters: '',
  valuationUSD: '',
  equityPercentage: '',
  annualRevenue: '',
  ebitda: '',
  legalEntity: '',
  boardSeats: '',
};

const DEFAULT_SECURITIES: SecuritiesFormData = {
  securityType: 'BOND',
  issuerName: '',
  cusipNumber: '',
  isinNumber: '',
  valuationUSD: '',
  couponRate: '',
  maturityDate: '',
  faceValue: '',
  ratingAgency: '',
  creditRating: '',
};

const DEFAULT_COMMUNITY: CommunityFormData = {
  description: '',
  website: '',
  twitter: '',
  discord: '',
  governance: 'DAO',
};

const DEFAULT_TOKEN: TokenFormData = {
  name: '',
  symbol: '',
  totalSupply: '',
  decimals: '6',
  tokenPriceUSD: '',
};

const DEFAULT_COMPLIANCE: ComplianceFormData = {
  jurisdictions: ['US'],
  requiresKYC: true,
  accreditedOnly: false,
  qualifiedPurchaserOnly: false,
  enableClawback: true,
  maxInvestors: '',
  minInvestmentUSD: '',
  holdingPeriodDays: '',
};

const DEFAULT_DIVIDENDS: DividendFormData = {
  enableDividends: true,
  frequency: 'QUARTERLY',
  expectedYield: '',
  paymentCurrency: 'XRP',
  autoDistribute: true,
};

const DEFAULT_DOCUMENTS: DocumentsFormData = {
  titleDeed: null,
  appraisalReport: null,
  legalOpinion: null,
  financialStatements: null,
  insuranceCertificate: null,
  memorandum: null,
  prospectus: null,
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StepIndicator({ steps, currentStep: _currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
            step.isCompleted 
              ? 'bg-green-500 border-green-500 text-white' 
              : step.isActive 
                ? 'bg-indigo-600 border-indigo-600 text-white' 
                : 'bg-white border-gray-300 text-gray-500'
          }`}>
            {step.isCompleted ? (
              <Check className="w-5 h-5" />
            ) : (
              <span className="text-sm font-medium">{index + 1}</span>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={`w-12 h-1 mx-2 rounded ${
              step.isCompleted ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FormField({ 
  label, 
  required = false, 
  error, 
  hint,
  children 
}: { 
  label: string; 
  required?: boolean; 
  error?: string; 
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function ToggleSwitch({ 
  checked, 
  onChange, 
  label,
  description 
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void; 
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <div className="font-medium text-gray-900">{label}</div>
        {description && <div className="text-sm text-gray-500">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function FileUploadField({
  label,
  accept,
  file,
  onChange,
  required,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <FormField label={label} required={required}>
      <div className="mt-1">
        {file ? (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-gray-400 hover:text-red-500"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <p className="mt-1 text-sm text-gray-500">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-400">{accept}</p>
            </div>
            <input
              type="file"
              accept={accept}
              onChange={(e) => onChange(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        )}
      </div>
    </FormField>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function IssuanceWizard({ onComplete, onCancel }: IssuanceWizardProps) {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  // Form data states
  const [realEstateData, setRealEstateData] = useState<RealEstateFormData>(DEFAULT_REAL_ESTATE);
  const [privateEquityData, setPrivateEquityData] = useState<PrivateEquityFormData>(DEFAULT_PRIVATE_EQUITY);
  const [securitiesData, setSecuritiesData] = useState<SecuritiesFormData>(DEFAULT_SECURITIES);
  const [communityData, setCommunityData] = useState<CommunityFormData>(DEFAULT_COMMUNITY);
  const [tokenData, setTokenData] = useState<TokenFormData>(DEFAULT_TOKEN);
  const [complianceData, setComplianceData] = useState<ComplianceFormData>(DEFAULT_COMPLIANCE);
  const [dividendData, setDividendData] = useState<DividendFormData>(DEFAULT_DIVIDENDS);
  const [documentsData, setDocumentsData] = useState<DocumentsFormData>(DEFAULT_DOCUMENTS);

  // Define steps based on selected category
  const getSteps = useCallback((): WizardStep[] => {
    const baseSteps: WizardStep[] = [
      {
        id: 'category',
        title: 'Asset Type',
        description: 'Select the type of asset to tokenize',
        icon: Coins,
        isCompleted: selectedCategory !== null,
        isActive: currentStep === 0,
      },
      {
        id: 'details',
        title: 'Asset Details',
        description: 'Enter asset-specific information',
        icon: FileText,
        isCompleted: currentStep > 1,
        isActive: currentStep === 1,
      },
      {
        id: 'token',
        title: 'Token Setup',
        description: 'Configure token parameters',
        icon: Coins,
        isCompleted: currentStep > 2,
        isActive: currentStep === 2,
      },
      {
        id: 'compliance',
        title: 'Compliance',
        description: 'Set compliance and restrictions',
        icon: Shield,
        isCompleted: currentStep > 3,
        isActive: currentStep === 3,
      },
    ];

    // Add dividends step for non-community tokens
    if (selectedCategory !== 'COMMUNITY') {
      baseSteps.push({
        id: 'dividends',
        title: 'Dividends',
        description: 'Configure dividend distribution',
        icon: DollarSign,
        isCompleted: currentStep > 4,
        isActive: currentStep === 4,
      });
    }

    // Add documents step for verified assets (non-community)
    if (selectedCategory !== 'COMMUNITY') {
      baseSteps.push({
        id: 'documents',
        title: 'Documents',
        description: 'Upload verification documents',
        icon: Upload,
        isCompleted: currentStep > 5,
        isActive: currentStep === 5,
      });
    }

    // Review step
    baseSteps.push({
      id: 'review',
      title: 'Review & Submit',
      description: 'Review and confirm issuance',
      icon: Check,
      isCompleted: createdAssetId !== null,
      isActive: currentStep === baseSteps.length,
    });

    return baseSteps;
  }, [selectedCategory, currentStep, createdAssetId]);

  const steps = getSteps();
  const totalSteps = steps.length;

  // Navigation
  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Calculate fee
  const calculateFee = useCallback(() => {
    const valuation = parseFloat(
      selectedCategory === 'REAL_ESTATE' ? realEstateData.valuationUSD :
      selectedCategory === 'PRIVATE_EQUITY' ? privateEquityData.valuationUSD :
      selectedCategory === 'SECURITIES' ? securitiesData.valuationUSD :
      tokenData.tokenPriceUSD && tokenData.totalSupply 
        ? (parseFloat(tokenData.tokenPriceUSD) * parseFloat(tokenData.totalSupply)).toString()
        : '0'
    ) || 0;

    const feePercentage = 0.0025; // 0.25%
    const calculatedFee = valuation * feePercentage;
    const minFee = 100;
    const maxFee = 25000;

    return Math.min(Math.max(calculatedFee, minFee), maxFee);
  }, [selectedCategory, realEstateData, privateEquityData, securitiesData, tokenData]);

  // Submit handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let response;

      if (selectedCategory === 'REAL_ESTATE') {
        response = await assetsApi.tokenizeRealEstate({
          name: tokenData.name,
          symbol: tokenData.symbol,
          totalSupply: tokenData.totalSupply,
          assetType: 'REAL_ESTATE',
          propertyAddress: realEstateData.propertyAddress,
          propertyType: realEstateData.propertyType,
          valuationUSD: parseFloat(realEstateData.valuationUSD),
          squareFootage: realEstateData.squareFootage ? parseInt(realEstateData.squareFootage) : undefined,
          yearBuilt: realEstateData.yearBuilt ? parseInt(realEstateData.yearBuilt) : undefined,
          legalEntity: realEstateData.legalEntity || undefined,
          dividendYield: dividendData.enableDividends ? parseFloat(dividendData.expectedYield) : undefined,
          minInvestmentUSD: complianceData.minInvestmentUSD ? parseFloat(complianceData.minInvestmentUSD) : undefined,
          enableClawback: complianceData.enableClawback,
          jurisdictions: complianceData.jurisdictions,
        });
      } else if (selectedCategory === 'PRIVATE_EQUITY') {
        response = await assetsApi.tokenizePrivateEquity({
          name: tokenData.name,
          symbol: tokenData.symbol,
          totalSupply: tokenData.totalSupply,
          assetType: 'PRIVATE_EQUITY',
          companyName: privateEquityData.companyName,
          valuationUSD: parseFloat(privateEquityData.valuationUSD),
          equityPercentage: parseFloat(privateEquityData.equityPercentage),
          legalEntity: privateEquityData.legalEntity || undefined,
          enableClawback: complianceData.enableClawback,
          jurisdictions: complianceData.jurisdictions,
        });
      } else if (selectedCategory === 'SECURITIES') {
        response = await assetsApi.tokenizeSecurities({
          name: tokenData.name,
          symbol: tokenData.symbol,
          totalSupply: tokenData.totalSupply,
          assetType: 'SECURITY',
          securityType: securitiesData.securityType,
          cusipNumber: securitiesData.cusipNumber || undefined,
          isinNumber: securitiesData.isinNumber || undefined,
          valuationUSD: parseFloat(securitiesData.valuationUSD),
          issuerName: securitiesData.issuerName,
          enableClawback: complianceData.enableClawback,
          jurisdictions: complianceData.jurisdictions,
        });
      } else {
        response = await assetsApi.createCommunityToken({
          name: tokenData.name,
          symbol: tokenData.symbol,
          totalSupply: tokenData.totalSupply,
          assetType: 'COMMUNITY',
          description: communityData.description || undefined,
          website: communityData.website || undefined,
          socialLinks: {
            twitter: communityData.twitter,
            discord: communityData.discord,
          },
          enableClawback: complianceData.enableClawback,
        });
      }

      if (response.success && response.data?.asset?.id) {
        setCreatedAssetId(response.data.asset.id);
        onComplete?.(response.data.asset.id);
      } else {
        throw new Error(response.error?.message || 'Failed to create asset');
      }
    } catch (error) {
      setSubmitError((error as Error).message || 'Failed to create asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // RENDER STEP CONTENT
  // ============================================================

  const renderCategorySelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Select Asset Type</h2>
        <p className="text-gray-500 mt-2">Choose the category of asset you want to tokenize</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ASSET_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id;
          const colorClasses = {
            blue: { 
              bg: isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:border-blue-300',
              icon: 'text-blue-600 bg-blue-100',
              badge: 'bg-blue-100 text-blue-700',
            },
            purple: { 
              bg: isSelected ? 'bg-purple-50 border-purple-500' : 'bg-white border-gray-200 hover:border-purple-300',
              icon: 'text-purple-600 bg-purple-100',
              badge: 'bg-purple-100 text-purple-700',
            },
            green: { 
              bg: isSelected ? 'bg-green-50 border-green-500' : 'bg-white border-gray-200 hover:border-green-300',
              icon: 'text-green-600 bg-green-100',
              badge: 'bg-green-100 text-green-700',
            },
            orange: { 
              bg: isSelected ? 'bg-orange-50 border-orange-500' : 'bg-white border-gray-200 hover:border-orange-300',
              icon: 'text-orange-600 bg-orange-100',
              badge: 'bg-orange-100 text-orange-700',
            },
          };
          const colors = colorClasses[category.color as keyof typeof colorClasses];

          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`text-left p-6 rounded-xl border-2 transition-all ${colors.bg}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${colors.icon}`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                  
                  <div className="mt-4 space-y-2">
                    {category.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Min: {category.minTokenization}</span>
                    <div className="flex gap-1">
                      {category.compliance.map((req, idx) => (
                        <span key={idx} className={`px-2 py-0.5 rounded text-xs ${colors.badge}`}>
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderAssetDetails = () => {
    if (selectedCategory === 'REAL_ESTATE') {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Property Details</h2>
            <p className="text-gray-500 mt-2">Enter information about the real estate property</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Property Address" required>
              <input
                type="text"
                value={realEstateData.propertyAddress}
                onChange={(e) => setRealEstateData({ ...realEstateData, propertyAddress: e.target.value })}
                placeholder="123 Main Street, City, State, ZIP"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </FormField>

            <FormField label="Property Type" required>
              <select
                value={realEstateData.propertyType}
                onChange={(e) => setRealEstateData({ ...realEstateData, propertyType: e.target.value as RealEstateFormData['propertyType'] })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Square Footage">
              <input
                type="number"
                value={realEstateData.squareFootage}
                onChange={(e) => setRealEstateData({ ...realEstateData, squareFootage: e.target.value })}
                placeholder="e.g., 50000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Year Built">
              <input
                type="number"
                value={realEstateData.yearBuilt}
                onChange={(e) => setRealEstateData({ ...realEstateData, yearBuilt: e.target.value })}
                placeholder="e.g., 2018"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Occupancy Rate (%)" hint="Current occupancy percentage">
              <input
                type="number"
                value={realEstateData.occupancyRate}
                onChange={(e) => setRealEstateData({ ...realEstateData, occupancyRate: e.target.value })}
                placeholder="e.g., 95"
                min="0"
                max="100"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Annual Rent Income (USD)">
              <input
                type="number"
                value={realEstateData.annualRentIncome}
                onChange={(e) => setRealEstateData({ ...realEstateData, annualRentIncome: e.target.value })}
                placeholder="e.g., 5000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <div className="col-span-2">
              <div className="border-t border-gray-200 pt-6 mt-2">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                  Valuation
                </h3>
              </div>
            </div>

            <FormField label="Property Valuation (USD)" required>
              <input
                type="number"
                value={realEstateData.valuationUSD}
                onChange={(e) => setRealEstateData({ ...realEstateData, valuationUSD: e.target.value })}
                placeholder="e.g., 10000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Appraisal Date" required>
              <input
                type="date"
                value={realEstateData.appraisalDate}
                onChange={(e) => setRealEstateData({ ...realEstateData, appraisalDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Appraisal Provider">
              <input
                type="text"
                value={realEstateData.appraisalProvider}
                onChange={(e) => setRealEstateData({ ...realEstateData, appraisalProvider: e.target.value })}
                placeholder="e.g., CBRE Appraisals"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Legal Entity">
              <input
                type="text"
                value={realEstateData.legalEntity}
                onChange={(e) => setRealEstateData({ ...realEstateData, legalEntity: e.target.value })}
                placeholder="e.g., Property Holdings LLC"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>
          </div>
        </div>
      );
    }

    if (selectedCategory === 'PRIVATE_EQUITY') {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Company Details</h2>
            <p className="text-gray-500 mt-2">Enter information about the company</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Company Name" required>
              <input
                type="text"
                value={privateEquityData.companyName}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, companyName: e.target.value })}
                placeholder="e.g., TechVentures Inc."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Industry">
              <input
                type="text"
                value={privateEquityData.industry}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, industry: e.target.value })}
                placeholder="e.g., Technology"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <div className="col-span-2">
              <FormField label="Company Description">
                <textarea
                  value={privateEquityData.companyDescription}
                  onChange={(e) => setPrivateEquityData({ ...privateEquityData, companyDescription: e.target.value })}
                  placeholder="Brief description of the company and its business..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </FormField>
            </div>

            <FormField label="Company Valuation (USD)" required>
              <input
                type="number"
                value={privateEquityData.valuationUSD}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, valuationUSD: e.target.value })}
                placeholder="e.g., 50000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Equity Percentage (%)" required hint="Percentage of company being tokenized">
              <input
                type="number"
                value={privateEquityData.equityPercentage}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, equityPercentage: e.target.value })}
                placeholder="e.g., 10"
                min="0"
                max="100"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Annual Revenue (USD)">
              <input
                type="number"
                value={privateEquityData.annualRevenue}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, annualRevenue: e.target.value })}
                placeholder="e.g., 10000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="EBITDA (USD)">
              <input
                type="number"
                value={privateEquityData.ebitda}
                onChange={(e) => setPrivateEquityData({ ...privateEquityData, ebitda: e.target.value })}
                placeholder="e.g., 2000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>
          </div>
        </div>
      );
    }

    if (selectedCategory === 'SECURITIES') {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Security Details</h2>
            <p className="text-gray-500 mt-2">Enter information about the security</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Security Type" required>
              <select
                value={securitiesData.securityType}
                onChange={(e) => setSecuritiesData({ ...securitiesData, securityType: e.target.value as SecuritiesFormData['securityType'] })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {SECURITY_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Issuer Name" required>
              <input
                type="text"
                value={securitiesData.issuerName}
                onChange={(e) => setSecuritiesData({ ...securitiesData, issuerName: e.target.value })}
                placeholder="e.g., Green Energy Corp"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="CUSIP Number">
              <input
                type="text"
                value={securitiesData.cusipNumber}
                onChange={(e) => setSecuritiesData({ ...securitiesData, cusipNumber: e.target.value })}
                placeholder="e.g., 912828YN1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="ISIN Number">
              <input
                type="text"
                value={securitiesData.isinNumber}
                onChange={(e) => setSecuritiesData({ ...securitiesData, isinNumber: e.target.value })}
                placeholder="e.g., US912828YN13"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Face Value (USD)" required>
              <input
                type="number"
                value={securitiesData.valuationUSD}
                onChange={(e) => setSecuritiesData({ ...securitiesData, valuationUSD: e.target.value })}
                placeholder="e.g., 10000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Coupon Rate (%)" hint="Annual interest rate">
              <input
                type="number"
                value={securitiesData.couponRate}
                onChange={(e) => setSecuritiesData({ ...securitiesData, couponRate: e.target.value })}
                placeholder="e.g., 4.25"
                step="0.01"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Maturity Date">
              <input
                type="date"
                value={securitiesData.maturityDate}
                onChange={(e) => setSecuritiesData({ ...securitiesData, maturityDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Credit Rating">
              <input
                type="text"
                value={securitiesData.creditRating}
                onChange={(e) => setSecuritiesData({ ...securitiesData, creditRating: e.target.value })}
                placeholder="e.g., AA"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>
          </div>
        </div>
      );
    }

    // Community Token
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Community Token Details</h2>
          <p className="text-gray-500 mt-2">Provide information about your community token</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2">
            <FormField label="Description">
              <textarea
                value={communityData.description}
                onChange={(e) => setCommunityData({ ...communityData, description: e.target.value })}
                placeholder="Describe your community and token utility..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>
          </div>

          <FormField label="Website">
            <input
              type="url"
              value={communityData.website}
              onChange={(e) => setCommunityData({ ...communityData, website: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </FormField>

          <FormField label="Governance Model">
            <select
              value={communityData.governance}
              onChange={(e) => setCommunityData({ ...communityData, governance: e.target.value as CommunityFormData['governance'] })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="DAO">DAO (Decentralized)</option>
              <option value="MULTISIG">Multisig</option>
              <option value="NONE">None</option>
            </select>
          </FormField>

          <FormField label="Twitter">
            <input
              type="text"
              value={communityData.twitter}
              onChange={(e) => setCommunityData({ ...communityData, twitter: e.target.value })}
              placeholder="@handle"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </FormField>

          <FormField label="Discord">
            <input
              type="text"
              value={communityData.discord}
              onChange={(e) => setCommunityData({ ...communityData, discord: e.target.value })}
              placeholder="discord.gg/invite"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </FormField>
        </div>
      </div>
    );
  };

  const renderTokenSetup = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Token Configuration</h2>
        <p className="text-gray-500 mt-2">Configure your token parameters</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Token Name" required>
          <input
            type="text"
            value={tokenData.name}
            onChange={(e) => setTokenData({ ...tokenData, name: e.target.value })}
            placeholder="e.g., Manhattan Tower REIT"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Token Symbol" required hint="3-10 characters, uppercase">
          <input
            type="text"
            value={tokenData.symbol}
            onChange={(e) => setTokenData({ ...tokenData, symbol: e.target.value.toUpperCase() })}
            placeholder="e.g., MTWR"
            maxLength={10}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Total Supply" required hint="Total number of tokens to create">
          <input
            type="number"
            value={tokenData.totalSupply}
            onChange={(e) => setTokenData({ ...tokenData, totalSupply: e.target.value })}
            placeholder="e.g., 10000000"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Decimals" hint="Typically 6 for XRPL tokens">
          <select
            value={tokenData.decimals}
            onChange={(e) => setTokenData({ ...tokenData, decimals: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="0">0 (Whole tokens only)</option>
            <option value="2">2 (Like USD cents)</option>
            <option value="6">6 (Standard)</option>
            <option value="8">8 (High precision)</option>
          </select>
        </FormField>

        <FormField label="Initial Token Price (USD)" hint="Price per token for initial offering">
          <input
            type="number"
            value={tokenData.tokenPriceUSD}
            onChange={(e) => setTokenData({ ...tokenData, tokenPriceUSD: e.target.value })}
            placeholder="e.g., 1.00"
            step="0.01"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>
      </div>

      {/* Token Summary */}
      {tokenData.totalSupply && tokenData.tokenPriceUSD && (
        <div className="mt-6 p-4 bg-indigo-50 rounded-xl">
          <h4 className="font-semibold text-indigo-900 mb-3">Token Economics Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-indigo-600">Total Supply</span>
              <div className="font-bold text-indigo-900">{parseInt(tokenData.totalSupply).toLocaleString()} {tokenData.symbol}</div>
            </div>
            <div>
              <span className="text-indigo-600">Token Price</span>
              <div className="font-bold text-indigo-900">${parseFloat(tokenData.tokenPriceUSD).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-indigo-600">Total Market Cap</span>
              <div className="font-bold text-indigo-900">
                ${(parseInt(tokenData.totalSupply) * parseFloat(tokenData.tokenPriceUSD)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Compliance Settings</h2>
        <p className="text-gray-500 mt-2">Configure investor requirements and transfer restrictions</p>
      </div>

      {/* Jurisdictions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" />
          Supported Jurisdictions
        </h3>
        <div className="flex flex-wrap gap-2">
          {JURISDICTIONS.map((j) => (
            <button
              key={j.code}
              type="button"
              onClick={() => {
                const current = complianceData.jurisdictions;
                setComplianceData({
                  ...complianceData,
                  jurisdictions: current.includes(j.code)
                    ? current.filter((c) => c !== j.code)
                    : [...current, j.code],
                });
              }}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                complianceData.jurisdictions.includes(j.code)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{j.flag}</span>
              {j.code}
            </button>
          ))}
        </div>
      </div>

      {/* Compliance Toggles */}
      <div className="space-y-4">
        <ToggleSwitch
          checked={complianceData.requiresKYC}
          onChange={(checked) => setComplianceData({ ...complianceData, requiresKYC: checked })}
          label="Require KYC Verification"
          description="Investors must complete identity verification before purchasing"
        />

        <ToggleSwitch
          checked={complianceData.accreditedOnly}
          onChange={(checked) => setComplianceData({ ...complianceData, accreditedOnly: checked })}
          label="Accredited Investors Only"
          description="Limit to SEC-qualified accredited investors"
        />

        <ToggleSwitch
          checked={complianceData.enableClawback}
          onChange={(checked) => setComplianceData({ ...complianceData, enableClawback: checked })}
          label="Enable XLS-39D Clawback"
          description="Allow governance-approved token recovery for compliance"
        />
      </div>

      {/* Additional Restrictions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormField label="Max Investors" hint="Leave empty for unlimited">
          <input
            type="number"
            value={complianceData.maxInvestors}
            onChange={(e) => setComplianceData({ ...complianceData, maxInvestors: e.target.value })}
            placeholder="e.g., 500"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Min Investment (USD)">
          <input
            type="number"
            value={complianceData.minInvestmentUSD}
            onChange={(e) => setComplianceData({ ...complianceData, minInvestmentUSD: e.target.value })}
            placeholder="e.g., 1000"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Holding Period (Days)" hint="Lockup after purchase">
          <input
            type="number"
            value={complianceData.holdingPeriodDays}
            onChange={(e) => setComplianceData({ ...complianceData, holdingPeriodDays: e.target.value })}
            placeholder="e.g., 365"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </FormField>
      </div>

      {/* XLS-39D Info */}
      {complianceData.enableClawback && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">XLS-39D Clawback Enabled</h4>
              <p className="text-sm text-amber-700 mt-1">
                This asset will include XRPL's clawback capability. Token recovery requires:
              </p>
              <ul className="text-sm text-amber-700 mt-2 space-y-1">
                <li>• Valid legal justification (court order, fraud, regulatory requirement)</li>
                <li>• 72-hour public comment period</li>
                <li>• Guardian governance approval</li>
                <li>• Full audit trail and notification to affected holder</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDividends = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dividend Configuration</h2>
        <p className="text-gray-500 mt-2">Set up income distribution for token holders</p>
      </div>

      <ToggleSwitch
        checked={dividendData.enableDividends}
        onChange={(checked) => setDividendData({ ...dividendData, enableDividends: checked })}
        label="Enable Dividend Distribution"
        description="Automatically distribute income to token holders"
      />

      {dividendData.enableDividends && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <FormField label="Distribution Frequency">
            <select
              value={dividendData.frequency}
              onChange={(e) => setDividendData({ ...dividendData, frequency: e.target.value as DividendFormData['frequency'] })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </FormField>

          <FormField label="Expected Yield (%)" hint="Annual dividend yield">
            <input
              type="number"
              value={dividendData.expectedYield}
              onChange={(e) => setDividendData({ ...dividendData, expectedYield: e.target.value })}
              placeholder="e.g., 5.5"
              step="0.1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </FormField>

          <FormField label="Payment Currency">
            <select
              value={dividendData.paymentCurrency}
              onChange={(e) => setDividendData({ ...dividendData, paymentCurrency: e.target.value as DividendFormData['paymentCurrency'] })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="XRP">XRP</option>
              <option value="VRTY">VRTY</option>
              <option value="USD">USD Stablecoin</option>
            </select>
          </FormField>

          <div className="flex items-end">
            <ToggleSwitch
              checked={dividendData.autoDistribute}
              onChange={(checked) => setDividendData({ ...dividendData, autoDistribute: checked })}
              label="Auto-distribute"
              description="Automatically send dividends on schedule"
            />
          </div>
        </div>
      )}

      {/* Dividend Estimate */}
      {dividendData.enableDividends && dividendData.expectedYield && tokenData.totalSupply && tokenData.tokenPriceUSD && (
        <div className="mt-6 p-4 bg-green-50 rounded-xl">
          <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Estimated Annual Distribution
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-green-600">Annual Yield</span>
              <div className="font-bold text-green-900">{parseFloat(dividendData.expectedYield).toFixed(2)}%</div>
            </div>
            <div>
              <span className="text-green-600">Per Token (Annual)</span>
              <div className="font-bold text-green-900">
                ${(parseFloat(tokenData.tokenPriceUSD) * (parseFloat(dividendData.expectedYield) / 100)).toFixed(4)}
              </div>
            </div>
            <div>
              <span className="text-green-600">Total Annual Distribution</span>
              <div className="font-bold text-green-900">
                ${(parseInt(tokenData.totalSupply) * parseFloat(tokenData.tokenPriceUSD) * (parseFloat(dividendData.expectedYield) / 100)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Verification Documents</h2>
        <p className="text-gray-500 mt-2">Upload required documents for asset verification</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-900">Document Requirements</h4>
            <p className="text-sm text-amber-700 mt-1">
              Verified assets require supporting documentation. Documents are hashed on-chain for integrity verification.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {selectedCategory === 'REAL_ESTATE' && (
          <>
            <FileUploadField
              label="Title Deed"
              accept=".pdf,.jpg,.png"
              file={documentsData.titleDeed}
              onChange={(file) => setDocumentsData({ ...documentsData, titleDeed: file })}
              required
            />
            <FileUploadField
              label="Appraisal Report"
              accept=".pdf"
              file={documentsData.appraisalReport}
              onChange={(file) => setDocumentsData({ ...documentsData, appraisalReport: file })}
              required
            />
            <FileUploadField
              label="Insurance Certificate"
              accept=".pdf"
              file={documentsData.insuranceCertificate}
              onChange={(file) => setDocumentsData({ ...documentsData, insuranceCertificate: file })}
            />
          </>
        )}

        {selectedCategory === 'PRIVATE_EQUITY' && (
          <>
            <FileUploadField
              label="Private Placement Memorandum"
              accept=".pdf"
              file={documentsData.memorandum}
              onChange={(file) => setDocumentsData({ ...documentsData, memorandum: file })}
              required
            />
            <FileUploadField
              label="Financial Statements"
              accept=".pdf"
              file={documentsData.financialStatements}
              onChange={(file) => setDocumentsData({ ...documentsData, financialStatements: file })}
              required
            />
          </>
        )}

        {selectedCategory === 'SECURITIES' && (
          <>
            <FileUploadField
              label="Prospectus"
              accept=".pdf"
              file={documentsData.prospectus}
              onChange={(file) => setDocumentsData({ ...documentsData, prospectus: file })}
              required
            />
            <FileUploadField
              label="Legal Opinion"
              accept=".pdf"
              file={documentsData.legalOpinion}
              onChange={(file) => setDocumentsData({ ...documentsData, legalOpinion: file })}
            />
          </>
        )}

        <FileUploadField
          label="Legal Opinion Letter"
          accept=".pdf"
          file={documentsData.legalOpinion}
          onChange={(file) => setDocumentsData({ ...documentsData, legalOpinion: file })}
        />
      </div>
    </div>
  );

  const renderReview = () => {
    const fee = calculateFee();
    
    if (createdAssetId) {
      return (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Asset Successfully Created!</h2>
          <p className="text-gray-500 mb-6">Your tokenized asset has been created on XRPL</p>
          
          <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto mb-6">
            <div className="text-sm text-gray-500 mb-1">Asset ID</div>
            <div className="font-mono text-gray-900">{createdAssetId}</div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.open(`/app/assets?id=${createdAssetId}`, '_blank')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2"
            >
              View Asset
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
          <p className="text-gray-500 mt-2">Review your asset configuration before submission</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Token Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-600" />
              Token Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{tokenData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Symbol</span>
                <span className="font-medium font-mono">{tokenData.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Supply</span>
                <span className="font-medium">{parseInt(tokenData.totalSupply || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Token Price</span>
                <span className="font-medium">${parseFloat(tokenData.tokenPriceUSD || '0').toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Compliance
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">KYC Required</span>
                <span className={`font-medium ${complianceData.requiresKYC ? 'text-green-600' : 'text-gray-400'}`}>
                  {complianceData.requiresKYC ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Accredited Only</span>
                <span className={`font-medium ${complianceData.accreditedOnly ? 'text-green-600' : 'text-gray-400'}`}>
                  {complianceData.accreditedOnly ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">XLS-39D Clawback</span>
                <span className={`font-medium ${complianceData.enableClawback ? 'text-green-600' : 'text-gray-400'}`}>
                  {complianceData.enableClawback ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jurisdictions</span>
                <span className="font-medium">{complianceData.jurisdictions.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="bg-indigo-50 rounded-xl p-6">
          <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Fee Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">Tokenization Fee (0.25%)</span>
              <span className="font-medium text-indigo-900">${fee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">XRPL Transaction Fee</span>
              <span className="font-medium text-indigo-900">~$0.01</span>
            </div>
            <div className="border-t border-indigo-200 pt-3 flex justify-between">
              <span className="font-semibold text-indigo-900">Total</span>
              <span className="font-bold text-indigo-900">${(fee + 0.01).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Submission Failed</h4>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER CURRENT STEP
  // ============================================================

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderCategorySelection();
      case 1:
        return renderAssetDetails();
      case 2:
        return renderTokenSetup();
      case 3:
        return renderCompliance();
      case 4:
        if (selectedCategory === 'COMMUNITY') {
          return renderReview();
        }
        return renderDividends();
      case 5:
        if (selectedCategory === 'COMMUNITY') {
          return renderReview();
        }
        return renderDocuments();
      case 6:
        return renderReview();
      default:
        return renderReview();
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <StepIndicator steps={steps} currentStep={currentStep} />
        <div className="text-center mt-4">
          <h3 className="font-semibold text-gray-900">{steps[currentStep]?.title}</h3>
          <p className="text-sm text-gray-500">{steps[currentStep]?.description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      {!createdAssetId && (
        <div className="flex justify-between mt-8">
          <button
            onClick={currentStep === 0 ? onCancel : goBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < totalSteps - 1 ? (
            <button
              onClick={goNext}
              disabled={currentStep === 0 && !selectedCategory}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Asset...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Asset
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
