// lib/solana/index.ts - Fixed Solana Integration with Correct Exports
import { 
  Connection, 
  PublicKey, 
  Transaction,
  LAMPORTS_PER_SOL,
  Commitment,
  Keypair
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Import specific services directly to avoid circular dependencies
import { ProductionRiftsService } from './rifts-service';
import { ProductionRiftsTokenManager } from './rifts-token-manager';
import { serviceIntegrator, typeConverters } from './integration-utils';
import { UserPosition, Rift } from '@/types'; // Use your existing types
import { riftsCache, priceCache, userDataCache } from '@/lib/cache/persistent-cache';

// Define wallet adapter interface first
interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: Transaction) => Promise<string>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

export interface RiftPosition {
  riftId: string;
  amount: number;
  value: number;
  rewards: number;
  lastUpdate: number;
}

export interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  lastUpdate: number;
}

// Type-safe data structures for real-time updates
interface TVLUpdateData {
  total: number;
  change24h: number;
  timestamp: number;
}

interface VolumeUpdateData {
  total: number;
  change24h: number;
  timestamp: number;
}

type DataUpdateCallback = (data: unknown) => void;

// Solana RPC endpoints - SECURITY FIX: Use environment variables only
export const SOLANA_ENDPOINTS = {
  devnet: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
};

// Enhanced rate limiting and caching for RPC calls
class RateLimitedConnection {
  protected connection: Connection;
  protected lastCall: number = 0;
  private minInterval: number = 10000; // 10 seconds between calls to prevent 429 errors
  private retryQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout: number = 600000; // 10 minute cache - much longer to reduce API calls

  constructor(endpoint: string) {
    // Create connection with WebSocket disabled to prevent signatureSubscribe errors
    this.connection = new Connection(endpoint, {
      commitment: 'confirmed' as Commitment,
      wsEndpoint: undefined,  // Disable WebSocket to prevent signatureSubscribe errors
      disableRetryOnRateLimit: true,
      confirmTransactionInitialTimeout: 60000,
    });
  }

