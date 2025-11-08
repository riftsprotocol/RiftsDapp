import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';

// Program IDs (from programs.txt - deployed versions)
const LP_STAKING_PROGRAM_ID = new PublicKey('Dz1b2WXm2W7PYAp7CvN4qiGdZ7ULRtaAxBWb7Ju8PwNy'); // ✅ DEPLOYED
const GOVERNANCE_PROGRAM_ID = new PublicKey('89v8sYZWr6TDsAQWcAWR18tEphTQQxjciJkr9t8hDmb1');
const FEE_COLLECTOR_PROGRAM_ID = new PublicKey('6WD1EhaaS7XbLMqVLSxxasKGK6TnfE7odihaNriNKB9u');
const RIFTS_PROGRAM_ID = new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn');

// RIFTS token mint - CORRECT ACTIVE MINT
const RIFTS_MINT = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');

interface UserStakeData {
  user: PublicKey;
  pool: PublicKey;
  amount: BN;
  stakeTime: BN;
  rewardDebt: BN;
  pendingRewards: BN;
}

interface StakingPoolData {
  authority: PublicKey;
  lpTokenMint: PublicKey;
  rewardTokenMint: PublicKey;
  rewardTokenVault: PublicKey;
  totalStaked: BN;
  rewardsPerSecond: BN;
  minStakeDuration: BN;
  lastUpdateTime: BN;
  accumulatedRewardsPerShare: BN;
  isPaused: boolean;
  riftsProtocol: PublicKey;
  totalRewardsAvailable: BN;
  lastRewardDeposit: BN;
}

interface GovernanceData {
  authority: PublicKey;
  riftsMint: PublicKey;
  totalProposals: BN;
  totalExecuted: BN;
}

interface FeeCollectorData {
  authority: PublicKey;
  totalRiftsBought: BN;
  totalRiftsDistributed: BN;
  totalRiftsBurned: BN;
  currentRiftsPrice: BN;
  lastPriceUpdate: BN;
}

interface PortfolioData {
  // RIFTS Holdings
  riftsBalance: number;
  riftsBalanceUsd: number;

  // Staking
  stakedAmount: number;
  stakedAmountUsd: number;
  pendingRewards: number;
  pendingRewardsUsd: number;
  stakingApy: number;

  // Governance
  votingPower: number;
  votingPowerPercentage: number;
  proposalsVoted: number;

  // Revenue Share
  monthlyRevenue: number;
  totalRevenue: number;
  nextDistribution: string;

  // Performance
  totalValue: number;
  pnl7d: number;
  pnl7dPercent: number;
  pnl30d: number;
  pnl30dPercent: number;
}

class PortfolioBlockchainService {
  private connection: Connection;
  private fallbackConnection: Connection;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private useFallback = false;

