/**
 * Verity Protocol - VRTY Token Configuration
 * 
 * @description Official VRTY token configuration for XRPL Mainnet.
 * This file contains the real production token addresses and parameters.
 * 
 * VRTY Token Details:
 * - Network: XRPL Mainnet
 * - Total Supply: 1,000,000,000 VRTY
 * - Issuer: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
 * - Distribution: rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3
 * 
 * @version 1.0.0
 */

/**
 * VRTY Token configuration for XRPL
 */
export const VRTY_TOKEN = {
  // Token Symbol
  symbol: 'VRTY',
  name: 'Verity Protocol Token',
  
  // XRPL Currency Code (standard 3-char or hex for longer)
  currencyCode: 'VRTY',
  // Hex format for XRPL (40 chars, padded)
  currencyCodeHex: '5652545900000000000000000000000000000000',
  
  // Token decimals (XRPL uses 15 decimal places internally)
  decimals: 6,
  
  // Total Supply
  totalSupply: '1000000000', // 1 billion VRTY
  
  // Network
  network: 'mainnet' as const,
} as const;

/**
 * Official VRTY addresses on XRPL Mainnet
 */
export const VRTY_ADDRESSES = {
  // Token Issuer - The account that created the VRTY token
  issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  
  // Distribution Wallet - Primary wallet for token distribution
  distributionWallet: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  
  // Bridge Escrow - Holds VRTY locked for bridging (to be set after mainnet deployment)
  bridgeEscrow: process.env['XRPL_BRIDGE_ESCROW'] || '',
} as const;

/**
 * wVRTY Token configuration for Solana
 */
export const WVRTY_TOKEN = {
  symbol: 'wVRTY',
  name: 'Wrapped Verity Protocol Token',
  decimals: 6, // Matches VRTY precision
  
  // Mainnet addresses (to be set after mainnet deployment)
  mainnet: {
    mint: process.env['SOLANA_WVRTY_MINT_MAINNET'] || '',
    mintAuthority: process.env['SOLANA_MINT_AUTHORITY_MAINNET'] || '',
    freezeAuthority: process.env['SOLANA_FREEZE_AUTHORITY_MAINNET'] || '',
    treasuryAccount: process.env['SOLANA_TREASURY_MAINNET'] || '',
  },
  
  // Devnet addresses (deployed)
  devnet: {
    mint: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
    mintAuthority: '7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5',
    freezeAuthority: '4hxapL1YWfFwtdp8D14EGMBqfidL4phBdRSU8jm61Kiq',
    treasuryAccount: 'An3Xm7QbpbcfVoHziZpMqusNjpPK4mxL1xNaUUJJpMJb',
    treasuryAuthority: '2zQiuzcVvMbU9GTfkp1Ffy9R63knvU5RTot53wdofqHV',
  },
} as const;

/**
 * XRPL Network configurations
 */
export const XRPL_NETWORKS = {
  mainnet: {
    name: 'XRPL Mainnet',
    server: 'wss://xrplcluster.com',
    alternateServers: [
      'wss://s1.ripple.com',
      'wss://s2.ripple.com',
    ],
    explorerUrl: 'https://xrpscan.com',
    networkId: 0,
  },
  testnet: {
    name: 'XRPL Testnet',
    server: 'wss://s.altnet.rippletest.net:51233',
    alternateServers: [],
    explorerUrl: 'https://testnet.xrpl.org',
    networkId: 1,
  },
  devnet: {
    name: 'XRPL Devnet',
    server: 'wss://s.devnet.rippletest.net:51233',
    alternateServers: [],
    explorerUrl: 'https://devnet.xrpl.org',
    networkId: 2,
  },
} as const;

/**
 * Solana Network configurations
 */
export const SOLANA_NETWORKS = {
  'mainnet-beta': {
    name: 'Solana Mainnet',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
  },
  devnet: {
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://solscan.io',
    explorerSuffix: '?cluster=devnet',
  },
  testnet: {
    name: 'Solana Testnet',
    rpcUrl: 'https://api.testnet.solana.com',
    explorerUrl: 'https://solscan.io',
    explorerSuffix: '?cluster=testnet',
  },
} as const;

/**
 * Bridge configuration
 */
export const BRIDGE_CONFIG = {
  // Minimum amount to bridge (in VRTY)
  minBridgeAmount: 100,
  
  // Maximum amount to bridge (in VRTY)
  maxBridgeAmount: 1000000,
  
  // Required validator signatures (3 of 5)
  validatorThreshold: 3,
  totalValidators: 5,
  
  // Transaction timeout (in seconds)
  transactionTimeout: 300,
  
  // Fee configuration
  fees: {
    baseFee: 10, // Base fee in VRTY
    percentageFee: 25, // Basis points (0.25%)
    minFee: 10,
    maxFee: 10000,
  },
  
  // Confirmation requirements
  confirmations: {
    xrpl: 1, // XRPL is fast-finality
    solana: 32, // ~12 seconds on Solana
  },
} as const;