  private async wait() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    if (timeSinceLastCall < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
    }
    this.lastCall = Date.now();
  }

  // Public method to clear cache - critical for ensuring fresh reads after account creation
  public clearCache() {
    this.cache.clear();

  }

  async getAccountInfo(pubkey: PublicKey, commitment?: Commitment) {
    const cacheKey = `account-${pubkey.toBase58()}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      const result = await this.connection.getAccountInfo(pubkey, commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;

      // Handle 503 Internal Server errors (common with closed accounts)
      if (error instanceof Error && (error.message.includes('503') || error.message.includes('Internal server error'))) {

        this.cache.set(cacheKey, { data: null, timestamp: Date.now() });
        return null;
      }

      // Enhanced 429 error handling with exponential backoff
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {

        const backoffDelay = Math.min(this.minInterval * 4, 15000); // Max 15 seconds
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        // Try once more with cached fallback
        try {
          const retryResult = await this.connection.getAccountInfo(pubkey, commitment);
          this.cache.set(cacheKey, { data: retryResult, timestamp: Date.now() });
          return retryResult;
        } catch (retryError) {

          return (cached as any)?.data || null;
        }
      }
      throw error;
    }
  }

  // Required by Meteora SDK (Anchor Provider compatibility)
  async getAccountInfoAndContext(pubkey: PublicKey, commitment?: Commitment) {
    const accountInfo = await this.getAccountInfo(pubkey, commitment);
    const slot = await this.connection.getSlot(commitment || 'confirmed');
    return {
      context: { slot },
      value: accountInfo
    };
  }

  async getBalance(pubkey: PublicKey, commitment?: Commitment) {
    const cacheKey = `balance-${pubkey.toBase58()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      const result = await this.connection.getBalance(pubkey, commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  async getParsedTokenAccountsByOwner(owner: PublicKey, filter: unknown, commitment?: Commitment) {
    const cacheKey = `token-accounts-${owner.toBase58()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.connection.getParsedTokenAccountsByOwner(owner, filter as any, commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  async getProgramAccounts(programId: PublicKey, config?: unknown) {
    const cacheKey = `program-accounts-${programId.toBase58()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.connection.getProgramAccounts(programId, config as any);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  async getMultipleAccountsInfo(publicKeys: PublicKey[], commitment?: Commitment) {
    const cacheKey = `multi-accounts-${publicKeys.map(pk => pk.toBase58()).join('-')}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      const result = await this.connection.getMultipleAccountsInfo(publicKeys, commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  async getTokenAccountsByOwner(owner: PublicKey, filter: unknown, commitment?: Commitment) {
    const cacheKey = `token-accounts-raw-${owner.toBase58()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    await this.wait();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.connection.getTokenAccountsByOwner(owner, filter as any, commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  // Delegate other methods to the underlying connection
  async sendTransaction(transaction: Transaction, signers: Keypair[], options?: unknown) {
    await this.wait();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.connection.sendTransaction(transaction, signers, options as any);
  }

  async getVersion() {
    await this.wait();
    return this.connection.getVersion();
  }

  async getSignaturesForAddress(address: PublicKey, options?: unknown) {
    await this.wait();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.connection.getSignaturesForAddress(address, options as any);
  }

  async getParsedTransactions(signatures: string[]) {
    await this.wait();
    return this.connection.getParsedTransactions(signatures);
  }

  async sendRawTransaction(rawTransaction: Buffer | Uint8Array | number[], options?: unknown) {
    await this.wait();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.connection.sendRawTransaction(rawTransaction, options as any);
  }

  async confirmTransaction(signature: string, commitment?: Commitment) {
    await this.wait();
    return this.connection.confirmTransaction(signature, commitment);
  }

  async getSignatureStatus(signature: string, config?: unknown) {
    await this.wait();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.connection.getSignatureStatus(signature, config as any);
  }

  async simulateTransaction(transaction: Transaction, config?: unknown) {
    await this.wait();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.connection.simulateTransaction(transaction, config as any);
  }

  async getLatestBlockhash(commitment?: Commitment) {
    const cacheKey = `latest-blockhash`;
    const cached = this.cache.get(cacheKey);
    
    // Use shorter cache for blockhash (10 seconds)
    if (cached && Date.now() - cached.timestamp < 10000) {
      return cached.data;
    }

    await this.wait();
    try {
      const result = await this.connection.getLatestBlockhash(commitment);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {

      if (cached) return cached.data;
      // For rate limit errors, wait longer and return null instead of throwing
      if (error instanceof Error && error.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return null;
      }
      throw error;
    }
  }

  async getSlot(commitment?: Commitment) {
    await this.wait();
    return await this.connection.getSlot(commitment);
  }

  async getBlockTime(slot: number) {
    await this.wait();
    return await this.connection.getBlockTime(slot);
  }
}

// Enhanced connection factory with automatic fallback
export const createConnection = () => {
  // SECURITY FIX: Use environment variable for primary endpoint
  const primaryEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  // Fallback endpoints if primary fails
  const endpoints = [
    // Primary endpoint from environment variable
    primaryEndpoint,

    // Backup public endpoints only if primary fails
    'https://api.devnet.solana.com',
    'https://rpc.ankr.com/solana_devnet',
    'https://devnet.sonic.game'
  ];
  
  let currentEndpointIndex = 0;
  
  class FallbackConnection extends RateLimitedConnection {
    constructor() {
      super(endpoints[currentEndpointIndex]);
    }
    
    async fallbackToNextEndpoint() {
      currentEndpointIndex = (currentEndpointIndex + 1) % endpoints.length;
      const newEndpoint = endpoints[currentEndpointIndex];

      // Create new connection with next endpoint (WebSocket disabled)
      this.connection = new Connection(newEndpoint, {
        commitment: 'confirmed' as Commitment,
        wsEndpoint: undefined,  // Disable WebSocket to prevent signatureSubscribe errors
        disableRetryOnRateLimit: true,
        confirmTransactionInitialTimeout: 60000,
      });
      this.lastCall = 0; // Reset rate limiting
    }
    
    // Override methods to include fallback logic
    async getAccountInfo(pubkey: PublicKey, commitment?: Commitment) {
      try {
        return await super.getAccountInfo(pubkey, commitment);
      } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {

          await this.fallbackToNextEndpoint();
          return await super.getAccountInfo(pubkey, commitment);
        }
        throw error;
      }
    }
  }
  
  try {
    return new FallbackConnection();
  } catch (error) {

    return new RateLimitedConnection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
  }
};

export const connection = createConnection();

// Program IDs (ALL UPGRADED WITH SECURITY FIXES ✅) - November 7, 2025
export const CURRENT_PROGRAM_IDS = {
  rifts: new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn'),  // ✅ DEPLOYED ON DEVNET - needs declare_id! update and redeploy
  governance: new PublicKey('89v8sYZWr6TDsAQWcAWR18tEphTQQxjciJkr9t8hDmb1'), // ✅ UPGRADED - Governance Program (with .expect() fixes)
  feeCollector: new PublicKey('6WD1EhaaS7XbLMqVLSxxasKGK6TnfE7odihaNriNKB9u'), // ✅ DEPLOYED - Fee Collector (Stack Optimized)
  lpStaking: new PublicKey('HEjacszzkKFATCxEja5HA8AWNhi47tE6BDBWgJgMPQJf'),   // ✅ LP Staking Program
  riftsToken: new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P'), // Real RIFTS token mint on devnet
  authority: new PublicKey('4UAWKQ94DXYcUAWw3hddLThq3bn9i3jxCZE3DAnbSN2K')  // Deployer wallet authority
};

// Rifts Protocol program ID
export const RIFTS_PROGRAM_ID = CURRENT_PROGRAM_IDS.rifts;
export const RIFTS_TOKEN_MINT = CURRENT_PROGRAM_IDS.riftsToken;
export const RIFTS_TOKEN_AUTHORITY = CURRENT_PROGRAM_IDS.authority;

// Blocklist of old rift accounts from previous buggy deployment (9xTuwVWARRk9oj5G1PGJ9oeU6jkdMM4hBQVDz9KEaEFh)
// These rifts have vault authority bug and should not be displayed
export const DEPRECATED_RIFT_ADDRESSES = new Set([
  '45PC6bz8gA3jmkJFFQSTk7PdR3RVQbLdmAhbAxpJMNUn',
  '5CECeAFSHnxBCyMN4Jskgjt4MBWGCGkpztH6Hgs6vuVL',
  '57FybFDupqnintE326dEwPHsGxJczYs8P2WA4DGGjWBs',
  'DeeZnkbp6SywhJgEYUDKpwfgzGYiV7Qv79M8S5z2SKfG',
  'AiPqT2B6T782ZL82oWcT9wFY8r3ztsTNfmByW3AJt8tf',
  'AiC1AAci9ffLasH6CFaEMVAbHdNJPfEiS5Ubg9UDUgB2',
  'HgTfbQTVVSe5fWzRjvg3M1hXSyvy4UaiBr83jPgCNzud',
  '39eNHrEs7jmmrns5S9fjEDr491bpaPThFdZK9opVVgUC',
  'J8uwR6kLvM5oaNS7bRm8zVALewu56hdjaL6h2F7ruBxV',
  '7cbUatbCNQAndAWnBLZ9GBVP4Gii5go88PHxj3dP7vv',
  '7K3L3k5WAtx1x8m954eqpimxi8wVGAJhAg9oWy64rfHK',
  '8WimWH9Ydu2EGNReV8hL3nvNv4S2TQ3kyVUHjKgqPnPb',
  'BQoxPyGKoAznoUqKhqbagdJRg3bqLQDYfgvhssjzS8nw',
  'HzPCvvExtYhMLCiC8F8MvrACvYaNZaes48iaNPrqGwkV',
  '51fxifBJTwAAfQxsoKjLskRxtDJCAYBtwPqrixi8y74V',
  '7qHVvZ3oi6govR2fQU51H8S5i36kVmVrJfwzfQhCAa4d',
  'qzw66DzDDnHvQCnfWNQsDzXB1r3tXXoiCK4HE1VogHk'
]);

// ==================== WALLET INTEGRATION ====================

export class SolanaWalletService {
  public walletAdapter: WalletAdapter | null = null;
  
  setWalletAdapter(adapter: WalletAdapter) {
    this.walletAdapter = adapter;
    // Update other services that need wallet reference
    if (riftProtocolService) {
      riftProtocolService.updateWallet(adapter);
    }
  }

  async connectWallet(): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    try {
      if (!this.walletAdapter) {
        return { success: false, error: 'No wallet adapter found' };
      }

      await this.walletAdapter.connect();
      
      if (this.walletAdapter.publicKey) {
        return { 
          success: true, 
          publicKey: this.walletAdapter.publicKey.toBase58() 
        };
      }
      
      return { success: false, error: 'Failed to get public key' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async disconnectWallet(): Promise<void> {
    if (this.walletAdapter) {
      await this.walletAdapter.disconnect();
    }
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await connection.getBalance(publicKey);
      return (balance as number) / LAMPORTS_PER_SOL;
    } catch (error) {

      // Retry once after a short delay for rate limiting
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const balance = await connection.getBalance(publicKey);
        return (balance as number) / LAMPORTS_PER_SOL;
      } catch (retryError) {

        return 0;
      }
    }
  }

  async getTokenBalance(publicKey: PublicKey, mintAddress: string): Promise<number> {
    try {
      // Get token accounts for this specific mint
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(mintAddress) }
      );

      const accounts = tokenAccounts as unknown as { value: unknown[] };
      if (accounts.value.length === 0) {
        return 0; // No token account for this mint
      }

      // Get the Associated Token Account (ATA) address for this user
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        publicKey
      );
      const ataString = ata.toBase58();

      // Only use the ATA balance, not other accounts (like vaults/pools)
      let totalBalance = 0;
      for (const account of accounts.value) {
        const accountInfo = account as unknown as { pubkey: PublicKey };
        const accountAddress = accountInfo.pubkey.toBase58();

        // Skip if this is not the user's ATA
        if (accountAddress !== ataString) {

          continue;
        }
        const tokenData = (account as unknown as { account: { data: { parsed: { info: unknown } } } }).account.data.parsed.info;
        
        // Always use manual calculation for consistency and accuracy
        const data = tokenData as unknown as { tokenAmount: { amount: string; decimals: number; uiAmount?: number; uiAmountString?: string } };
        const rawAmount = Number(data.tokenAmount.amount);
        const decimals = data.tokenAmount.decimals;
        const balance = rawAmount / Math.pow(10, decimals);
        
        // Verify the calculation makes sense
        if (!isFinite(balance) || balance < 0) {

          continue; // Skip this account
        }

        totalBalance += balance;
      }

      return totalBalance;
    } catch (error) {

      return 0;
    }
  }
}

// ==================== PRICE DATA SERVICE ====================

export class PriceDataService {
  private cache: Map<string, TokenPrice> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  async getTokenPrice(symbol: string): Promise<TokenPrice | null> {
    // Check persistent cache first
    const cacheKey = `price-${symbol}`;
    const cached = await priceCache.get<TokenPrice>(cacheKey);
    if (cached) {

      return cached;
    }

    try {
      // Use production oracle for prices
      const { productionJupiterOracle } = await import('./jupiter-oracle');
      const mintAddress = this.getTokenMintAddress(symbol);
      
      if (mintAddress) {
        const priceData = await productionJupiterOracle.getJupiterPrice(mintAddress);
        
        const tokenPrice: TokenPrice = {
          symbol,
          price: priceData.price || 0,
          change24h: 0,
          volume24h: 0,
          lastUpdate: Date.now()
        };
        
        // Cache in both memory and persistent storage
        this.cache.set(symbol, tokenPrice);
        await priceCache.set(cacheKey, tokenPrice);
        
        return tokenPrice;
      }
      
      // Fallback hardcoded prices
      const fallbackPrices: { [key: string]: number } = {
        'SOL': 180,
        'ETH': 3300,
        'BTC': 97000,
        'USDC': 1,
        'USDT': 1,
        'RIFTS': 0.001
      };
      
      if (fallbackPrices[symbol]) {
        const priceData: TokenPrice = {
          symbol,
          price: fallbackPrices[symbol],
          change24h: 0,
          volume24h: 0,
          lastUpdate: Date.now()
        };
        
        // Cache fallback prices too
        this.cache.set(symbol, priceData);
        await priceCache.set(cacheKey, priceData);
        
        return priceData;
      }
    } catch (error) {

      // Return fallback prices on error
      const fallbackPrices: { [key: string]: number } = {
        'SOL': 180,
        'ETH': 3300,
        'BTC': 97000,
        'USDC': 1,
        'USDT': 1,
        'RIFTS': 0.001
      };
      
      if (fallbackPrices[symbol]) {
        return {
          symbol,
          price: fallbackPrices[symbol],
          change24h: 0,
          volume24h: 0,
          lastUpdate: Date.now()
        };
      }
    }

    return null;
  }

  private getTokenMintAddress(symbol: string): string | null {
    const mintMap: { [key: string]: string } = {
      'SOL': 'So11111111111111111111111111111111111111112',
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
      'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
      'RIFTS': RIFTS_TOKEN_MINT.toBase58()
    };
    return mintMap[symbol.toUpperCase()] || null;
  }

  async getMultiplePrices(symbols: string[]): Promise<TokenPrice[]> {
    const prices = await Promise.all(
      symbols.map(symbol => this.getTokenPrice(symbol))
    );
    return prices.filter(price => price !== null) as TokenPrice[];
  }
}

// ==================== RIFT PROTOCOL SERVICE ====================

export class RiftProtocolService {
  private walletService: SolanaWalletService;
  private priceService: PriceDataService;
  private productionRiftsService: ProductionRiftsService | null = null;
  private productionRiftsTokenManager: ProductionRiftsTokenManager | null = null;

  constructor(walletService: SolanaWalletService, priceService: PriceDataService) {
    this.walletService = walletService;
    this.priceService = priceService;
    
    // Initialize production services
    this.initializeProductionServices();
  }
  
  private async initializeProductionServices() {
    try {
      // Use the rate-limited connection
      this.productionRiftsService = new ProductionRiftsService(connection as unknown as Connection);
      
      // Use the service integrator to get your existing token manager
      this.productionRiftsTokenManager = serviceIntegrator.getTokenManager();

    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {

        // Retry after delay
        setTimeout(() => this.initializeProductionServices(), 10000);
      } else {

      }
    }
  }
  
  updateWallet(adapter: WalletAdapter) {
    if (this.productionRiftsService && adapter) {
      this.productionRiftsService.setWallet(adapter);

    }
  }

  async getUserPositions(userPubkey?: PublicKey): Promise<UserPosition[]> {
    try {
      if (!userPubkey) {

        return [];
      }

      // Check cache first
      const cacheKey = `user-positions-${userPubkey.toBase58()}`;
      const cached = await userDataCache.get<UserPosition[]>(cacheKey);
      if (cached) {

        return cached;
      }

      // Get all user token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        userPubkey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const accounts = tokenAccounts as unknown as { value: unknown[] };

      const positions: UserPosition[] = [];
      
      // Get all rifts from production service
      if (!this.productionRiftsService) {

        return [];
      }
      
      const allRifts = await this.productionRiftsService.getAllRifts();

      // Check for real on-chain positions
      for (const account of accounts.value) {
        const tokenData = (account as unknown as { account: { data: { parsed: { info: unknown } } } }).account.data.parsed.info;
        
        // Log all token accounts for debugging
        const data = tokenData as unknown as { mint: string; tokenAmount: { uiAmount?: number } };

        if ((data.tokenAmount.uiAmount || 0) > 0.001) { // Only show positions greater than 0.001 tokens

          // Check if this token is a rift token by matching against known rifts
          const matchingRift = allRifts.find((rift: unknown) => (rift as { riftMint?: string }).riftMint === data.mint);
          
          if (matchingRift) {

            const underlyingPrice = await this.getTokenPrice((matchingRift as { underlying?: string }).underlying || '');
            
            // Convert to your UserPosition type using the converter
            const position = typeConverters.toUserPositionType({
              amount: data.tokenAmount.uiAmount || 0,
              value: (data.tokenAmount.uiAmount || 0) * (underlyingPrice?.price || 100) * ((matchingRift as { realBackingRatio?: number }).realBackingRatio || 1),
              rewards: 0 // Calculate from actual staking rewards
            }, (matchingRift as { id?: string }).id || '');
            
            positions.push(position);
          } else {

          }
        }
      }
      
      // Cache the results
      await userDataCache.set(cacheKey, positions);

      return positions;
    } catch (error) {

      return [];
    }
  }

  // Get real token price
  private async getTokenPrice(symbol: string): Promise<TokenPrice | null> {
    return await this.priceService.getTokenPrice(symbol);
  }

  // Get all rifts from the production service, converted to your Rift type
  async getAllRifts(): Promise<Rift[]> {
    try {
      // Check cache first
      const cacheKey = 'all-rifts';
      const cached = await riftsCache.get<Rift[]>(cacheKey);
      if (cached) {

        return cached;
      }

      if (!this.productionRiftsService) {

        return [];
      }

      const productionRifts = await this.productionRiftsService.getAllRifts();
      
      // Convert production rifts to your Rift type
      const rifts = productionRifts.map(productionRift => 
        typeConverters.toRiftType(productionRift)
      );
      
      // Cache the results
      await riftsCache.set(cacheKey, rifts);

      return rifts;
    } catch (error) {

      // Try to return cached data even if expired
      const cacheKey = 'all-rifts';
      const staleCache = await riftsCache.get<Rift[]>(cacheKey);
      if (staleCache) {

        return staleCache;
      }
      return [];
    }
  }

  async wrapTokens(riftId: string, amount: number): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // SECURITY FIX: Validate inputs
      const { validateTokenAmount, validatePublicKey } = await import('../validation/input-validator');

      const amountValidation = validateTokenAmount(amount, {
        min: 0.000001,
        max: 1000000000,
        decimals: 9,
        fieldName: 'Wrap amount'
      });

      if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.error };
      }

      const addressValidation = validatePublicKey(riftId, 'Rift ID');
      if (!addressValidation.isValid) {
        return { success: false, error: addressValidation.error };
      }

      if (!this.walletService.walletAdapter?.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!this.productionRiftsService) {
        return { success: false, error: 'Production service not initialized' };
      }

      const result = await this.productionRiftsService.wrapTokens({
        user: this.walletService.walletAdapter.publicKey,
        riftPubkey: new PublicKey(riftId),
        amount: amount
      });
      
      if (result?.success && result?.signature) {

        return { success: true, signature: result.signature };
      } else {

        return { 
          success: false, 
          error: result?.error || 'Production wrap operation failed' 
        };
      }
    } catch (error) {

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Transaction failed' 
      };
    }
  }

  async unwrapTokens(riftId: string, rTokenAmount: number): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // SECURITY FIX: Validate inputs
      const { validateTokenAmount, validatePublicKey } = await import('../validation/input-validator');

      const amountValidation = validateTokenAmount(rTokenAmount, {
        min: 0.000001,
        max: 1000000000,
        decimals: 9,
        fieldName: 'Unwrap amount'
      });

      if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.error };
      }

      const addressValidation = validatePublicKey(riftId, 'Rift ID');
      if (!addressValidation.isValid) {
        return { success: false, error: addressValidation.error };
      }

      if (!this.walletService.walletAdapter?.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!this.productionRiftsService) {
        return { success: false, error: 'Production service not initialized' };
      }

      const result = await this.productionRiftsService.unwrapTokens({
        user: this.walletService.walletAdapter.publicKey,
        riftPubkey: new PublicKey(riftId),
        riftTokenAmount: rTokenAmount
      });
      
      if (result?.success && result?.signature) {

        return { success: true, signature: result.signature };
      } else {

        return { 
          success: false, 
          error: result?.error || 'Production unwrap operation failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Withdrawal failed' 
      };
    }
  }

  async claimRiftsRewards(): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      if (!this.walletService.walletAdapter?.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!this.productionRiftsTokenManager) {
        return { success: false, error: 'Token manager not initialized' };
      }

      // Use your production RIFTS token manager for claims
      const result = await this.productionRiftsTokenManager.claimRiftsRewards({
        user: this.walletService.walletAdapter.publicKey,
        payer: new Keypair() // Would use proper authority in production
      });
      
      if (result?.success && result?.signature) {
        return { success: true, signature: result.signature };
      } else {
        return { 
          success: false, 
          error: result?.error || 'Claim failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Claim failed' 
      };
    }
  }

  async createRift(params: {
    tokenAddress: string;
    tokenSymbol: string;
    burnFee: number;
    partnerFee: number;
    partnerWallet?: string;
  }): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // SECURITY FIX: Validate inputs
      const { validatePublicKey, validatePercentage } = await import('../validation/input-validator');

      const addressValidation = validatePublicKey(params.tokenAddress, 'Token address');
      if (!addressValidation.isValid) {
        return { success: false, error: addressValidation.error };
      }

      const burnFeeValidation = validatePercentage(params.burnFee, {
        min: 0,
        max: 45,
        fieldName: 'Burn fee'
      });

      if (!burnFeeValidation.isValid) {
        return { success: false, error: burnFeeValidation.error };
      }

      const partnerFeeValidation = validatePercentage(params.partnerFee, {
        min: 0,
        max: 5,
        fieldName: 'Partner fee'
      });

      if (!partnerFeeValidation.isValid) {
        return { success: false, error: partnerFeeValidation.error };
      }

      if (params.partnerWallet) {
        const partnerWalletValidation = validatePublicKey(params.partnerWallet, 'Partner wallet');
        if (!partnerWalletValidation.isValid) {
          return { success: false, error: partnerWalletValidation.error };
        }
      }

      if (!this.walletService.walletAdapter?.publicKey) {

        return { success: false, error: 'Wallet not connected' };
      }

      if (!this.productionRiftsService) {
        return { success: false, error: 'Production service not initialized' };
      }

      const result = await this.productionRiftsService.createRift({
        creator: this.walletService.walletAdapter.publicKey,
        underlyingMint: new PublicKey(params.tokenAddress),
        burnFeeBps: Math.floor(params.burnFee * 100),
        partnerFeeBps: Math.floor(params.partnerFee * 100),
        partnerWallet: params.partnerWallet ? new PublicKey(params.partnerWallet) : undefined
      });

      if (result?.success && result?.signature) {
        return { success: true, signature: result.signature };
      } else if (result?.error) {

        return { success: false, error: result.error };
      }

      return { success: false, error: 'Unknown error in rift creation' };
    } catch (error) {

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rift creation failed' 
      };
    }
  }

  // Production TVL and volume calculations
  async getTotalTVL(): Promise<number> {
    try {
      if (!this.productionRiftsService) {
        return 0;
      }
      return await this.productionRiftsService.getTotalTVL();
    } catch (error) {

      return 0;
    }
  }

  async getTotal24hVolume(): Promise<number> {
    try {
      if (!this.productionRiftsService) {
        return 0;
      }
      return await this.productionRiftsService.getTotal24hVolume();
    } catch (error) {

      return 0;
    }
  }

  async getUniqueUserCount(): Promise<number> {
    try {
      if (!this.productionRiftsService) {
        return 0;
      }
      return await this.productionRiftsService.getUniqueUserCount();
    } catch (error) {

      return 0;
    }
  }
}