  constructor(rpcEndpoint: string = 'https://api.devnet.solana.com') {
    // Primary RPC
    this.connection = new Connection(rpcEndpoint, 'confirmed');

    // Fallback RPC endpoints
    this.fallbackConnection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
      'confirmed'
    );
  }

  /**
   * Get connection with automatic fallback
   */
  private getConnection(): Connection {
    return this.useFallback ? this.fallbackConnection : this.connection;
  }

  /**
   * Execute RPC call with automatic fallback
   */
  private async executeWithFallback<T>(
    operation: (conn: Connection) => Promise<T>,
    operationName: string = 'RPC call'
  ): Promise<T> {
    try {
      // Try primary connection
      return await Promise.race([
        operation(this.connection),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${operationName} timeout`)), 10000)
        )
      ]);
    } catch (error) {

      try {
        // Try fallback connection
        this.useFallback = true;
        const result = await Promise.race([
          operation(this.fallbackConnection),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} fallback timeout`)), 10000)
          )
        ]);
        return result;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  }

  /**
   * Get comprehensive user portfolio data from all programs
   */
  async getUserPortfolio(userPubkey: PublicKey): Promise<PortfolioData> {
    try {

      // Fetch data from all sources in parallel
      const [
        riftsBalance,
        stakeData,
        riftsPrice,
        feeCollectorData,
        governanceData
      ] = await Promise.all([
        this.getRIFTSBalance(userPubkey),
        this.getUserStakeData(userPubkey),
        this.getRIFTSPrice(),
        this.getFeeCollectorData(),
        this.getGovernanceData(userPubkey)
      ]);

      // Calculate staking APY
      const stakingApy = await this.calculateStakingAPY();

      // Calculate values
      const riftsBalanceUsd = riftsBalance * riftsPrice;
      const stakedAmountUsd = stakeData.stakedAmount * riftsPrice;
      const pendingRewardsUsd = stakeData.pendingRewards * riftsPrice;
      const totalValue = riftsBalanceUsd + stakedAmountUsd + pendingRewardsUsd;

      // Calculate voting power
      const totalSupply = await this.getRIFTSTotalSupply();
      const votingPower = riftsBalance + stakeData.stakedAmount;
      const votingPowerPercentage = totalSupply > 0 ? (votingPower / totalSupply) * 100 : 0;

      // Calculate revenue share (90% of fees go to LP stakers)
      const monthlyRevenue = this.calculateMonthlyRevenue(feeCollectorData, stakeData.stakedAmount);
      const totalRevenue = this.calculateTotalRevenue(feeCollectorData, stakeData.stakedAmount);

      // Get PnL data (from transaction history analysis)
      const pnlData = await this.calculatePnL(userPubkey, riftsPrice);

      return {
        // RIFTS Holdings
        riftsBalance,
        riftsBalanceUsd,

        // Staking
        stakedAmount: stakeData.stakedAmount,
        stakedAmountUsd,
        pendingRewards: stakeData.pendingRewards,
        pendingRewardsUsd,
        stakingApy,

        // Governance
        votingPower,
        votingPowerPercentage,
        proposalsVoted: governanceData.proposalsVoted,

        // Revenue Share
        monthlyRevenue,
        totalRevenue,
        nextDistribution: this.getNextDistributionDate(),

        // Performance
        totalValue,
        pnl7d: pnlData.pnl7d,
        pnl7dPercent: pnlData.pnl7dPercent,
        pnl30d: pnlData.pnl30d,
        pnl30dPercent: pnlData.pnl30dPercent,
      };
    } catch (error) {
      return this.getEmptyPortfolio();
    }
  }

  /**
   * Get user's RIFTS token balance
   */
  private async getRIFTSBalance(userPubkey: PublicKey): Promise<number> {
    try {
      const cacheKey = `rifts-balance-${userPubkey.toString()}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Get associated token account
      const ata = await this.getAssociatedTokenAddress(RIFTS_MINT, userPubkey);
      const accountInfo = await this.connection.getAccountInfo(ata);

      if (!accountInfo) return 0;

      // Parse token account data
      const data = Buffer.from(accountInfo.data);
      const amount = new BN(data.slice(64, 72), 'le');
      // Convert safely to avoid "number can only store 53 bits" error
      const balance = parseFloat(amount.toString()) / 1e9; // Assuming 9 decimals

      this.setCache(cacheKey, balance);
      return balance;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get user's staking data from LP staking program
   */
  private async getUserStakeData(userPubkey: PublicKey): Promise<{
    stakedAmount: number;
    pendingRewards: number;
    stakeTime: number;
  }> {
    try {
      const cacheKey = `stake-data-${userPubkey.toString()}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Derive user stake account PDA
      // First, find the staking pool (we need to know the LP token mint)
      // For now, we'll search for all staking pools and find user's stakes

      const poolAddress = await this.findStakingPool();
      if (!poolAddress) {
        return { stakedAmount: 0, pendingRewards: 0, stakeTime: 0 };
      }

      const [userStakeAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from('user_stake'),
          poolAddress.toBuffer(),
          userPubkey.toBuffer()
        ],
        LP_STAKING_PROGRAM_ID
      );

      const accountInfo = await this.connection.getAccountInfo(userStakeAccount);

      if (!accountInfo) {
        return { stakedAmount: 0, pendingRewards: 0, stakeTime: 0 };
      }

      // Parse user stake account data
      const data = Buffer.from(accountInfo.data);

      // Skip discriminator (8 bytes)
      let offset = 8;

      // user: Pubkey (32 bytes)
      offset += 32;

      // pool: Pubkey (32 bytes)
      offset += 32;

      // amount: u64 (8 bytes)
      const amount = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      // stake_time: i64 (8 bytes)
      const stakeTime = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      // reward_debt: u64 (8 bytes)
      offset += 8;

      // pending_rewards: u64 (8 bytes)
      const pendingRewards = new BN(data.slice(offset, offset + 8), 'le');

      const result = {
        stakedAmount: parseFloat(amount.toString()) / 1e9,
        pendingRewards: parseFloat(pendingRewards.toString()) / 1e9,
        stakeTime: parseInt(stakeTime.toString())
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      return { stakedAmount: 0, pendingRewards: 0, stakeTime: 0 };
    }
  }

  /**
   * Find staking pool address
   */
  private async findStakingPool(): Promise<PublicKey | null> {
    try {
      // The staking pool is created with PDA: seeds = [b"staking_pool", lp_token_mint.key()]
      // We need to find it by scanning program accounts
      const accounts = await this.connection.getProgramAccounts(LP_STAKING_PROGRAM_ID, {
        filters: [
          { dataSize: 177 } // StakingPool size (8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 16 + 1 + 32 + 8 + 8)
        ]
      });

      if (accounts.length > 0) {
        return accounts[0].pubkey;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get RIFTS token price from DEX
   */
  private async getRIFTSPrice(): Promise<number> {
    try {
      const cacheKey = 'rifts-price';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // TODO: Implement actual price fetching from Jupiter/Meteora
      // For now, return placeholder
      const price = 1.0; // $1.00

      this.setCache(cacheKey, price);
      return price;
    } catch (error) {
      return 1.0;
    }
  }

  /**
   * Get fee collector data
   */
  private async getFeeCollectorData(): Promise<FeeCollectorData | null> {
    try {
      const cacheKey = 'fee-collector-data';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Derive fee collector PDA
      const [feeCollectorPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('fee_collector'), new PublicKey('4UAWKQ94DXYcUAWw3hddLThq3bn9i3jxCZE3DAnbSN2K').toBuffer()],
        FEE_COLLECTOR_PROGRAM_ID
      );

      const accountInfo = await this.connection.getAccountInfo(feeCollectorPDA);
      if (!accountInfo) return null;

      const data = Buffer.from(accountInfo.data);
      let offset = 8; // Skip discriminator

      // authority: Pubkey (32 bytes)
      const authority = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // total_rifts_bought: u64 (8 bytes)
      const totalRiftsBought = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      // total_rifts_distributed: u64 (8 bytes)
      const totalRiftsDistributed = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      // total_rifts_burned: u64 (8 bytes)
      const totalRiftsBurned = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      // current_rifts_price: u64 (8 bytes)
      const currentRiftsPrice = new BN(data.slice(offset, offset + 8), 'le');
      offset += 16; // Skip current_underlying_price

      // last_price_update: i64 (8 bytes)
      const lastPriceUpdate = new BN(data.slice(offset, offset + 8), 'le');

      const result = {
        authority,
        totalRiftsBought,
        totalRiftsDistributed,
        totalRiftsBurned,
        currentRiftsPrice,
        lastPriceUpdate
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get governance data for user
   */
  private async getGovernanceData(userPubkey: PublicKey): Promise<{
    proposalsVoted: number;
  }> {
    try {
      // Search for vote records by user
      const voteRecords = await this.connection.getProgramAccounts(GOVERNANCE_PROGRAM_ID, {
        filters: [
          { dataSize: 89 }, // VoteRecord size
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: userPubkey.toBase58()
            }
          }
        ]
      });

      return {
        proposalsVoted: voteRecords.length
      };
    } catch (error) {
      return { proposalsVoted: 0 };
    }
  }

  /**
   * Calculate staking APY
   */
  private async calculateStakingAPY(): Promise<number> {
    try {
      const poolAddress = await this.findStakingPool();
      if (!poolAddress) return 0;

      const accountInfo = await this.connection.getAccountInfo(poolAddress);
      if (!accountInfo) return 0;

      const data = Buffer.from(accountInfo.data);
      let offset = 8 + 32 + 32 + 32 + 32; // Skip to total_staked

      const totalStaked = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;

      const rewardsPerSecond = new BN(data.slice(offset, offset + 8), 'le');

      const totalStakedNum = parseFloat(totalStaked.toString());
      if (totalStakedNum === 0) return 0;

      // APY = (rewards per year / total staked) * 100
      const rewardsPerYear = parseFloat(rewardsPerSecond.toString()) * 365 * 24 * 60 * 60;
      const apy = (rewardsPerYear / totalStakedNum) * 100;

      return apy;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate monthly revenue from fee distribution
   */
  private calculateMonthlyRevenue(feeData: FeeCollectorData | null, stakedAmount: number): number {
    if (!feeData || stakedAmount === 0) return 0;

    try {
      // 90% of fees go to LP stakers
      const totalDistributed = parseFloat(feeData.totalRiftsDistributed.toString()) / 1e9;

      // Estimate monthly distribution based on total distributed
      // This is a rough estimate - actual would need historical data
      const monthlyEstimate = totalDistributed * 0.1; // Very rough estimate

      return monthlyEstimate;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate total revenue earned
   */
  private calculateTotalRevenue(feeData: FeeCollectorData | null, stakedAmount: number): number {
    if (!feeData || stakedAmount === 0) return 0;

    try {
      // User's share of total distributed = (user stake / total stake) * total distributed
      // This is approximate without access to pool total staked
      return 0; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get next distribution date
   */
  private getNextDistributionDate(): string {
    // Distributions happen when fees are swapped and deposited
    // Return "TBA" for now as it's event-driven
    return 'TBA';
  }

  /**
   * Calculate PnL for 7-day and 30-day periods
   */
  private async calculatePnL(userPubkey: PublicKey, currentPrice: number): Promise<{
    pnl7d: number;
    pnl7dPercent: number;
    pnl30d: number;
    pnl30dPercent: number;
  }> {
    try {
      // TODO: Implement by analyzing transaction history
      // Would need to:
      // 1. Fetch all user transactions for past 7/30 days
      // 2. Calculate cost basis from buys/wraps
      // 3. Calculate current value
      // 4. Return PnL

      return {
        pnl7d: 0,
        pnl7dPercent: 0,
        pnl30d: 0,
        pnl30dPercent: 0
      };
    } catch (error) {
      return {
        pnl7d: 0,
        pnl7dPercent: 0,
        pnl30d: 0,
        pnl30dPercent: 0
      };
    }
  }

  /**
   * Get RIFTS total supply with retry and fallback logic
   */
  private async getRIFTSTotalSupply(): Promise<number> {
    try {
      const cacheKey = 'rifts-total-supply';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Use fallback RPC method
      const mintInfo = await this.executeWithFallback(
        (conn) => conn.getAccountInfo(RIFTS_MINT),
        'getRIFTSTotalSupply'
      ).catch(() => null);

      if (!mintInfo) {
        const estimatedSupply = 1000000000; // 1B estimated
        this.setCache(cacheKey, estimatedSupply);
        return estimatedSupply;
      }

      const data = Buffer.from(mintInfo.data);
      const supply = new BN(data.slice(36, 44), 'le');

      // Convert BN to number safely
      const supplyStr = supply.toString();
      const totalSupply = parseInt(supplyStr) / 1e9;

      this.setCache(cacheKey, totalSupply);
      return totalSupply;

    } catch (error) {
      const fallbackSupply = 1000000000; // 1B default
      return fallbackSupply;
    }
  }

  /**
   * Get associated token address
   */
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    return address;
  }

  /**
   * Cache helpers
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get empty portfolio (fallback)
   */
  private getEmptyPortfolio(): PortfolioData {
    return {
      riftsBalance: 0,
      riftsBalanceUsd: 0,
      stakedAmount: 0,
      stakedAmountUsd: 0,
      pendingRewards: 0,
      pendingRewardsUsd: 0,
      stakingApy: 0,
      votingPower: 0,
      votingPowerPercentage: 0,
      proposalsVoted: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
      nextDistribution: 'TBA',
      totalValue: 0,
      pnl7d: 0,
      pnl7dPercent: 0,
      pnl30d: 0,
      pnl30dPercent: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const portfolioBlockchainService = new PortfolioBlockchainService();
export type { PortfolioData };
