import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '../App';
import { taxApi } from '../api/client';
import { 
  FileText, 
  Download, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  Globe,
  ChevronDown
} from 'lucide-react';

const currentYear = new Date().getFullYear();
const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

const reportFormats = [
  { value: 'GENERIC', label: 'Generic Report', description: 'Standard format for all countries' },
  { value: 'IRS_8949', label: 'IRS Form 8949', description: 'US Capital Gains & Losses' },
  { value: 'HMRC', label: 'HMRC Report', description: 'UK Capital Gains Tax' },
];

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

export default function TaxReports() {
  const { userId } = useUser();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedFormat, setSelectedFormat] = useState('GENERIC');
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const { data: profileData } = useQuery({
    queryKey: ['taxProfile', userId],
    queryFn: () => taxApi.getProfile(userId),
    retry: false,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['taxSummary', userId, selectedYear],
    queryFn: () => taxApi.getSummary(userId, selectedYear),
    enabled: !!profileData?.data?.profile,
  });

  const generateReportMutation = useMutation({
    mutationFn: () => taxApi.generateReport(userId, selectedYear, selectedFormat),
    onSuccess: (data) => {
      setGeneratedReport(data.data.report);
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate();
  };

  const handleDownloadReport = () => {
    if (!generatedReport) return;

    // Create CSV content
    const csvContent = generateCSV(generatedReport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `verity_tax_report_${selectedYear}_${selectedFormat}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCSV = (report: any): string => {
    const headers = [
      'Transaction ID',
      'Type',
      'Proceeds',
      'Cost Basis',
      'Gain/Loss',
      'Tax Rate',
      'Tax Owed',
      'Date',
    ];

    const rows = report.transactions.map((tx: any) => [
      tx.transactionId,
      tx.transactionType,
      tx.proceeds,
      tx.costBasis,
      tx.gainLoss,
      `${tx.taxRate}%`,
      tx.taxOwed,
      new Date(tx.calculatedAt).toLocaleDateString(),
    ]);

    const csvRows = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')),
      '',
      `"Total Gains","${report.totalGains}"`,
      `"Total Losses","${report.totalLosses}"`,
      `"Net Gain/Loss","${report.netGainLoss}"`,
      `"Total Tax Owed","${report.totalTaxOwed}"`,
    ];

    return csvRows.join('\n');
  };

  const hasProfile = profileData?.data?.profile;
  const summary = summaryData?.data?.summary;

  if (!hasProfile) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Profile Required</h2>
          <p className="text-slate-400">Please set up your tax profile first in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Tax Reports</h1>
        <p className="text-slate-400">Generate and download your tax reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Report Generator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Configuration */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-6">Generate Report</h2>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Tax Year</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-verity-500 appearance-none cursor-pointer"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Report Format</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-verity-500 appearance-none cursor-pointer"
                  >
                    {reportFormats.map(format => (
                      <option key={format.value} value={format.value}>{format.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Format Description */}
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600 mb-6">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-verity-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">
                    {reportFormats.find(f => f.value === selectedFormat)?.label}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {reportFormats.find(f => f.value === selectedFormat)?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isPending}
              className="w-full py-3 rounded-lg bg-verity-600 hover:bg-verity-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generateReportMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Generate Report
                </>
              )}
            </button>
          </div>

          {/* Generated Report Preview */}
          {generatedReport && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Report Generated</h3>
                    <p className="text-sm text-slate-400">
                      {generatedReport.reportFormat} for {generatedReport.taxYear}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>

              {/* Report Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-sm text-slate-400">Total Gains</p>
                  <p className="text-lg font-bold text-green-400">{formatCurrency(generatedReport.totalGains)}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-sm text-slate-400">Total Losses</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(generatedReport.totalLosses)}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-sm text-slate-400">Net Gain/Loss</p>
                  <p className={`text-lg font-bold ${parseFloat(generatedReport.netGainLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(generatedReport.netGainLoss)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-sm text-slate-400">Tax Owed</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(generatedReport.totalTaxOwed)}</p>
                </div>
              </div>

              {/* Transactions Preview */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-400 mb-3">
                  {generatedReport.transactions.length} transactions included
                </p>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="text-left py-2">Type</th>
                        <th className="text-right py-2">Proceeds</th>
                        <th className="text-right py-2">Cost Basis</th>
                        <th className="text-right py-2">Gain/Loss</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {generatedReport.transactions.slice(0, 10).map((tx: any, index: number) => (
                        <tr key={index} className="border-t border-slate-700">
                          <td className="py-2">{tx.transactionType}</td>
                          <td className="text-right">{formatCurrency(tx.proceeds)}</td>
                          <td className="text-right">{formatCurrency(tx.costBasis)}</td>
                          <td className={`text-right ${parseFloat(tx.gainLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(tx.gainLoss)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {generatedReport.transactions.length > 10 && (
                    <p className="text-center text-slate-400 text-sm mt-2">
                      ... and {generatedReport.transactions.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Year Summary */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">{selectedYear} Summary</h3>
            
            {summaryLoading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Transactions</span>
                  <span className="text-white">{summary.totalTransactions}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Short-term Gains</span>
                  <span className="text-green-400">{formatCurrency(summary.shortTermGains)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Long-term Gains</span>
                  <span className="text-green-400">{formatCurrency(summary.longTermGains)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Total Losses</span>
                  <span className="text-red-400">-{formatCurrency(parseFloat(summary.shortTermLosses) + parseFloat(summary.longTermLosses))}</span>
                </div>
                <div className="flex justify-between py-2 pt-3">
                  <span className="text-white font-medium">Estimated Tax</span>
                  <span className="text-white font-bold">{formatCurrency(summary.estimatedTax)}</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No data for this year</p>
            )}
          </div>

          {/* Report Formats Info */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Supported Formats</h3>
            <div className="space-y-3">
              {reportFormats.map((format) => (
                <div
                  key={format.value}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedFormat === format.value
                      ? 'bg-verity-500/10 border-verity-500/50'
                      : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedFormat(format.value)}
                >
                  <p className="text-white font-medium">{format.label}</p>
                  <p className="text-sm text-slate-400">{format.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