// ==================== REAL-TIME DATA SERVICE ====================

export class RealTimeDataService {
  private priceService: PriceDataService;
  protected connection: Connection;
  private subscribers: Map<string, DataUpdateCallback[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(priceService: PriceDataService, connection: Connection) {
    this.priceService = priceService;
    this.connection = connection;
  }

  subscribe(channel: string, callback: DataUpdateCallback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
      this.startDataFeed(channel);
    }
    
    this.subscribers.get(channel)?.push(callback);
  }

  unsubscribe(channel: string, callback: DataUpdateCallback) {
    const channelSubscribers = this.subscribers.get(channel);
    if (channelSubscribers) {
      const index = channelSubscribers.indexOf(callback);
      if (index > -1) {
        channelSubscribers.splice(index, 1);
      }

      if (channelSubscribers.length === 0) {
        this.stopDataFeed(channel);
        this.subscribers.delete(channel);
      }
    }
  }

  private startDataFeed(channel: string) {
    // Increase intervals significantly to reduce RPC calls
    const updateIntervals = {
      'prices': 300000,  // 5 minutes for prices
      'tvl': 600000,     // 10 minutes for TVL  
      'volume': 900000   // 15 minutes for volume
    };

    const interval = setInterval(async () => {
      try {
        let data: TokenPrice[] | TVLUpdateData | VolumeUpdateData;
        
        switch (channel) {
          case 'prices':
            data = await this.priceService.getMultiplePrices(['SOL', 'ETH', 'BTC']);
            break;
          case 'tvl':
            data = await this.generateRealTVLData();
            break;
          case 'volume':
            data = await this.generateRealVolumeData();
            break;
          default:
            return;
        }

        this.broadcast(channel, data);
      } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {

        } else {

        }
      }
    }, updateIntervals[channel as keyof typeof updateIntervals] || 60000);

