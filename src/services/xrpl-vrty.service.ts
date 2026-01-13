/**
 * Verity Protocol - XRPL VRTY Token Service
 * 
 * @description Real XRPL service for VRTY token operations.
 * Connects to XRPL mainnet to verify token balances, trustlines, and transactions.
 * 
 * @version 1.0.0
 */

import { Client, AccountLinesRequest, AccountInfoRequest, dropsToXrp, TxRequest } from 'xrpl';
import { VRTY_TOKEN, VRTY_ADDRESSES, XRPL_NETWORKS } from '../config/vrty-token.js';
import logger from '../utils/logger.js';

type NetworkType = keyof typeof XRPL_NETWORKS;

/**
 * XRPL VRTY Service class
 */
export class XRPLVRTYService {
  private client: Client | null = null;
  private network: NetworkType;
  private connectionPromise: Promise<void> | null = null;

  constructor(network: NetworkType = 'mainnet') {
    this.network = network;
  }

  /**
   * Connect to XRPL network
   */
  async connect(): Promise<void> {
    if (this.client?.isConnected()) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    const networkConfig = XRPL_NETWORKS[this.network];
    this.client = new Client(networkConfig.server);
    
    try {
      await this.client.connect();
      logger.info(`Connected to XRPL ${this.network}: ${networkConfig.server}`);
    } catch (error) {
      logger.error(`Failed to connect to XRPL ${this.network}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from XRPL
   */
  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      logger.info(`Disconnected from XRPL ${this.network}`);
    }
    this.client = null;
  }

  /**
   * Ensure connection is active
   */
  private async ensureConnection(): Promise<Client> {
    if (!this.client?.isConnected()) {
      await this.connect();
    }
    return this.client!;
  }

  /**
   * Get VRTY balance for an address
   */
  async getVRTYBalance(address: string): Promise<{
    balance: string;
    hasVRTYTrustline: boolean;
    trustlineLimit: string;
  }> {
    const client = await this.ensureConnection();
    
    try {
      const request: AccountLinesRequest = {
        command: 'account_lines',
        account: address,
        peer: VRTY_ADDRESSES.issuer,
      };

      const response = await client.request(request);
      
      // Find VRTY trustline
      const vrtyLine = response.result.lines.find(
        (line) => line.currency === VRTY_TOKEN.currencyCode || 
                  line.currency === VRTY_TOKEN.currencyCodeHex
      );

      if (vrtyLine) {
        return {
          balance: vrtyLine.balance,
          hasVRTYTrustline: true,
          trustlineLimit: vrtyLine.limit,
        };
      }

      return {
        balance: '0',
        hasVRTYTrustline: false,
        trustlineLimit: '0',
      };
    } catch (error: any) {
      if (error.data?.error === 'actNotFound') {
        return {
          balance: '0',
          hasVRTYTrustline: false,
          trustlineLimit: '0',
        };
      }
      throw error;
    }
  }

  /**
   * Get XRP balance for an address
   */
  async getXRPBalance(address: string): Promise<string> {
    const client = await this.ensureConnection();
    
    try {
      const request: AccountInfoRequest = {
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      };

      const response = await client.request(request);
      return dropsToXrp(response.result.account_data.Balance).toString();
    } catch (error: any) {
      if (error.data?.error === 'actNotFound') {
        return '0';
      }
      throw error;
    }
  }

  /**
   * Verify if an address has sufficient VRTY stake
   */
  async verifyStake(address: string, requiredAmount: number): Promise<{
    hasRequiredStake: boolean;
    currentBalance: string;
    requiredAmount: string;
    shortfall: string;
  }> {
    const { balance } = await this.getVRTYBalance(address);
    const currentBalance = parseFloat(balance);
    const hasRequiredStake = currentBalance >= requiredAmount;
    
    return {
      hasRequiredStake,
      currentBalance: balance,
      requiredAmount: requiredAmount.toString(),
      shortfall: hasRequiredStake ? '0' : (requiredAmount - currentBalance).toString(),
    };
  }

  /**
   * Get VRTY token info from issuer
   */
  async getVRTYTokenInfo(): Promise<{
    issuer: string;
    currencyCode: string;
    totalSupply: string;
    issuerBalance: string;
    distributionWalletBalance: string;
    circulatingSupply: string;
  }> {
    const [issuerInfo, distributionInfo] = await Promise.all([
      this.getVRTYBalance(VRTY_ADDRESSES.issuer),
      this.getVRTYBalance(VRTY_ADDRESSES.distributionWallet),
    ]);

    // Issuer balance is negative (representing issued tokens)
    const issuedAmount = Math.abs(parseFloat(issuerInfo.balance));
    const distributionBalance = parseFloat(distributionInfo.balance);
    
    // Circulating = Total issued - Distribution wallet holdings
    const circulatingSupply = issuedAmount - distributionBalance;

    return {
      issuer: VRTY_ADDRESSES.issuer,
      currencyCode: VRTY_TOKEN.currencyCode,
      totalSupply: VRTY_TOKEN.totalSupply,
      issuerBalance: issuerInfo.balance, // Negative = tokens issued
      distributionWalletBalance: distributionInfo.balance,
      circulatingSupply: circulatingSupply.toString(),
    };
  }

  /**
   * Check if a transaction is a valid VRTY payment
   */
  async verifyVRTYTransaction(
    txHash: string,
    expectedAmount?: string,
    expectedDestination?: string
  ): Promise<{
    isValid: boolean;
    confirmed: boolean;
    amount: string;
    currency: string;
    source: string;
    destination: string;
    ledgerIndex: number;
    timestamp: string | null;
    error?: string;
  }> {
    const client = await this.ensureConnection();
    
    try {
      const request: TxRequest = {
        command: 'tx',
        transaction: txHash,
      };

      const response = await client.request(request);
      const tx = response.result;
      
      // Check if validated
      if (!tx.validated) {
        return {
          isValid: false,
          confirmed: false,
          amount: '0',
          currency: '',
          source: '',
          destination: '',
          ledgerIndex: 0,
          timestamp: null,
          error: 'Transaction not validated',
        };
      }

      // Check if it's a Payment transaction
      if (tx.TransactionType !== 'Payment') {
        return {
          isValid: false,
          confirmed: true,
          amount: '0',
          currency: '',
          source: tx.Account || '',
          destination: '',
          ledgerIndex: tx.ledger_index || 0,
          timestamp: tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
          error: 'Not a Payment transaction',
        };
      }

      // Check if it's a VRTY payment
      const amount = tx.Amount;
      let isVRTY = false;
      let paymentAmount = '0';
      let currency = 'XRP';

      if (typeof amount === 'object' && 'currency' in amount) {
        isVRTY = amount.currency === VRTY_TOKEN.currencyCode || 
                 amount.currency === VRTY_TOKEN.currencyCodeHex;
        if (isVRTY) {
          paymentAmount = amount.value;
          currency = 'VRTY';
        }
      }

      if (!isVRTY) {
        return {
          isValid: false,
          confirmed: true,
          amount: paymentAmount,
          currency,
          source: tx.Account || '',
          destination: tx.Destination || '',
          ledgerIndex: tx.ledger_index || 0,
          timestamp: tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
          error: 'Not a VRTY payment',
        };
      }

      // Validate expected values if provided
      let isValid = true;
      let error: string | undefined;

      if (expectedAmount && paymentAmount !== expectedAmount) {
        isValid = false;
        error = `Amount mismatch: expected ${expectedAmount}, got ${paymentAmount}`;
      }

      if (expectedDestination && tx.Destination !== expectedDestination) {
        isValid = false;
        error = `Destination mismatch: expected ${expectedDestination}, got ${tx.Destination}`;
      }

      // Check transaction result
      const meta = tx.meta;
      if (typeof meta === 'object' && 'TransactionResult' in meta) {
        if (meta.TransactionResult !== 'tesSUCCESS') {
          isValid = false;
          error = `Transaction failed: ${meta.TransactionResult}`;
        }
      }

      return {
        isValid,
        confirmed: true,
        amount: paymentAmount,
        currency: 'VRTY',
        source: tx.Account || '',
        destination: tx.Destination || '',
        ledgerIndex: tx.ledger_index || 0,
        timestamp: tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
        error,
      };
    } catch (error: any) {
      return {
        isValid: false,
        confirmed: false,
        amount: '0',
        currency: '',
        source: '',
        destination: '',
        ledgerIndex: 0,
        timestamp: null,
        error: error.message || 'Failed to verify transaction',
      };
    }
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<{
    network: string;
    server: string;
    ledgerIndex: number;
    serverVersion: string;
    connected: boolean;
  }> {
    const client = await this.ensureConnection();
    
    const response = await client.request({
      command: 'server_info',
    });

    return {
      network: this.network,
      server: XRPL_NETWORKS[this.network].server,
      ledgerIndex: response.result.info.validated_ledger?.seq || 0,
      serverVersion: response.result.info.build_version,
      connected: client.isConnected(),
    };
  }

  /**
   * Get account transactions (VRTY only)
   */
  async getVRTYTransactions(
    address: string,
    limit: number = 20
  ): Promise<Array<{
    hash: string;
    type: 'sent' | 'received';
    amount: string;
    counterparty: string;
    timestamp: string | null;
    ledgerIndex: number;
  }>> {
    const client = await this.ensureConnection();
    
    const response = await client.request({
      command: 'account_tx',
      account: address,
      limit,
      ledger_index_min: -1,
      ledger_index_max: -1,
    });

    const vrtyTransactions = response.result.transactions
      .filter((tx) => {
        const transaction = tx.tx;
        if (!transaction || transaction.TransactionType !== 'Payment') {
          return false;
        }
        const amount = transaction.Amount;
        if (typeof amount !== 'object' || !('currency' in amount)) {
          return false;
        }
        return amount.currency === VRTY_TOKEN.currencyCode ||
               amount.currency === VRTY_TOKEN.currencyCodeHex;
      })
      .map((tx) => {
        const transaction = tx.tx as any;
        const amount = transaction.Amount as { value: string };
        const isSent = transaction.Account === address;
        
        return {
          hash: transaction.hash || '',
          type: isSent ? 'sent' as const : 'received' as const,
          amount: amount.value,
          counterparty: isSent ? (transaction.Destination || '') : (transaction.Account || ''),
          timestamp: transaction.date 
            ? new Date((transaction.date + 946684800) * 1000).toISOString() 
            : null,
          ledgerIndex: transaction.ledger_index || 0,
        };
      });

    return vrtyTransactions;
  }
}

// Singleton instances for each network
const mainnetService = new XRPLVRTYService('mainnet');
const testnetService = new XRPLVRTYService('testnet');

/**
 * Get XRPL VRTY service for specified network
 */
export function getXRPLVRTYService(network: NetworkType = 'mainnet'): XRPLVRTYService {
  switch (network) {
    case 'mainnet':
      return mainnetService;
    case 'testnet':
      return testnetService;
    default:
      return new XRPLVRTYService(network);
  }
}

export default XRPLVRTYService;
