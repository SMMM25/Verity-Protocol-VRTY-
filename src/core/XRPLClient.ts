/**
 * Verity Protocol - XRPL Client
 * Core connection and transaction management for XRP Ledger
 */

import {
  Client,
  Wallet,
  xrpToDrops,
  dropsToXrp,
  AccountInfoRequest,
  AccountLinesRequest,
  AccountNFTsRequest,
  AccountOffersRequest,
  AccountTxRequest,
  LedgerRequest,
  SubmitRequest,
  Transaction,
  TxRequest,
} from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger.js';
import type { XRPLNetwork, NetworkConfig } from '../types/index.js';

// Network configuration mapping
const NETWORK_CONFIGS: Record<XRPLNetwork, NetworkConfig> = {
  mainnet: {
    url: 'wss://xrplcluster.com',
    network: 'mainnet',
    explorerUrl: 'https://livenet.xrpl.org',
  },
  testnet: {
    url: 'wss://s.altnet.rippletest.net:51233',
    network: 'testnet',
    explorerUrl: 'https://testnet.xrpl.org',
    faucetUrl: 'https://faucet.altnet.rippletest.net/accounts',
  },
  devnet: {
    url: 'wss://s.devnet.rippletest.net:51233',
    network: 'devnet',
    explorerUrl: 'https://devnet.xrpl.org',
    faucetUrl: 'https://faucet.devnet.rippletest.net/accounts',
  },
};

export interface XRPLClientConfig {
  network: XRPLNetwork;
  customUrl?: string;
  timeout?: number;
}

export interface AccountBalance {
  currency: string;
  value: string;
  issuer?: string;
}

export interface TransactionResult {
  success: boolean;
  hash: string;
  result: string;
  ledgerIndex?: number;
  fee?: string;
  error?: string;
}

/**
 * Core XRPL Client for Verity Protocol
 * Handles all direct interactions with the XRP Ledger
 */