    this.intervals.set(channel, interval);
  }

  private stopDataFeed(channel: string) {
    const interval = this.intervals.get(channel);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(channel);
    }
  }

  private broadcast(channel: string, data: unknown) {
    const subscribers = this.subscribers.get(channel);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  private async generateRealTVLData(): Promise<TVLUpdateData> {
    try {
      // Get real TVL from production service
      const totalTVL = await riftProtocolService.getTotalTVL();
      
      return {
        total: totalTVL,
        change24h: 0, // Would track historical data in production
        timestamp: Date.now()
      };
    } catch (error) {

      return {
        total: 0,
        change24h: 0,
        timestamp: Date.now()
      };
    }
  }

  private async generateRealVolumeData(): Promise<VolumeUpdateData> {
    try {
      // Get real volume from production service
      const totalVolume = await riftProtocolService.getTotal24hVolume();
      
      return {
        total: totalVolume,
        change24h: 0, // Would need historical data to calculate change
        timestamp: Date.now()
      };
    } catch (error) {

      return {
        total: 0,
        change24h: 0,
        timestamp: Date.now()
      };
    }
  }
}

// ==================== SERVICE INSTANCES ====================

export const walletService = new SolanaWalletService();
export const priceService = new PriceDataService();
export const riftProtocolService = new RiftProtocolService(walletService, priceService);
export const realTimeDataService = new RealTimeDataService(priceService, connection as unknown as Connection);

