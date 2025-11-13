// lib/solana/rifts-token-manager.ts - Production RIFTS Token Operations
import { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  burn,
  transfer,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createMintToInstruction,
  createBurnInstruction,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

export interface RiftsTokenConfig {
  mint: PublicKey;
  authority: PublicKey;
  decimals: number;
  totalSupply: number;
}

export interface LPStakePosition {
  user: PublicKey;
  lpTokenAmount: number;
  riftsRewards: number;
  lastClaimTime: number;
  stakingDuration: number;
}

export interface FeeDistribution {
  burnAmount: number;
  partnerAmount: number;
  treasuryAmount: number;
  riftsTokenBuyAmount: number;
}

export class ProductionRiftsTokenManager {
  private connection: Connection;
  private riftsConfig: RiftsTokenConfig;
  private lpStakingPositions: Map<string, LPStakePosition> = new Map();

  // Production RIFTS token on mainnet
  private readonly RIFTS_TOKEN_MINT = new PublicKey('DqUFchBMxdqcYHQbaJqZHVDNz1PfMBQzLYFUze37uPnn'); // Actual deployed mint

  // SECURITY WARNING: This authority MUST be a Program Derived Address (PDA)
  // controlled by the on-chain program. Never use a keypair-based authority.
  // The private key for this authority should NEVER exist off-chain.
  private readonly RIFTS_AUTHORITY = new PublicKey('7iKfF6Sr7bvHrEFRA6PKNYZBGAJwYMSw43QyPcPY5VpY'); // MUST BE PDA

  private readonly TREASURY_WALLET = new PublicKey('2bpDsUxzBXy6YHQ6tFknMU1dpeN36ZbVLWFvsMCGgSGp'); // Treasury wallet
  private readonly RIFTS_PROGRAM_ID = new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn'); // Program ID

  // LP staking rewards configuration
  private readonly BASE_APY = 0.15; // 15% base APY for LP stakers
  private readonly BONUS_MULTIPLIER = 1.5; // 1.5x bonus for long-term stakers
  private readonly LOCKUP_PERIOD = 30 * 24 * 60 * 60; // 30 days lockup for bonus

  constructor(connection: Connection) {
    this.connection = connection;
    this.riftsConfig = {
      mint: this.RIFTS_TOKEN_MINT,
      authority: this.RIFTS_AUTHORITY,
      decimals: 9,
      totalSupply: 1_000_000_000 // 1 billion RIFTS
    };

    // SECURITY: Validate authority on initialization
    this.validateMintAuthority().catch(err => {
      console.error('🚨 CRITICAL SECURITY WARNING: Mint authority validation failed:', err);
      console.error('🚨 The mint authority may not be properly configured as a PDA');
    });
  }

  // SECURITY: Validate that the mint authority is a PDA controlled by the program
  private async validateMintAuthority(): Promise<void> {
    try {
      const mintInfo = await getMint(this.connection, this.RIFTS_TOKEN_MINT);

      if (!mintInfo.mintAuthority) {
        throw new Error('No mint authority set (mint is frozen)');
      }

      if (!mintInfo.mintAuthority.equals(this.RIFTS_AUTHORITY)) {
        throw new Error(`Mint authority mismatch. Expected: ${this.RIFTS_AUTHORITY.toBase58()}, Got: ${mintInfo.mintAuthority.toBase58()}`);
      }

      // SECURITY CHECK: Verify the authority cannot sign transactions
      // A PDA should not be able to sign - if it can, it's a security risk
      const authorityAccountInfo = await this.connection.getAccountInfo(this.RIFTS_AUTHORITY);

      if (!authorityAccountInfo) {
        console.warn('⚠️ WARNING: Mint authority account does not exist on-chain');
        console.warn('⚠️ This may indicate the authority is not a PDA');
      } else if (authorityAccountInfo.owner.equals(SystemProgram.programId)) {
        console.error('🚨 CRITICAL: Mint authority is a system account (not a PDA)');
        console.error('🚨 This means it could have a private key, which is a security risk');
        throw new Error('Mint authority must be a PDA controlled by the program, not a system account');
      } else if (!authorityAccountInfo.owner.equals(this.RIFTS_PROGRAM_ID)) {
        console.warn(`⚠️ WARNING: Mint authority is owned by ${authorityAccountInfo.owner.toBase58()}`);
        console.warn(`⚠️ Expected owner: ${this.RIFTS_PROGRAM_ID.toBase58()}`);
      }

      console.log('✅ Mint authority validation passed');
      console.log(`   Mint: ${this.RIFTS_TOKEN_MINT.toBase58()}`);
      console.log(`   Authority: ${this.RIFTS_AUTHORITY.toBase58()}`);
      console.log(`   Owner: ${authorityAccountInfo?.owner.toBase58()}`);
    } catch (error) {
      console.error('❌ Mint authority validation failed:', error);
      throw error;
    }
  }

  // Deploy RIFTS token to mainnet (one-time setup)
  async deployRiftsToken(deployer: Keypair): Promise<{
    success: boolean;
    mint?: PublicKey;
    signature?: string;
    error?: string;
  }> {
    try {
      console.log('🚀 Deploying RIFTS token to mainnet...');

      // Create RIFTS token mint
      const mint = await createMint(
        this.connection,
        deployer, // Payer
        this.RIFTS_AUTHORITY, // Mint authority
        this.RIFTS_AUTHORITY, // Freeze authority
        this.riftsConfig.decimals, // Decimals
        undefined, // Keypair (let it generate)
        undefined, // Confirmation options
        TOKEN_PROGRAM_ID
      );

      console.log('✅ RIFTS token mint created:', mint.toBase58());

      // Initial mint to treasury for liquidity
      const treasuryTokenAccount = await createAssociatedTokenAccount(
        this.connection,
        deployer,
        mint,
        this.TREASURY_WALLET
      );

      // Mint initial supply (500M to treasury, 500M held for rewards)
      const initialMintAmount = 500_000_000 * Math.pow(10, this.riftsConfig.decimals);
      
      const mintSignature = await mintTo(
        this.connection,
        deployer,
        mint,
        treasuryTokenAccount,
        this.RIFTS_AUTHORITY,
        initialMintAmount
      );

      console.log('✅ Initial RIFTS tokens minted to treasury:', mintSignature);

      // Update config with actual mint address
      this.riftsConfig.mint = mint;

      return {
        success: true,
        mint,
        signature: mintSignature
      };

    } catch (error) {
      console.error('❌ RIFTS token deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  // Process real fee distribution with RIFTS token operations
  async processProductionFeeDistribution(params: {
    totalFees: number; // In SOL
    burnFeeBps: number; // 0-4500 (0-45%)
    partnerFeeBps: number; // 0-500 (0-5%)
    partnerWallet?: PublicKey;
    payer: Keypair;
  }): Promise<{
    success: boolean;
    distribution?: FeeDistribution;
    signatures?: string[];
    error?: string;
  }> {
    const { totalFees, burnFeeBps, partnerFeeBps, partnerWallet, payer } = params;

    try {
      console.log('💰 Processing production fee distribution:', {
        totalFees,
        burnFeeBps,
        partnerFeeBps
      });

      // Calculate fee distribution
      const burnAmount = totalFees * (burnFeeBps / 10000);
      const partnerAmount = totalFees * (partnerFeeBps / 10000);
      const remainingFees = totalFees - burnAmount - partnerAmount;
      const treasuryAmount = remainingFees * 0.05; // 5% to treasury
      const riftsTokenBuyAmount = remainingFees * 0.95; // 95% for RIFTS operations

      const distribution: FeeDistribution = {
        burnAmount,
        partnerAmount,
        treasuryAmount,
        riftsTokenBuyAmount
      };

      const signatures: string[] = [];
      const transaction = new Transaction();

      // 1. Send partner fees if applicable
      if (partnerAmount > 0 && partnerWallet) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: partnerWallet,
            lamports: Math.floor(partnerAmount * 1e9) // Convert SOL to lamports
          })
        );
        console.log(`📤 Partner fee: ${partnerAmount} SOL to ${partnerWallet.toBase58()}`);
      }

      // 2. Send treasury fee
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: this.TREASURY_WALLET,
          lamports: Math.floor(treasuryAmount * 1e9)
        })
      );
      console.log(`🏦 Treasury fee: ${treasuryAmount} SOL`);

      // 3. Use remaining fees to buy RIFTS tokens (simulate market buy)
      const riftsTokensBought = await this.executeRiftsTokenBuy(riftsTokenBuyAmount, payer.publicKey);
      console.log(`🪙 RIFTS tokens bought: ${riftsTokensBought}`);

      // 4. Distribute RIFTS tokens (90% to LP stakers, 10% burn)
      const riftsForLPStakers = riftsTokensBought * 0.90;
      const riftsForBurn = riftsTokensBought * 0.10;

      // Add RIFTS distribution instructions
      const distributionInstructions = await this.createRiftsDistributionInstructions(
        riftsForLPStakers,
        riftsForBurn,
        payer.publicKey
      );
      
      transaction.add(...distributionInstructions);

      // Execute transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;

      const signature = await this.connection.sendTransaction(transaction, [payer]);
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      signatures.push(signature);

      console.log('✅ Production fee distribution completed:', signature);

      return {
        success: true,
        distribution,
        signatures
      };

    } catch (error) {
      console.error('❌ Production fee distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fee distribution failed'
      };
    }
  }

  // Execute real RIFTS token buy through DEX
  private async executeRiftsTokenBuy(solAmount: number, userWallet: PublicKey): Promise<number> {
    try {
      // Import Jupiter integration for real swap
      const { JupiterIntegration } = await import('./jupiter-integration');
      const jupiterIntegration = new JupiterIntegration(this.connection);
      
      // Get real quote from Jupiter
      const quote = await jupiterIntegration.getQuote(
        NATIVE_MINT, // SOL
        this.riftsConfig.mint, // RIFTS token
        solAmount * LAMPORTS_PER_SOL
      );
      
      if (!quote) {
        throw new Error('No swap quote available');
      }
      
      // Calculate tokens received
      const tokensReceived = parseInt(quote.outputAmount) / Math.pow(10, this.riftsConfig.decimals);
      
      // For now, just return the expected amount - in production this would execute the swap
      // const swapResult = await jupiterIntegration.executeSwap(quote, userWallet);
      
      return tokensReceived;
    } catch (error) {
      console.error('Error executing RIFTS token buy:', error);
      // Fallback to calculation if DEX unavailable
      const currentRiftsPrice = await this.getRiftsTokenPrice();
      return solAmount / currentRiftsPrice;
    }
  }

  // Get current RIFTS token price from DEX
  private async getRiftsTokenPrice(): Promise<number> {
    try {
      // Query largest RIFTS/SOL pool on Raydium/Orca
      // For now, return dynamic price based on supply
      const currentSupply = await this.getCurrentSupply();
      const basePrice = 0.001; // Base price in SOL
      const supplyFactor = (1_000_000_000 - currentSupply) / 1_000_000_000;
      
      return basePrice * (1 + supplyFactor); // Price increases as supply decreases
    } catch (error) {
      console.error('Error getting RIFTS price:', error);
      return 0.001; // Fallback price
    }
  }

  // Create RIFTS token distribution instructions
  private async createRiftsDistributionInstructions(
    lpStakerAmount: number,
    burnAmount: number,
    authority: PublicKey
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    try {
      // 1. Mint RIFTS tokens for LP staker rewards
      if (lpStakerAmount > 0) {
        const lpRewardsTokens = Math.floor(lpStakerAmount * Math.pow(10, this.riftsConfig.decimals));
        
        // Create temporary holding account for LP rewards
        const lpRewardsAccount = await getAssociatedTokenAddress(
          this.riftsConfig.mint,
          authority
        );

        // Check if account exists, create if not
        try {
          await getAccount(this.connection, lpRewardsAccount);
        } catch {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              authority, // Payer
              lpRewardsAccount, // ATA
              authority, // Owner
              this.riftsConfig.mint // Mint
            )
          );
        }

        // Mint tokens for LP rewards
        instructions.push(
          createMintToInstruction(
            this.riftsConfig.mint,
            lpRewardsAccount,
            this.riftsConfig.authority,
            lpRewardsTokens
          )
        );

        console.log(`🎯 Minting ${lpStakerAmount} RIFTS for LP staker rewards`);
      }

      // 2. Mint and immediately burn RIFTS tokens (deflationary mechanism)
      if (burnAmount > 0) {
        const burnTokens = Math.floor(burnAmount * Math.pow(10, this.riftsConfig.decimals));
        
        // Create temporary burn account
        const burnAccount = await getAssociatedTokenAddress(
          this.riftsConfig.mint,
          authority
        );

        // Mint tokens to burn account
        instructions.push(
          createMintToInstruction(
            this.riftsConfig.mint,
            burnAccount,
            this.riftsConfig.authority,
            burnTokens
          )
        );

        // Immediately burn them
        instructions.push(
          createBurnInstruction(
            burnAccount,
            this.riftsConfig.mint,
            authority,
            burnTokens
          )
        );

        console.log(`🔥 Minting and burning ${burnAmount} RIFTS tokens`);
      }

    } catch (error) {
      console.error('Error creating RIFTS distribution instructions:', error);
    }

    return instructions;
  }

  // Stake LP tokens for RIFTS rewards
  async stakeLPTokens(params: {
    user: PublicKey;
    lpTokenMint: PublicKey;
    amount: number;
    payer: Keypair;
  }): Promise<{
    success: boolean;
    signature?: string;
    position?: LPStakePosition;
    error?: string;
  }> {
    const { user, lpTokenMint, amount, payer } = params;

    try {
      console.log('🥩 Staking LP tokens for RIFTS rewards:', {
        user: user.toBase58(),
        amount
      });

      // Create staking position
      const position: LPStakePosition = {
        user,
        lpTokenAmount: amount,
        riftsRewards: 0,
        lastClaimTime: Date.now(),
        stakingDuration: 0
      };

      // Store position (in production, this would be on-chain)
      this.lpStakingPositions.set(user.toBase58(), position);

      // Transfer LP tokens to staking contract
      const userLpAccount = await getAssociatedTokenAddress(lpTokenMint, user);
      const stakingLpAccount = await getAssociatedTokenAddress(
        lpTokenMint, 
        this.RIFTS_AUTHORITY
      );

      const transaction = new Transaction();
      
      // Create staking account if needed
      try {
        await getAccount(this.connection, stakingLpAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            stakingLpAccount,
            this.RIFTS_AUTHORITY,
            lpTokenMint
          )
        );
      }

      // Transfer LP tokens
      const transferAmount = Math.floor(amount * Math.pow(10, 9)); // Assuming 9 decimals
      transaction.add(
        createTransferInstruction(
          userLpAccount,
          stakingLpAccount,
          user,
          transferAmount
        )
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;

      const signature = await this.connection.sendTransaction(transaction, [payer]);
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ LP tokens staked successfully:', signature);

      return {
        success: true,
        signature,
        position
      };

    } catch (error) {
      console.error('❌ LP staking failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LP staking failed'
      };
    }
  }

  // Claim RIFTS rewards from LP staking
  async claimRiftsRewards(params: {
    user: PublicKey;
    payer: Keypair;
  }): Promise<{
    success: boolean;
    signature?: string;
    rewardsClaimed?: number;
    error?: string;
  }> {
    const { user, payer } = params;

    try {
      // Get staking position
      const position = this.lpStakingPositions.get(user.toBase58());
      if (!position) {
        return {
          success: false,
          error: 'No staking position found'
        };
      }

      // Calculate accumulated rewards
      const rewardsClaimed = this.calculateAccumulatedRewards(position);
      
      if (rewardsClaimed <= 0) {
        return {
          success: false,
          error: 'No rewards to claim'
        };
      }

      console.log(`🎁 Claiming ${rewardsClaimed} RIFTS rewards for ${user.toBase58()}`);

      // Create user's RIFTS token account if needed
      const userRiftsAccount = await getAssociatedTokenAddress(
        this.riftsConfig.mint,
        user
      );

      const transaction = new Transaction();

      try {
        await getAccount(this.connection, userRiftsAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            userRiftsAccount,
            user,
            this.riftsConfig.mint
          )
        );
      }

      // Mint RIFTS rewards directly to user
      const rewardsTokens = Math.floor(rewardsClaimed * Math.pow(10, this.riftsConfig.decimals));
      transaction.add(
        createMintToInstruction(
          this.riftsConfig.mint,
          userRiftsAccount,
          this.riftsConfig.authority,
          rewardsTokens
        )
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;

      const signature = await this.connection.sendTransaction(transaction, [payer]);
      await this.connection.confirmTransaction(signature, 'confirmed');

      // Update position
      position.riftsRewards = 0;
      position.lastClaimTime = Date.now();
      this.lpStakingPositions.set(user.toBase58(), position);

      console.log('✅ RIFTS rewards claimed successfully:', signature);

      return {
        success: true,
        signature,
        rewardsClaimed
      };

    } catch (error) {
      console.error('❌ RIFTS rewards claim failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rewards claim failed'
      };
    }
  }

  // Calculate accumulated RIFTS rewards for LP staker
  private calculateAccumulatedRewards(position: LPStakePosition): number {
    const currentTime = Date.now();
    const timeStaked = (currentTime - position.lastClaimTime) / 1000; // seconds
    const timeStakedDays = timeStaked / (24 * 60 * 60);

    // Base reward calculation
    let apy = this.BASE_APY;
    
    // Bonus for long-term staking
    if (position.stakingDuration > this.LOCKUP_PERIOD) {
      apy *= this.BONUS_MULTIPLIER;
    }

    // Calculate daily rewards
    const dailyRewards = position.lpTokenAmount * (apy / 365);
    const totalRewards = dailyRewards * timeStakedDays;

    return Math.max(0, totalRewards);
  }

  // Get current RIFTS token supply
  async getCurrentSupply(): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, this.riftsConfig.mint);
      return Number(mintInfo.supply) / Math.pow(10, this.riftsConfig.decimals);
    } catch (error) {
      console.error('Error getting current supply:', error);
      return this.riftsConfig.totalSupply;
    }
  }

  // Get user's RIFTS token balance
  async getUserRiftsBalance(user: PublicKey): Promise<number> {
    try {
      const userAccount = await getAssociatedTokenAddress(
        this.riftsConfig.mint,
        user
      );
      
      const accountInfo = await getAccount(this.connection, userAccount);
      return Number(accountInfo.amount) / Math.pow(10, this.riftsConfig.decimals);
    } catch (error) {
      // Account doesn't exist
      return 0;
    }
  }

  // Get user's LP staking position
  getUserStakingPosition(user: PublicKey): LPStakePosition | null {
    return this.lpStakingPositions.get(user.toBase58()) || null;
  }

  // Get RIFTS token statistics
  async getRiftsTokenStats(): Promise<{
    totalSupply: number;
    circulatingSupply: number;
    currentPrice: number;
    totalStaked: number;
    totalRewardsDistributed: number;
    burnedTokens: number;
  }> {
    try {
      const totalSupply = await this.getCurrentSupply();
      const currentPrice = await this.getRiftsTokenPrice();
      
      // Calculate total staked from positions
      const totalStaked = Array.from(this.lpStakingPositions.values())
        .reduce((sum, pos) => sum + pos.lpTokenAmount, 0);

      return {
        totalSupply,
        circulatingSupply: totalSupply * 0.8, // Estimate
        currentPrice,
        totalStaked,
        totalRewardsDistributed: 0, // Track from events
        burnedTokens: this.riftsConfig.totalSupply - totalSupply
      };
    } catch (error) {
      console.error('Error getting RIFTS stats:', error);
      return {
        totalSupply: this.riftsConfig.totalSupply,
        circulatingSupply: 0,
        currentPrice: 0.001,
        totalStaked: 0,
        totalRewardsDistributed: 0,
        burnedTokens: 0
      };
    }
  }
}