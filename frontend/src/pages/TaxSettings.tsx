import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../App';
import { taxApi } from '../api/client';
import { 
  Globe, 
  Calculator, 
  Save,
  CheckCircle,
  AlertCircle,
  Search,
  Info
} from 'lucide-react';

const costBasisMethods = [
  { value: 'FIFO', label: 'FIFO', description: 'First In, First Out - Sell oldest assets first' },
  { value: 'LIFO', label: 'LIFO', description: 'Last In, First Out - Sell newest assets first' },
  { value: 'HIFO', label: 'HIFO', description: 'Highest In, First Out - Sell highest cost first (minimizes gains)' },
  { value: 'SPECIFIC_ID', label: 'Specific ID', description: 'Choose which specific lot to sell' },
  { value: 'AVERAGE', label: 'Average Cost', description: 'Use average cost of all holdings' },
];

export default function TaxSettings() {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    taxResidence: '',
    costBasisMethod: 'FIFO',
    taxId: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ['taxProfile', userId],
    queryFn: () => taxApi.getProfile(userId),
    retry: false,
  });

  const { data: jurisdictionsData, isLoading: jurisdictionsLoading } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: () => taxApi.getJurisdictions(),
  });

  const { data: selectedJurisdictionData } = useQuery({
    queryKey: ['jurisdictionRules', formData.taxResidence],
    queryFn: () => taxApi.getJurisdictionRules(formData.taxResidence),
    enabled: !!formData.taxResidence,
  });

  const saveProfileMutation = useMutation({
    mutationFn: (data: typeof formData) => taxApi.createProfile({
      userId,
      taxResidence: data.taxResidence,
      costBasisMethod: data.costBasisMethod,
      taxId: data.taxId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxProfile', userId] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Load existing profile data
  useEffect(() => {
    if (profileData?.data?.profile) {
      const profile = profileData.data.profile;
      setFormData({
        taxResidence: profile.taxResidence || '',
        costBasisMethod: profile.costBasisMethod || 'FIFO',
        taxId: profile.taxId || '',
      });
    }
  }, [profileData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.taxResidence) return;
    saveProfileMutation.mutate(formData);
  };

  const jurisdictions = jurisdictionsData?.data?.jurisdictions || [];
  const filteredJurisdictions = jurisdictions.filter((j: any) =>
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const jurisdictionRules = selectedJurisdictionData?.data?.rules;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Tax Settings</h1>
        <p className="text-slate-400">Configure your tax profile and preferences</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tax Residence */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-verity-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-verity-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Tax Residence</h2>
                  <p className="text-sm text-slate-400">Select your tax jurisdiction</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                />
              </div>

              {/* Jurisdiction Grid */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
                {jurisdictionsLoading ? (
                  <div className="p-4 text-center text-slate-400">Loading jurisdictions...</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredJurisdictions.slice(0, 50).map((jurisdiction: any) => (
                      <button
                        key={jurisdiction.code}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, taxResidence: jurisdiction.code }))}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          formData.taxResidence === jurisdiction.code
                            ? 'bg-verity-500/20 text-verity-400'
                            : 'hover:bg-slate-700/50 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{jurisdiction.name}</span>
                            <span className="text-slate-400 ml-2">({jurisdiction.code})</span>
                          </div>
                          {formData.taxResidence === jurisdiction.code && (
                            <CheckCircle className="w-4 h-4 text-verity-400" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400">{jurisdiction.region}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredJurisdictions.length > 50 && (
                <p className="text-sm text-slate-400 text-center mt-2">
                  Showing first 50 of {filteredJurisdictions.length} results
                </p>
              )}
            </div>

            {/* Cost Basis Method */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Cost Basis Method</h2>
                  <p className="text-sm text-slate-400">How to calculate gains when selling</p>
                </div>
              </div>

              <div className="space-y-3">
                {costBasisMethods.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, costBasisMethod: method.value }))}
                    className={`w-full p-4 rounded-lg border transition-colors text-left ${
                      formData.costBasisMethod === method.value
                        ? 'bg-purple-500/10 border-purple-500/50'
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{method.label}</span>
                      {formData.costBasisMethod === method.value && (
                        <CheckCircle className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{method.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tax ID (Optional) */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Tax ID (Optional)</h2>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                placeholder="Enter your tax identification number"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
              />
              <p className="text-sm text-slate-400 mt-2">
                This is stored securely and only used for report generation.
              </p>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={!formData.taxResidence || saveProfileMutation.isPending}
              className="w-full py-3 rounded-lg bg-verity-600 hover:bg-verity-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saveProfileMutation.isPending ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Saved Successfully!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>

            {saveProfileMutation.isError && (
              <div className="flex items-center gap-2 text-red-400 mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to save settings. Please try again.</span>
              </div>
            )}
          </div>

          {/* Right Column - Jurisdiction Details */}
          <div className="space-y-6">
            {/* Selected Jurisdiction Info */}
            {jurisdictionRules && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {jurisdictionRules.name}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Region</span>
                    <span className="text-white">{jurisdictionRules.region}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Short-term Rate</span>
                    <span className="text-white">{jurisdictionRules.shortTermRate}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Long-term Rate</span>
                    <span className="text-white">{jurisdictionRules.longTermRate}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Long-term Threshold</span>
                    <span className="text-white">{jurisdictionRules.longTermThresholdDays} days</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Dividend Rate</span>
                    <span className="text-white">{jurisdictionRules.dividendRate}%</span>
                  </div>
                </div>

                {jurisdictionRules.notes && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-300">{jurisdictionRules.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Methodology Info */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">About Tax Calculations</h3>
              <div className="space-y-4 text-sm text-slate-400">
                <p>
                  <strong className="text-white">Transparency:</strong> All calculations use transparent 
                  methodology with full audit trails.
                </p>
                <p>
                  <strong className="text-white">200+ Jurisdictions:</strong> We support tax rules for 
                  countries worldwide, including special crypto rules.
                </p>
                <p>
                  <strong className="text-white">Disclaimer:</strong> Tax calculations are for informational 
                  purposes only. Consult a tax professional for specific advice.
                </p>
              </div>
            </div>

            {/* Supported Count */}
            <div className="bg-gradient-to-br from-verity-600/20 to-verity-800/20 rounded-xl p-6 border border-verity-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-2">
                  {jurisdictionsData?.data?.totalCount || '200+'}
                </p>
                <p className="text-verity-300">Jurisdictions Supported</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
