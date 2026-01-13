/**
 * Verity Protocol - VRTY Token API Routes
 * 
 * @description Production API endpoints for VRTY token operations on XRPL mainnet.
 * Provides real-time balance checking, transaction verification, and token info.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  VRTY_TOKEN, 
  VRTY_ADDRESSES, 
  WVRTY_TOKEN,
  BRIDGE_CONFIG,
  STAKING_TIERS,
  getEnvironmentConfig,
  isValidVRTYIssuer,
  getVRTYExplorerUrl,
  getAddressExplorerUrl,
} from '../../config/vrty-token.js';
import { getXRPLVRTYService, XRPLVRTYService } from '../../services/xrpl-vrty.service.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const addressSchema = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'Invalid XRPL address');
const txHashSchema = z.string().length(64, 'Invalid transaction hash');

/**
 * GET /api/v1/vrty/info
 * Get VRTY token information
 */
router.get('/info', async (req: Request, res: Response) => {
  const requestId = `vrty-info-${Date.now()}`;
  
  try {
    const config = getEnvironmentConfig();
    const network = (req.query['network'] as string) || config.xrpl.network;
    
    // Return static info if mainnet requested but we're in test mode
    if (network === 'mainnet') {
      const xrplService = getXRPLVRTYService('mainnet');
      
      try {
        await xrplService.connect();
        const tokenInfo = await xrplService.getVRTYTokenInfo();
        
        return res.json({
          success: true,
          data: {
            token: {
              symbol: VRTY_TOKEN.symbol,
              name: VRTY_TOKEN.name,
              decimals: VRTY_TOKEN.decimals,
              currencyCode: VRTY_TOKEN.currencyCode,
              currencyCodeHex: VRTY_TOKEN.currencyCodeHex,
            },
            supply: {
              total: VRTY_TOKEN.totalSupply,
              circulating: tokenInfo.circulatingSupply,
              distributionWalletBalance: tokenInfo.distributionWalletBalance,
            },
            addresses: {
              issuer: VRTY_ADDRESSES.issuer,
              distributionWallet: VRTY_ADDRESSES.distributionWallet,
            },
            network: 'mainnet',
            explorer: {
              token: getVRTYExplorerUrl(),
              issuer: getAddressExplorerUrl(VRTY_ADDRESSES.issuer),
              distribution: getAddressExplorerUrl(VRTY_ADDRESSES.distributionWallet),
            },
            bridge: {
              solana: {
                devnet: WVRTY_TOKEN.devnet,
                mainnet: WVRTY_TOKEN.mainnet,
              },
            },
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            network: 'mainnet',
            live: true,
          },
        });
      } catch (error) {
        // If mainnet connection fails, return static info
        logger.warn('Mainnet connection failed, returning static info');
      }
    }
    
    // Return static/configured info
    return res.json({
      success: true,
      data: {
        token: {
          symbol: VRTY_TOKEN.symbol,
          name: VRTY_TOKEN.name,
          decimals: VRTY_TOKEN.decimals,
          currencyCode: VRTY_TOKEN.currencyCode,
          currencyCodeHex: VRTY_TOKEN.currencyCodeHex,
        },
        supply: {
          total: VRTY_TOKEN.totalSupply,
        },
        addresses: {
          issuer: VRTY_ADDRESSES.issuer,
          distributionWallet: VRTY_ADDRESSES.distributionWallet,
        },
        network: config.xrpl.network,
        explorer: {
          token: getVRTYExplorerUrl(),
          issuer: getAddressExplorerUrl(VRTY_ADDRESSES.issuer),
          distribution: getAddressExplorerUrl(VRTY_ADDRESSES.distributionWallet),
        },
        bridge: {
          solana: {
            devnet: WVRTY_TOKEN.devnet,
            mainnet: WVRTY_TOKEN.mainnet,
          },
        },
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        network: config.xrpl.network,
        live: false,
      },
    });
  } catch (error: any) {
    logger.error('Error getting VRTY info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get VRTY token info',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/balance/:address
 * Get VRTY balance for an address
 */
router.get('/balance/:address', async (req: Request, res: Response) => {
  const requestId = `vrty-balance-${Date.now()}`;
  
  try {
    const address = req.params['address'] || '';
    const network = (req.query['network'] as string) || 'mainnet';
    
    // Validate address
    const validation = addressSchema.safeParse(address);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address format',
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }
    
    const xrplService = getXRPLVRTYService(network as 'mainnet' | 'testnet');
    await xrplService.connect();
    
    const validatedAddress = validation.data;
    const [vrtyBalance, xrpBalance] = await Promise.all([
      xrplService.getVRTYBalance(validatedAddress),
      xrplService.getXRPBalance(validatedAddress),
    ]);
    
    // Determine staking tier
    const balance = parseFloat(vrtyBalance.balance);
    let tier = 'EXPLORER';
    for (const [tierName, tierConfig] of Object.entries(STAKING_TIERS)) {
      if (balance >= tierConfig.minStake && balance <= tierConfig.maxStake) {
        tier = tierName;
        break;
      }
    }
    
    return res.json({
      success: true,
      data: {
        address: validatedAddress,
        vrty: {
          balance: vrtyBalance.balance,
          hasTrustline: vrtyBalance.hasVRTYTrustline,
          trustlineLimit: vrtyBalance.trustlineLimit,
        },
        xrp: {
          balance: xrpBalance,
        },
        staking: {
          tier,
          tierDetails: STAKING_TIERS[tier as keyof typeof STAKING_TIERS],
          nextTier: balance < STAKING_TIERS.COMMODORE.minStake 
            ? Object.entries(STAKING_TIERS).find(([, config]) => config.minStake > balance)?.[0]
            : null,
        },
        explorer: getAddressExplorerUrl(validatedAddress, network as 'mainnet' | 'testnet'),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        network,
      },
    });
  } catch (error: any) {
    logger.error('Error getting VRTY balance:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get VRTY balance',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * POST /api/v1/vrty/verify-stake
 * Verify if an address has sufficient VRTY stake
 */
router.post('/verify-stake', async (req: Request, res: Response) => {
  const requestId = `vrty-verify-${Date.now()}`;
  
  try {
    const { address, requiredAmount } = req.body;
    const network = (req.query['network'] as string) || 'mainnet';
    
    // Validate inputs
    const addressValidation = addressSchema.safeParse(address);
    if (!addressValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address format',
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }
    
    if (typeof requiredAmount !== 'number' || requiredAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid required amount',
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }
    
    const xrplService = getXRPLVRTYService(network as 'mainnet' | 'testnet');
    await xrplService.connect();
    
    const stakeVerification = await xrplService.verifyStake(address, requiredAmount);
    
    return res.json({
      success: true,
      data: {
        address,
        verification: stakeVerification,
        recommendation: stakeVerification.hasRequiredStake 
          ? 'Stake requirement met'
          : `Need ${stakeVerification.shortfall} more VRTY to meet requirement`,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        network,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying stake:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify stake',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/tx/:hash
 * Verify a VRTY transaction
 */
router.get('/tx/:hash', async (req: Request, res: Response) => {
  const requestId = `vrty-tx-${Date.now()}`;
  
  try {
    const hash = req.params['hash'] || '';
    const network = (req.query['network'] as string) || 'mainnet';
    const expectedAmount = req.query['amount'] as string | undefined;
    const expectedDestination = req.query['destination'] as string | undefined;
    
    // Validate hash
    const hashValidation = txHashSchema.safeParse(hash);
    if (!hashValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction hash format (must be 64 characters)',
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }
    
    const validatedHash = hashValidation.data;
    const xrplService = getXRPLVRTYService(network as 'mainnet' | 'testnet');
    await xrplService.connect();
    
    const txVerification = await xrplService.verifyVRTYTransaction(
      validatedHash,
      expectedAmount,
      expectedDestination
    );
    
    return res.json({
      success: true,
      data: {
        hash: validatedHash,
        verification: txVerification,
        explorerUrl: `https://xrpscan.com/tx/${validatedHash}`,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        network,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify transaction',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/transactions/:address
 * Get VRTY transaction history for an address
 */
router.get('/transactions/:address', async (req: Request, res: Response) => {
  const requestId = `vrty-txs-${Date.now()}`;
  
  try {
    const address = req.params['address'] || '';
    const network = (req.query['network'] as string) || 'mainnet';
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    
    // Validate address
    const validation = addressSchema.safeParse(address);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address format',
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }
    
    const validatedAddress = validation.data;
    const xrplService = getXRPLVRTYService(network as 'mainnet' | 'testnet');
    await xrplService.connect();
    
    const transactions = await xrplService.getVRTYTransactions(validatedAddress, limit);
    
    // Calculate summary
    const summary = {
      totalSent: transactions
        .filter(tx => tx.type === 'sent')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
        .toString(),
      totalReceived: transactions
        .filter(tx => tx.type === 'received')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
        .toString(),
      transactionCount: transactions.length,
    };
    
    return res.json({
      success: true,
      data: {
        address: validatedAddress,
        transactions,
        summary,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        network,
        limit,
      },
    });
  } catch (error: any) {
    logger.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/validate-issuer/:address
 * Validate if an address is the official VRTY issuer
 */
router.get('/validate-issuer/:address', async (req: Request, res: Response) => {
  const requestId = `vrty-validate-${Date.now()}`;
  
  try {
    const address = req.params['address'] || '';
    
    const isValid = isValidVRTYIssuer(address);
    
    return res.json({
      success: true,
      data: {
        address,
        isOfficialIssuer: isValid,
        officialIssuer: VRTY_ADDRESSES.issuer,
        warning: !isValid 
          ? 'This address is NOT the official VRTY issuer. Do not trust tokens from this address!'
          : null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Error validating issuer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate issuer',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/staking-tiers
 * Get staking tier information
 */
router.get('/staking-tiers', async (req: Request, res: Response) => {
  const requestId = `vrty-tiers-${Date.now()}`;
  
  return res.json({
    success: true,
    data: {
      tiers: STAKING_TIERS,
      guildRequirements: {
        minStakeToCreate: 10000,
        defaultMinStakeToJoin: 100,
      },
      bridgeRequirements: BRIDGE_CONFIG,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/v1/vrty/network-status
 * Get XRPL network status
 */
router.get('/network-status', async (req: Request, res: Response) => {
  const requestId = `vrty-status-${Date.now()}`;
  
  try {
    const network = (req.query['network'] as string) || 'mainnet';
    
    const xrplService = getXRPLVRTYService(network as 'mainnet' | 'testnet');
    await xrplService.connect();
    
    const serverInfo = await xrplService.getServerInfo();
    
    return res.json({
      success: true,
      data: serverInfo,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Error getting network status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get network status',
      message: error.message,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/vrty/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const requestId = `vrty-health-${Date.now()}`;
  
  try {
    // Quick health check without full connection
    const config = getEnvironmentConfig();
    
    return res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'vrty-api',
        version: '1.0.0',
        config: {
          xrplNetwork: config.xrpl.network,
          solanaNetwork: config.solana.network,
          vrtyIssuer: VRTY_ADDRESSES.issuer,
          wvrtyMint: config.solana.wvrty.mint || 'not-configured',
        },
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

export const vrtyRoutes = router;
export default router;