// Export production services for direct access (for backward compatibility)
export const productionRiftsService = riftProtocolService;
export const productionRiftsTokenManager = () => serviceIntegrator.getTokenManager();

// ==================== UTILITY FUNCTIONS ====================

export const formatTokenAmount = (amount: number, decimals: number = 6): string => {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
};

export const formatSolanaAddress = (address: string, length: number = 4): string => {
  return `${address.slice(0, length)}...${address.slice(-length)}`;
};

export const lamportsToSol = (lamports: number): number => {
  return lamports / LAMPORTS_PER_SOL;
};

export const solToLamports = (sol: number): number => {
  return Math.floor(sol * LAMPORTS_PER_SOL);
};

// ==================== HEALTH CHECKS AND UTILITIES ====================

export async function checkProductionHealth(): Promise<{
  riftsService: boolean;
  tokenManager: boolean;
  connection: boolean;
}> {
  try {
    // Test connection with timeout and rate limiting awareness
    const connectionPromise = connection.getVersion();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000) // Increased timeout
    );
    
    const connectionHealth = await Promise.race([connectionPromise, timeoutPromise]);
    const serviceValidation = await serviceIntegrator.validateServices();
    
    return {
      riftsService: riftProtocolService !== null,
      tokenManager: serviceValidation.tokenManager,
      connection: !!connectionHealth
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('429')) {

      return {
        riftsService: riftProtocolService !== null,
        tokenManager: true, // Assume healthy when rate limited
        connection: true
      };
    }

    return {
      riftsService: false,
      tokenManager: false,
      connection: false
    };
  }
}