/**
 * Token tier configuration for staking
 */
export const STAKING_TIERS = {
  EXPLORER: {
    name: 'Explorer',
    minStake: 0,
    maxStake: 999,
    benefits: ['Basic API access', 'Community support'],
    rewardMultiplier: 1.0,
  },
  NAVIGATOR: {
    name: 'Navigator',
    minStake: 1000,
    maxStake: 9999,
    benefits: ['Standard API access', 'Priority support', '5% fee discount'],
    rewardMultiplier: 1.1,
  },
  CAPTAIN: {
    name: 'Captain',
    minStake: 10000,
    maxStake: 49999,
    benefits: ['Advanced API access', 'Dedicated support', '10% fee discount', 'Governance voting'],
    rewardMultiplier: 1.25,
  },
  ADMIRAL: {
    name: 'Admiral',
    minStake: 50000,
    maxStake: 199999,
    benefits: ['Premium API access', 'Account manager', '15% fee discount', 'Proposal creation'],
    rewardMultiplier: 1.5,
  },
  COMMODORE: {
    name: 'Commodore',
    minStake: 200000,
    maxStake: Infinity,
    benefits: ['Enterprise API access', 'Custom integrations', '25% fee discount', 'Validator eligibility'],
    rewardMultiplier: 2.0,
  },
} as const;

/**
 * Guild configuration
 */
export const GUILD_CONFIG = {
  // Minimum stake to create a guild
  minStakeToCreate: 10000,
  
  // Default minimum stake to join a guild
  defaultMinStakeToJoin: 100,
  
  // Maximum members per guild
  maxMembers: 1000,
  
  // Valid roles
  roles: ['OWNER', 'ADMIN', 'MEMBER'] as const,
  
  // Revenue distribution settings
  revenueDistribution: {
    minDistributionAmount: 100, // Minimum VRTY to distribute
    maxSharePercentage: 100,
    minSharePercentage: 0,
  },
} as const;

/**
 * Get current environment configuration
 */
export function getEnvironmentConfig() {
  const env = process.env['NODE_ENV'] || 'development';
  const xrplNetwork = (process.env['XRPL_NETWORK'] as keyof typeof XRPL_NETWORKS) || 
    (env === 'production' ? 'mainnet' : 'testnet');
  const solanaNetwork = (process.env['SOLANA_NETWORK'] as keyof typeof SOLANA_NETWORKS) || 
    (env === 'production' ? 'mainnet-beta' : 'devnet');
  
  return {
    environment: env,
    xrpl: {
      network: xrplNetwork,
      ...XRPL_NETWORKS[xrplNetwork],
      vrtyIssuer: VRTY_ADDRESSES.issuer,
      vrtyCurrencyCode: VRTY_TOKEN.currencyCodeHex,
      bridgeEscrow: VRTY_ADDRESSES.bridgeEscrow,
    },
    solana: {
      network: solanaNetwork,
      ...SOLANA_NETWORKS[solanaNetwork],
      wvrty: solanaNetwork === 'mainnet-beta' 
        ? WVRTY_TOKEN.mainnet 
        : WVRTY_TOKEN.devnet,
    },
    bridge: BRIDGE_CONFIG,
    staking: STAKING_TIERS,
    guild: GUILD_CONFIG,
  };
}

/**
 * Validate VRTY issuer address
 */
export function isValidVRTYIssuer(address: string): boolean {
  return address === VRTY_ADDRESSES.issuer;
}

/**
 * Validate VRTY currency code
 */
export function isValidVRTYCurrency(currencyCode: string): boolean {
  return currencyCode === VRTY_TOKEN.currencyCode || 
         currencyCode === VRTY_TOKEN.currencyCodeHex;
}

/**
 * Get explorer URL for VRTY token
 */
export function getVRTYExplorerUrl(): string {
  return `${XRPL_NETWORKS.mainnet.explorerUrl}/token/${VRTY_ADDRESSES.issuer}`;
}

/**
 * Get explorer URL for a specific address
 */
export function getAddressExplorerUrl(
  address: string, 
  network: keyof typeof XRPL_NETWORKS = 'mainnet'
): string {
  return `${XRPL_NETWORKS[network].explorerUrl}/account/${address}`;
}

export default {
  VRTY_TOKEN,
  VRTY_ADDRESSES,
  WVRTY_TOKEN,
  XRPL_NETWORKS,
  SOLANA_NETWORKS,
  BRIDGE_CONFIG,
  STAKING_TIERS,
  GUILD_CONFIG,
  getEnvironmentConfig,
  isValidVRTYIssuer,
  isValidVRTYCurrency,
  getVRTYExplorerUrl,
  getAddressExplorerUrl,
};
