import api from './client';

// DEX API functions
export const dexApi = {
  // XRPL Info
  getNetworkInfo: () =>
    api.get('/xrpl/info').then(res => res.data),

  // Account
  getAccount: (address: string) =>
    api.get(`/xrpl/account/${address}`).then(res => res.data),

  getBalances: (address: string) =>
    api.get(`/xrpl/account/${address}/balances`).then(res => res.data),

  // Order Book
  getOrderBook: (params?: { base?: string; quote?: string; limit?: number }) =>
    api.get('/xrpl/orderbook', { params }).then(res => res.data),

  // Offers
  getAccountOffers: (address: string) =>
    api.get(`/xrpl/account/${address}/offers`).then(res => res.data),

  // Market Data (mock for now - will connect to real endpoint)
  getMarketData: () =>
    api.get('/xrpl/market').then(res => res.data).catch(() => ({
      data: {
        price: 0.02,
        change24h: 5.2,
        volume24h: 125000,
        high24h: 0.022,
        low24h: 0.018,
        marketCap: 10000000,
      }
    })),

  // VRTY Token Info
  getVRTYInfo: () => ({
    symbol: 'VRTY',
    name: 'Verity Protocol',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: 1000000000,
    decimals: 6,
    network: 'XRPL',
  }),
};

export default dexApi;