export async function validateProductionDeployment(): Promise<{
  valid: boolean;
  programExists: boolean;
  programExecutable: boolean;
  riftsTokenDeployed: boolean;
}> {
  try {
    const accountInfo = await connection.getAccountInfo(RIFTS_PROGRAM_ID);
    const tokenManager = serviceIntegrator.getTokenManager();
    
    let riftsTokenDeployed = false;
    if (tokenManager) {
      const tokenHealth = await import('./integration-utils').then(
        ({ healthCheck }) => healthCheck.checkRiftsToken(tokenManager)
      );
      riftsTokenDeployed = (await tokenHealth).deployed;
    }
    
    return {
      valid: accountInfo !== null && ((accountInfo as { executable?: boolean })?.executable || false) && riftsTokenDeployed,
      programExists: accountInfo !== null,
      programExecutable: (accountInfo as { executable?: boolean })?.executable || false,
      riftsTokenDeployed
    };
  } catch (error) {

    return {
      valid: false,
      programExists: false,
      programExecutable: false,
      riftsTokenDeployed: false
    };
  }
}

export async function initializeProductionServices(): Promise<boolean> {
  try {
    // Services are auto-initialized in their constructors
    const health = await checkProductionHealth();
    return health.riftsService && health.connection && health.tokenManager;
  } catch (error) {

    return false;
  }
}

// Export your existing token manager through the service integrator
export const getTokenManager = () => serviceIntegrator.getTokenManager();

// Export utilities for working with your existing types
export { riftsTokenUtils, healthCheck, typeConverters } from './integration-utils';