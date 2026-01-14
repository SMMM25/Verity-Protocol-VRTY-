import axios from 'axios';

// API base URL - uses proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('verity_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('verity_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Tax API functions
export const taxApi = {
  // Profile
  getProfile: (userId: string) => 
    api.get(`/tax/profile/${userId}`).then(res => res.data),
  
  createProfile: (data: {
    userId: string;
    taxResidence: string;
    costBasisMethod: string;
    taxId?: string;
  }) => 
    api.post('/tax/profile', data).then(res => res.data),

  // Transactions
  getTransactions: (userId: string, params?: { taxYear?: number; asset?: string }) =>
    api.get(`/tax/transactions/${userId}`, { params }).then(res => res.data),

  recordTransaction: (userId: string, transaction: {
    type: string;
    asset: string;
    amount: string;
    pricePerUnit: string;
    totalValue: string;
    timestamp: string;
    transactionHash: string;
    fee?: string;
  }) =>
    api.post('/tax/calculate', { userId, transaction }).then(res => res.data),

  // Reports
  getSummary: (userId: string, taxYear: number) =>
    api.get(`/tax/summary/${userId}/${taxYear}`).then(res => res.data),

  generateReport: (userId: string, taxYear: number, format: string = 'GENERIC') =>
    api.post('/tax/report/generate', { userId, taxYear, format }).then(res => res.data),

  // Jurisdictions
  getJurisdictions: (params?: { region?: string; taxFriendly?: boolean }) =>
    api.get('/tax/jurisdictions', { params }).then(res => res.data),

  getJurisdictionRules: (code: string) =>
    api.get(`/tax/jurisdictions/${code}`).then(res => res.data),

  // Cost Basis
  getCostBasis: (userId: string, asset: string) =>
    api.get(`/tax/cost-basis/${userId}/${asset}`).then(res => res.data),

  // Methodology
  getMethodology: () =>
    api.get('/tax/methodology').then(res => res.data),
};

export default api;