export class XRPLClient extends EventEmitter {
  private client: Client;
  private network: XRPLNetwork;
  private networkConfig: NetworkConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: XRPLClientConfig) {
    super();
    this.network = config.network;
    this.networkConfig = NETWORK_CONFIGS[config.network];
    
    const url = config.customUrl || this.networkConfig.url;
    this.client = new Client(url, {
      timeout: config.timeout || 20000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info(`Connected to XRPL ${this.network}`);
      this.emit('connected', this.network);
    });

    this.client.on('disconnected', (code) => {
      this.isConnected = false;
      logger.warn(`Disconnected from XRPL ${this.network} with code ${code}`);
      this.emit('disconnected', code);
      this.attemptReconnect();
    });

    this.client.on('error', (error) => {
      logger.error(`XRPL client error: ${error}`);
      this.emit('error', error);
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Reconnection attempt failed: ${error}`);
      }
    }, delay);
  }

  /**
   * Connect to the XRPL network
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('Already connected to XRPL');
      return;
    }

    try {
      await this.client.connect();
      logger.info(`Successfully connected to XRPL ${this.network}`);
    } catch (error) {
      logger.error(`Failed to connect to XRPL: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from the XRPL network
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from XRPL');
    } catch (error) {
      logger.error(`Error disconnecting: ${error}`);
      throw error;
    }
  }

  /**
   * Get the underlying XRPL client
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Check if connected to XRPL
   */
  connected(): boolean {
    return this.isConnected && this.client.isConnected();
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): NetworkConfig {
    return this.networkConfig;
  }

  /**
   * Generate a new wallet
   */
  generateWallet(): Wallet {
    return Wallet.generate();
  }

  /**
   * Create wallet from seed
   */
  walletFromSeed(seed: string): Wallet {
    return Wallet.fromSeed(seed);
  }

  /**
   * Fund a wallet using the testnet/devnet faucet
   */
  async fundWallet(wallet: Wallet): Promise<{ balance: number; wallet: Wallet }> {
    if (this.network === 'mainnet') {
      throw new Error('Cannot fund wallet on mainnet');
    }

    try {
      const result = await this.client.fundWallet(wallet);
      logger.info(`Funded wallet ${wallet.address} with ${result.balance} XRP`);
      return result;
    } catch (error) {
      logger.error(`Failed to fund wallet: ${error}`);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(address: string): Promise<Record<string, unknown>> {
    const request: AccountInfoRequest = {
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    };

    const response = await this.client.request(request);
    return response.result['account_data'] as unknown as Record<string, unknown>;
  }

  /**
   * Get account XRP balance
   */
  async getXRPBalance(address: string): Promise<string> {
    try {
      const accountInfo = await this.getAccountInfo(address);
      const balance = accountInfo['Balance'] as string;
      return dropsToXrp(balance).toString();
    } catch (error) {
      if ((error as Error).message.includes('actNotFound')) {
        return '0';
      }
      throw error;
    }
  }

  /**
   * Get account trust lines (issued currencies)
   */
  async getAccountLines(address: string): Promise<AccountBalance[]> {
    const request: AccountLinesRequest = {
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    };

    const response = await this.client.request(request);
    const lines = response.result['lines'] as unknown as Array<Record<string, string>>;

    return lines.map((line) => ({
      currency: line['currency'] as string,
      value: line['balance'] as string,
      issuer: line['account'] as string,
    }));
  }

  /**
   * Get account NFTs
   */
  async getAccountNFTs(address: string): Promise<unknown[]> {
    const request: AccountNFTsRequest = {
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated',
    };

    const response = await this.client.request(request);
    return response.result['account_nfts'] as unknown[];
  }

  /**
   * Get account offers (DEX orders)
   */
  async getAccountOffers(address: string): Promise<unknown[]> {
    const request: AccountOffersRequest = {
      command: 'account_offers',
      account: address,
      ledger_index: 'validated',
    };

    const response = await this.client.request(request);
    return response.result['offers'] as unknown[];
  }

  /**
   * Get account transaction history
   */
  async getAccountTransactions(
    address: string,
    limit = 20
  ): Promise<unknown[]> {
    const request: AccountTxRequest = {
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit,
    };

    const response = await this.client.request(request);
    return response.result['transactions'] as unknown[];
  }

  /**
   * Get current ledger information
   */
  async getLedgerInfo(): Promise<Record<string, unknown>> {
    const request: LedgerRequest = {
      command: 'ledger',
      ledger_index: 'validated',
      full: false,
      accounts: false,
      transactions: false,
      expand: false,
      owner_funds: false,
    };

    const response = await this.client.request(request);
    return response.result['ledger'] as unknown as Record<string, unknown>;
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(hash: string): Promise<Record<string, unknown>> {
    const request: TxRequest = {
      command: 'tx',
      transaction: hash,
    };

    const response = await this.client.request(request);
    return response.result as unknown as Record<string, unknown>;
  }

  /**
   * Submit a signed transaction
   */
  async submitTransaction(txBlob: string): Promise<TransactionResult> {
    const request: SubmitRequest = {
      command: 'submit',
      tx_blob: txBlob,
    };

    const response = await this.client.request(request);
    const result = response.result;

    return {
      success: result['engine_result'] === 'tesSUCCESS',
      hash: result['tx_json']?.['hash'] as string || '',
      result: result['engine_result'] as string,
      error: result['engine_result'] !== 'tesSUCCESS' 
        ? result['engine_result_message'] as string 
        : undefined,
    };
  }

  /**
   * Autofill transaction fields
   */
  async autofill<T extends Transaction>(transaction: T): Promise<T> {
    return await this.client.autofill(transaction as any) as T;
  }

  /**
   * Submit a transaction and wait for validation
   */
  async submitAndWait(
    transaction: Transaction,
    wallet: Wallet
  ): Promise<TransactionResult> {
    try {
      // Autofill the transaction
      const prepared = await this.autofill(transaction);
      
      // Sign the transaction
      const signed = wallet.sign(prepared);
      
      // Submit and wait
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result['meta'];
      const isSuccess = 
        typeof meta === 'object' && 
        meta !== null && 
        'TransactionResult' in meta &&
        meta.TransactionResult === 'tesSUCCESS';

      return {
        success: isSuccess,
        hash: result.result['hash'] as string,
        result: typeof meta === 'object' && meta !== null && 'TransactionResult' in meta
          ? meta.TransactionResult as string
          : 'unknown',
        ledgerIndex: result.result['ledger_index'] as number,
        fee: prepared['Fee'],
      };
    } catch (error) {
      logger.error(`Transaction submission failed: ${error}`);
      return {
        success: false,
        hash: '',
        result: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Convert XRP to drops
   */
  static xrpToDrops(xrp: string | number): string {
    return xrpToDrops(xrp);
  }

  /**
   * Convert drops to XRP
   */
  static dropsToXrp(drops: string | number): string {
    return dropsToXrp(drops).toString();
  }
}

export default XRPLClient;
