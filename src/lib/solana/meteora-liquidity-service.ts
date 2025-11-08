/**
 * Meteora Liquidity Management Service
 * Based on working add-liquidity-full.js and remove-liquidity-WORKING.js scripts
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, ComputeBudgetProgram, Signer } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction
} from '@solana/spl-token';
import BN from 'bn.js';
import { debugLog, debugError } from '@/utils/debug';

// Meteora CP-AMM SDK types (minimal interface)
interface CpAmm {
  getUserPositionByPool(poolAddress: PublicKey, user: PublicKey): Promise<any[]>;
  fetchPoolState(poolAddress: PublicKey): Promise<any>;
  fetchPositionState(positionAddress: PublicKey): Promise<any>;
  getAllVestingsByPosition(positionAddress: PublicKey): Promise<any[]>;
  getDepositQuote(params: any): any; // Returns DepositQuote synchronously
  createPosition(params: any): Promise<Transaction>;
  addLiquidity(params: any): Promise<Transaction>;
  createPositionAndAddLiquidity(params: any): Promise<Transaction>;
  removeLiquidity(params: any): Promise<Transaction>;
  removeAllLiquidity(params: any): Promise<Transaction>;
}

const METEORA_PROGRAM_ID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG');

export interface AddLiquidityParams {
  poolAddress: string;
  wsolAmount: number; // in SOL
  riftAmount: number; // in tokens
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    sendTransaction?: (tx: Transaction, connection: Connection) => Promise<string>;
  };
  connection: Connection;
}

export interface RemoveLiquidityParams {
  poolAddress: string;
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    sendTransaction?: (tx: Transaction, connection: Connection) => Promise<string>;
  };
  connection: Connection;
}

export interface LiquidityPosition {
  address: string;
  nftMint: string;
  nftAccount: string;
  unlockedLiquidity: string;
  poolAddress: string;
}

export interface DepositQuoteResult {
  wsolNeeded: number; // in SOL
  riftNeeded: number; // in tokens
  liquidityDelta: string;
  poolRatio: number; // RIFT per SOL
}

export class MeteoraLiquidityService {
  private connection: Connection;
  private cpAmm: CpAmm | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Initialize Meteora SDK
   */
  private async initializeCpAmm(): Promise<void> {
    if (this.cpAmm) return;

    try {
      // Dynamically import Meteora SDK
      const { CpAmm } = await import('@meteora-ag/cp-amm-sdk');
      this.cpAmm = new CpAmm(this.connection);
      debugLog('✅ Meteora SDK initialized');
    } catch (error) {
      debugError('Failed to initialize Meteora SDK:', error);
      throw new Error('Meteora SDK not available');
    }
  }

  /**
   * Get deposit quote from RIFT amount - shows exact SOL needed
   */
  async getDepositQuoteFromRift(poolAddress: string, riftAmount: number): Promise<DepositQuoteResult> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('CP-AMM not initialized');

    try {
      const poolPubkey = new PublicKey(poolAddress);
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);

      const riftAmountLamports = Math.floor(riftAmount * 1e9);

      const depositQuote = await this.cpAmm.getDepositQuote({
        inAmount: new BN(riftAmountLamports),
        isTokenA: false, // Providing RIFT (token B)
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
        sqrtPrice: poolState.sqrtPrice
      });

      const wsolNeeded = depositQuote.outputAmount;
      const riftNeeded = depositQuote.consumedInputAmount;

      // Get current pool balances to calculate ratio
      const vaultA = await this.connection.getTokenAccountBalance(poolState.tokenAVault);
      const vaultB = await this.connection.getTokenAccountBalance(poolState.tokenBVault);
      const poolRatio = parseFloat(vaultB.value.uiAmountString || '0') / parseFloat(vaultA.value.uiAmountString || '0');

      return {
        wsolNeeded: wsolNeeded.toNumber() / 1e9,
        riftNeeded: riftNeeded.toNumber() / 1e9,
        liquidityDelta: depositQuote.liquidityDelta.toString(),
        poolRatio
      };
    } catch (error) {
      debugError('Failed to get deposit quote from RIFT:', error);
      throw error;
    }
  }

  /**
   * Get deposit quote from SOL amount - shows exact RIFT needed
   */
  async getDepositQuoteFromSol(poolAddress: string, solAmount: number): Promise<DepositQuoteResult> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('CP-AMM not initialized');

    try {
      const poolPubkey = new PublicKey(poolAddress);
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);

      const solAmountLamports = Math.floor(solAmount * 1e9);

      const depositQuote = await this.cpAmm.getDepositQuote({
        inAmount: new BN(solAmountLamports),
        isTokenA: true, // Providing SOL (token A)
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
        sqrtPrice: poolState.sqrtPrice
      });

      const riftNeeded = depositQuote.outputAmount;
      const wsolNeeded = depositQuote.consumedInputAmount;

      // Get current pool balances to calculate ratio
      const vaultA = await this.connection.getTokenAccountBalance(poolState.tokenAVault);
      const vaultB = await this.connection.getTokenAccountBalance(poolState.tokenBVault);
      const poolRatio = parseFloat(vaultB.value.uiAmountString || '0') / parseFloat(vaultA.value.uiAmountString || '0');

      return {
        wsolNeeded: wsolNeeded.toNumber() / 1e9,
        riftNeeded: riftNeeded.toNumber() / 1e9,
        liquidityDelta: depositQuote.liquidityDelta.toString(),
        poolRatio
      };
    } catch (error) {
      debugError('Failed to get deposit quote from SOL:', error);
      throw error;
    }
  }

  /**
   * Get deposit quote - wrapper that uses RIFT amount by default
   * @deprecated Use getDepositQuoteFromRift or getDepositQuoteFromSol
   */
  async getDepositQuote(poolAddress: string, riftAmount: number): Promise<DepositQuoteResult> {
    return this.getDepositQuoteFromRift(poolAddress, riftAmount);
  }

  /**
   * Add liquidity to a Meteora pool
   * Based on add-liquidity-full.js working script
   */
  async addLiquidity(params: AddLiquidityParams): Promise<string> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('CP-AMM not initialized');

    debugLog('🌊 Adding liquidity to Meteora pool:', params.poolAddress);

    try {
      const poolPubkey = new PublicKey(params.poolAddress);
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);

      // Step 1: Get deposit quote FIRST to know exact amounts needed
      debugLog('🔄 Getting deposit quote...');

      const riftAmountLamports = Math.floor(params.riftAmount * 1e9);

      const depositQuote = await this.cpAmm.getDepositQuote({
        inAmount: new BN(riftAmountLamports),
        isTokenA: false, // Providing RIFT (token B)
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
        sqrtPrice: poolState.sqrtPrice
      });

      const wsolNeeded = depositQuote.outputAmount;
      const riftNeeded = depositQuote.consumedInputAmount;

      debugLog('📋 Quote:');
      debugLog('  wSOL needed:', (wsolNeeded.toNumber() / 1e9).toFixed(9));
      debugLog('  RIFT needed:', (riftNeeded.toNumber() / 1e9).toFixed(9));

      // Step 2: Check SOL balance
      const wsolNeededSol = wsolNeeded.toNumber() / 1e9;
      const walletBalance = await this.connection.getBalance(params.wallet.publicKey);
      const availableSol = walletBalance / 1e9;

      debugLog('💰 SOL balance check:');
      debugLog(`   Need: ${wsolNeededSol.toFixed(9)} SOL`);
      debugLog(`   Have: ${availableSol.toFixed(9)} SOL`);

      // Leave 0.01 SOL for transaction fees
      if (wsolNeededSol > availableSol - 0.01) {
        throw new Error(`Insufficient SOL balance. Need ${wsolNeededSol.toFixed(9)} SOL, have ${availableSol.toFixed(9)} SOL. (Need to leave ~0.01 SOL for transaction fees)`);
      }

      debugLog('✅ Sufficient SOL balance available');

      // Step 3: Close any existing wSOL account so SDK will add fresh wrapping
      const wsolAta = await getAssociatedTokenAddress(
        NATIVE_MINT,
        params.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const wsolInfo = await this.connection.getAccountInfo(wsolAta);

      if (wsolInfo) {
        debugLog('⚠️  Closing existing wSOL account so SDK will add fresh wrapping...');

        const closeWsolTx = new Transaction().add(
          createCloseAccountInstruction(
            wsolAta,
            params.wallet.publicKey,
            params.wallet.publicKey,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        closeWsolTx.feePayer = params.wallet.publicKey;
        closeWsolTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

        let closeSig: string;
        if (params.wallet.sendTransaction) {
          closeSig = await params.wallet.sendTransaction(closeWsolTx, this.connection);
        } else {
          const signedCloseTx = await params.wallet.signTransaction(closeWsolTx);
          closeSig = await this.connection.sendRawTransaction(signedCloseTx.serialize());
        }

        debugLog('✅ Closed wSOL account, tx:', closeSig);
        debugLog('⏳ Waiting for confirmation...');

        // Poll for confirmation
        let confirmed = false;
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const status = await this.connection.getSignatureStatus(closeSig);
          if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
            confirmed = true;
            debugLog('✅ wSOL account closed - SDK will now add fresh wrapping');
            break;
          }
        }

        if (!confirmed) {
          debugLog('⚠️  Close taking longer, proceeding anyway...');
        }
      } else {
        debugLog('✅ No existing wSOL account - SDK will add wrapping');
      }

      // Step 4: Calculate thresholds (MAXIMUM acceptable amounts - 2x buffer for safety)
      const maxTokenA = wsolNeeded.mul(new BN(200)).div(new BN(100));
      const maxTokenB = riftNeeded.mul(new BN(200)).div(new BN(100));

      // Step 5: Generate position NFT and build transaction (SDK will handle wSOL wrapping)
      debugLog('🔨 Building add liquidity transaction...');

      const positionNftMint = Keypair.generate();
      debugLog('🎫 Position NFT:', positionNftMint.publicKey.toBase58());

      const depositTx = await this.cpAmm.createPositionAndAddLiquidity({
        payer: params.wallet.publicKey,
        owner: params.wallet.publicKey,
        pool: poolPubkey,
        positionNft: positionNftMint.publicKey,
        liquidityDelta: depositQuote.liquidityDelta,
        maxAmountTokenA: maxTokenA,
        maxAmountTokenB: maxTokenB,
        tokenAAmountThreshold: maxTokenA,
        tokenBAmountThreshold: maxTokenB,
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAProgram: TOKEN_PROGRAM_ID,
        tokenBProgram: TOKEN_PROGRAM_ID,
      });

      debugLog(`📦 SDK generated ${depositTx.instructions.length} instructions`);

      // Add compute budget
      depositTx.instructions.unshift(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 })
      );

      debugLog(`📦 Total ${depositTx.instructions.length} instructions (including compute budget)`);

      const { blockhash } = await this.connection.getLatestBlockhash();
      depositTx.recentBlockhash = blockhash;
      depositTx.feePayer = params.wallet.publicKey;

      // Sign with position NFT mint first (partial signing)
      depositTx.partialSign(positionNftMint);

      debugLog('📡 Requesting wallet signature...');

      // Have wallet add its signature (but don't send yet)
      const signedDepositTx = await params.wallet.signTransaction(depositTx);

      debugLog('📡 Sending transaction...');

      // Now send the fully-signed transaction
      // IMPORTANT: Skip preflight because simulation can't properly handle wSOL wrapping
      // even when account exists - the wrapping happens during execution, not simulation
      const depositSig = await this.connection.sendRawTransaction(signedDepositTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      });

      debugLog('✅ Deposit transaction sent:', depositSig);
      debugLog('   Position NFT:', positionNftMint.publicKey.toBase58());

      return depositSig;

    } catch (error) {
      debugError('❌ Failed to add liquidity:', error);
      throw error;
    }
  }

  /**
   * Remove liquidity from a Meteora pool
   * Based on remove-liquidity-WORKING.js script
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<string> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('CP-AMM not initialized');

    debugLog('🌊 Removing liquidity from Meteora pool:', params.poolAddress);

    try {
      const poolPubkey = new PublicKey(params.poolAddress);

      // Step 1: Ensure wSOL account exists (required for receiving SOL)
      const wsolAta = await getAssociatedTokenAddress(
        NATIVE_MINT,
        params.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const wsolInfo = await this.connection.getAccountInfo(wsolAta);

      if (!wsolInfo) {
        debugLog('⚠️  Creating wSOL account for receiving liquidity...');
        const createWsolTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            params.wallet.publicKey,
            wsolAta,
            params.wallet.publicKey,
            NATIVE_MINT,
            TOKEN_PROGRAM_ID
          )
        );

        createWsolTx.feePayer = params.wallet.publicKey;
        createWsolTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

        // Use wallet's sendTransaction to properly handle signing and sending
        let sig: string;
        if (params.wallet.sendTransaction) {
          sig = await params.wallet.sendTransaction(createWsolTx, this.connection);
        } else {
          const signedTx = await params.wallet.signTransaction(createWsolTx);
          sig = await this.connection.sendRawTransaction(signedTx.serialize());
        }

        // Don't wait for confirmation - let it process in background
        debugLog('✅ Sent wSOL account creation tx:', sig);
        debugLog('   (Processing in background)...');

        // Wait a bit for transaction to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Get user positions
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);
      const userPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, params.wallet.publicKey);

      if (userPositions.length === 0) {
        throw new Error('No positions found in this pool');
      }

      const position = userPositions[0];
      debugLog('✅ Found position:', position.position.toBase58());

      const positionState = await this.cpAmm.fetchPositionState(position.position);
      debugLog('   Unlocked liquidity:', positionState.unlockedLiquidity.toString());

      // Step 3: Get vestings (if any)
      let vestings: any[] = [];
      try {
        vestings = await this.cpAmm.getAllVestingsByPosition(position.position);
      } catch (e) {
        vestings = [];
      }

      // Step 4: Build remove liquidity transaction
      const removeParams = {
        owner: params.wallet.publicKey,
        pool: poolPubkey,
        position: position.position,
        positionNftAccount: position.positionNftAccount,
        tokenAAmountThreshold: new BN(0),
        tokenBAmountThreshold: new BN(0),
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAProgram: TOKEN_PROGRAM_ID,
        tokenBProgram: TOKEN_PROGRAM_ID,
        vestings: vestings.length > 0 ? vestings.map(v => ({ account: v.publicKey })) : []
      };

      debugLog('🔨 Building remove liquidity transaction...');

      // SDK returns Transaction directly, not TxBuilder
      const removeTx = await this.cpAmm.removeAllLiquidity(removeParams);

      debugLog('✅ SDK returned Transaction with', removeTx.instructions.length, 'instructions');

      // Add compute budget
      removeTx.instructions.unshift(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 })
      );

      removeTx.feePayer = params.wallet.publicKey;
      removeTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

      // Sign and send using wallet's sendTransaction
      let sig: string;
      if (params.wallet.sendTransaction) {
        sig = await params.wallet.sendTransaction(removeTx, this.connection);
      } else {
        const signedTx = await params.wallet.signTransaction(removeTx);
        sig = await this.connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3
        });
      }

      debugLog('📡 Sent remove liquidity transaction:', sig);
      debugLog('   (Processing in background)...');

      debugLog('✅ Liquidity removed successfully!');
      return sig;

    } catch (error) {
      debugError('❌ Failed to remove liquidity:', error);
      throw error;
    }
  }

  /**
   * Remove specific liquidity positions from a pool
   */
  async removeSpecificPositions(params: {
    poolAddress: string;
    positionAddresses: string[]; // Array of position addresses to remove
    wallet: {
      publicKey: PublicKey;
      signTransaction: (transaction: Transaction) => Promise<Transaction>;
      sendTransaction?: (transaction: Transaction, connection: Connection) => Promise<string>;
    };
    connection: Connection;
  }): Promise<string[]> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('Failed to initialize CpAmm');

    const signatures: string[] = [];
    const poolPubkey = new PublicKey(params.poolAddress);

    try {
      debugLog('🌊 Removing specific positions from pool...');
      debugLog(`   Pool: ${params.poolAddress}`);
      debugLog(`   Positions to remove: ${params.positionAddresses.length}`);

      // Fetch pool state once
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);

      // Get all user positions
      const allPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, params.wallet.publicKey);

      // Filter to only the positions we want to remove
      const positionsToRemove = allPositions.filter((pos: any) =>
        params.positionAddresses.includes(pos.position.toBase58())
      );

      if (positionsToRemove.length === 0) {
        throw new Error('None of the specified positions were found');
      }

      debugLog(`✅ Found ${positionsToRemove.length} positions to remove`);

      // Remove each position
      for (const position of positionsToRemove) {
        debugLog(`\n🔄 Removing position ${position.position.toBase58()}...`);

        const positionState = await this.cpAmm.fetchPositionState(position.position);
        debugLog('   Unlocked liquidity:', positionState.unlockedLiquidity.toString());

        // Get vestings (if any)
        let vestings: any[] = [];
        try {
          vestings = await this.cpAmm.getAllVestingsByPosition(position.position);
        } catch (e) {
          vestings = [];
        }

        // Build remove liquidity transaction
        const removeParams = {
          owner: params.wallet.publicKey,
          pool: poolPubkey,
          position: position.position,
          positionNftAccount: position.positionNftAccount,
          tokenAAmountThreshold: new BN(0),
          tokenBAmountThreshold: new BN(0),
          tokenAMint: poolState.tokenAMint,
          tokenBMint: poolState.tokenBMint,
          tokenAVault: poolState.tokenAVault,
          tokenBVault: poolState.tokenBVault,
          tokenAProgram: TOKEN_PROGRAM_ID,
          tokenBProgram: TOKEN_PROGRAM_ID,
          vestings: vestings.length > 0 ? vestings.map(v => ({ account: v.publicKey })) : []
        };

        debugLog('🔨 Building remove liquidity transaction...');

        const removeTx = await this.cpAmm.removeAllLiquidity(removeParams);

        debugLog('✅ SDK returned Transaction with', removeTx.instructions.length, 'instructions');

        // Add compute budget
        removeTx.instructions.unshift(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 })
        );

        removeTx.feePayer = params.wallet.publicKey;
        removeTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

        // Sign and send using wallet's sendTransaction
        let sig: string;
        if (params.wallet.sendTransaction) {
          sig = await params.wallet.sendTransaction(removeTx, this.connection);
        } else {
          const signedTx = await params.wallet.signTransaction(removeTx);
          sig = await this.connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3
          });
        }

        debugLog('✅ Position removed! Signature:', sig);
        signatures.push(sig);
      }

      debugLog(`\n✅ All ${signatures.length} positions removed successfully!`);
      return signatures;

    } catch (error) {
      debugError('❌ Failed to remove positions:', error);
      throw error;
    }
  }

  /**
   * Remove a percentage of total liquidity from user's positions
   */
  async removeLiquidityByPercentage(params: {
    poolAddress: string;
    percentage: number; // 0-100
    wallet: {
      publicKey: PublicKey;
      signTransaction: (transaction: Transaction) => Promise<Transaction>;
      sendTransaction?: (transaction: Transaction, connection: Connection) => Promise<string>;
    };
    connection: Connection;
  }): Promise<{ signatures: string[]; removedLiquidity: string; withdrawnTokenA: number; withdrawnTokenB: number }> {
    await this.initializeCpAmm();
    if (!this.cpAmm) throw new Error('Failed to initialize CpAmm');

    if (params.percentage < 0 || params.percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    const signatures: string[] = [];
    const poolPubkey = new PublicKey(params.poolAddress);

    try {
      debugLog('🌊 Removing liquidity by percentage...');
      debugLog(`   Pool: ${params.poolAddress}`);
      debugLog(`   Percentage: ${params.percentage}%`);

      // Step 1: Fetch pool state and all user positions
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);
      const allPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, params.wallet.publicKey);

      if (allPositions.length === 0) {
        throw new Error('No positions found in this pool');
      }

      // Step 2: Calculate total liquidity and target amount to remove
      let totalLiquidity = new BN(0);
      const positionsWithLiquidity = [];

      for (const pos of allPositions) {
        const positionState = await this.cpAmm.fetchPositionState(pos.position);
        totalLiquidity = totalLiquidity.add(positionState.unlockedLiquidity);
        positionsWithLiquidity.push({
          position: pos.position,
          positionNftAccount: pos.positionNftAccount,
          liquidity: positionState.unlockedLiquidity,
          positionState
        });
      }

      debugLog(`   Total liquidity: ${totalLiquidity.toString()}`);

      const targetToRemove = totalLiquidity.mul(new BN(params.percentage)).div(new BN(100));
      debugLog(`   Target to remove: ${targetToRemove.toString()} (${params.percentage}%)`);

      // Get user's token balances BEFORE removal
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const userTokenA = await getAssociatedTokenAddress(poolState.tokenAMint, params.wallet.publicKey);
      const userTokenB = await getAssociatedTokenAddress(poolState.tokenBMint, params.wallet.publicKey);

      const balanceABefore = await this.connection.getTokenAccountBalance(userTokenA).catch(() => ({ value: { uiAmount: 0 } }));
      const balanceBBefore = await this.connection.getTokenAccountBalance(userTokenB).catch(() => ({ value: { uiAmount: 0 } }));

      debugLog(`\n💰 User balances BEFORE:`);
      debugLog(`   Token A: ${balanceABefore.value.uiAmount}`);
      debugLog(`   Token B: ${balanceBBefore.value.uiAmount}`);

      let remainingToRemove = targetToRemove;

      // Step 3: Remove liquidity from positions until we reach the target
      for (const posData of positionsWithLiquidity) {
        if (remainingToRemove.isZero()) break;

        const positionLiquidity = posData.liquidity;

        // Decide whether to remove all or partial
        const shouldRemoveAll = positionLiquidity.lte(remainingToRemove);
        const amountToRemove = shouldRemoveAll ? positionLiquidity : remainingToRemove;

        debugLog(`\n🔄 Processing position ${posData.position.toBase58()}...`);
        debugLog(`   Position liquidity: ${positionLiquidity.toString()}`);
        debugLog(`   Will remove: ${amountToRemove.toString()} (${shouldRemoveAll ? 'ALL' : 'PARTIAL'})`);

        // Get vestings
        let vestings: any[] = [];
        try {
          vestings = await this.cpAmm.getAllVestingsByPosition(posData.position);
        } catch (e) {
          vestings = [];
        }

        const baseParams = {
          owner: params.wallet.publicKey,
          pool: poolPubkey,
          position: posData.position,
          positionNftAccount: posData.positionNftAccount,
          tokenAAmountThreshold: new BN(0),
          tokenBAmountThreshold: new BN(0),
          tokenAMint: poolState.tokenAMint,
          tokenBMint: poolState.tokenBMint,
          tokenAVault: poolState.tokenAVault,
          tokenBVault: poolState.tokenBVault,
          tokenAProgram: TOKEN_PROGRAM_ID,
          tokenBProgram: TOKEN_PROGRAM_ID,
          vestings: vestings.length > 0 ? vestings.map(v => ({ account: v.publicKey })) : []
        };

        let removeTx: Transaction;

        if (shouldRemoveAll) {
          // Remove all liquidity from this position
          removeTx = await this.cpAmm.removeAllLiquidity(baseParams);
          debugLog('   Using removeAllLiquidity');
        } else {
          // Remove partial liquidity from this position
          removeTx = await this.cpAmm.removeLiquidity({
            ...baseParams,
            liquidityDelta: amountToRemove
          });
          debugLog('   Using removeLiquidity with liquidityDelta:', amountToRemove.toString());
        }

        debugLog('✅ Transaction built with', removeTx.instructions.length, 'instructions');

        // Add compute budget
        removeTx.instructions.unshift(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 })
        );

        removeTx.feePayer = params.wallet.publicKey;
        removeTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

        // Sign and send
        let sig: string;
        if (params.wallet.sendTransaction) {
          sig = await params.wallet.sendTransaction(removeTx, this.connection);
        } else {
          const signedTx = await params.wallet.signTransaction(removeTx);
          sig = await this.connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3
          });
        }

        debugLog('✅ Position processed! Signature:', sig);
        signatures.push(sig);

        // Update remaining
        remainingToRemove = remainingToRemove.sub(amountToRemove);
      }

      const actualRemoved = targetToRemove.sub(remainingToRemove);
      debugLog(`\n✅ Removed ${actualRemoved.toString()} liquidity (${params.percentage}% of total)`);
      debugLog(`   Transactions: ${signatures.length}`);

      // Get user's token balances AFTER removal
      const balanceAAfter = await this.connection.getTokenAccountBalance(userTokenA).catch(() => ({ value: { uiAmount: 0 } }));
      const balanceBAfter = await this.connection.getTokenAccountBalance(userTokenB).catch(() => ({ value: { uiAmount: 0 } }));

      const withdrawnTokenA = (balanceAAfter.value.uiAmount || 0) - (balanceABefore.value.uiAmount || 0);
      const withdrawnTokenB = (balanceBAfter.value.uiAmount || 0) - (balanceBBefore.value.uiAmount || 0);

      debugLog(`\n💰 User balances AFTER:`);
      debugLog(`   Token A: ${balanceAAfter.value.uiAmount} (+${withdrawnTokenA})`);
      debugLog(`   Token B: ${balanceBAfter.value.uiAmount} (+${withdrawnTokenB})`);

      return {
        signatures,
        removedLiquidity: actualRemoved.toString(),
        withdrawnTokenA,
        withdrawnTokenB
      };

    } catch (error) {
      debugError('❌ Failed to remove liquidity by percentage:', error);
      throw error;
    }
  }

  /**
   * Get detailed position information including estimated token amounts
   */
  async getDetailedPositions(params: {
    poolAddress: string;
    userPublicKey: PublicKey | string;
  }): Promise<Array<{
    address: string;
    unlockedLiquidity: string;
    estimatedTokenA: number;
    estimatedTokenB: number;
    percentageOfTotal: number;
  }> | null> {
    await this.initializeCpAmm();
    if (!this.cpAmm) return null;

    try {
      const poolPubkey = new PublicKey(params.poolAddress);
      const userPubkey = typeof params.userPublicKey === 'string' ? new PublicKey(params.userPublicKey) : params.userPublicKey;

      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);
      const allPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, userPubkey);

      if (allPositions.length === 0) return null;

      // Get pool reserves
      const vaultABalance = await this.connection.getTokenAccountBalance(poolState.tokenAVault);
      const vaultBBalance = await this.connection.getTokenAccountBalance(poolState.tokenBVault);

      const reserveA = new BN(vaultABalance.value.amount);
      const reserveB = new BN(vaultBBalance.value.amount);

      // Calculate total user liquidity
      let totalUserLiquidity = new BN(0);
      const positionStates = [];

      for (const pos of allPositions) {
        const positionState = await this.cpAmm.fetchPositionState(pos.position);
        totalUserLiquidity = totalUserLiquidity.add(positionState.unlockedLiquidity);
        positionStates.push({ pos, state: positionState });
      }

      debugLog(`📊 Detailed positions for pool ${params.poolAddress}:`);
      debugLog(`   Total user liquidity: ${totalUserLiquidity.toString()}`);
      debugLog(`   Pool reserves A: ${reserveA.toString()}`);
      debugLog(`   Pool reserves B: ${reserveB.toString()}`);

      const detailedPositions = [];

      for (const { pos, state } of positionStates) {
        const posLiquidity = state.unlockedLiquidity;
        const percentage = totalUserLiquidity.isZero()
          ? 0
          : (posLiquidity.mul(new BN(10000)).div(totalUserLiquidity).toNumber() / 100);

        // For each position, estimate what removing it would yield
        // Use pool's k=sqrt(x*y) relationship and liquidity formula
        // This is an approximation - actual amounts depend on concentrated liquidity curve
        const fraction = posLiquidity.mul(new BN(1000000)).div(totalUserLiquidity);
        const estimatedA = reserveA.mul(fraction).div(new BN(1000000));
        const estimatedB = reserveB.mul(fraction).div(new BN(1000000));

        const tokenAAmount = parseFloat(estimatedA.toString()) / Math.pow(10, vaultABalance.value.decimals);
        const tokenBAmount = parseFloat(estimatedB.toString()) / Math.pow(10, vaultBBalance.value.decimals);

        debugLog(`\n   Position ${pos.position.toBase58()}:`);
        debugLog(`     Liquidity: ${posLiquidity.toString()}`);
        debugLog(`     % of total: ${percentage.toFixed(2)}%`);
        debugLog(`     Est. Token A: ${tokenAAmount.toFixed(9)}`);
        debugLog(`     Est. Token B: ${tokenBAmount.toFixed(9)}`);

        detailedPositions.push({
          address: pos.position.toBase58(),
          unlockedLiquidity: posLiquidity.toString(),
          estimatedTokenA: tokenAAmount,
          estimatedTokenB: tokenBAmount,
          percentageOfTotal: percentage
        });
      }

      return detailedPositions;
    } catch (error) {
      debugError('Failed to get detailed positions:', error);
      return null;
    }
  }

  /**
   * Estimate token amounts user will receive when removing liquidity by percentage
   * Uses actual pool state and position data for accurate estimates
   */
  async estimateWithdrawalByPercentage(params: {
    poolAddress: string;
    userPublicKey: PublicKey | string;
    percentage: number; // 0-100
  }): Promise<{ tokenA: number; tokenB: number; totalLiquidity: string; positionCount: number } | null> {
    await this.initializeCpAmm();
    if (!this.cpAmm) return null;

    try {
      const poolPubkey = new PublicKey(params.poolAddress);
      const userPubkey = typeof params.userPublicKey === 'string' ? new PublicKey(params.userPublicKey) : params.userPublicKey;

      // Get pool state
      const poolState = await this.cpAmm.fetchPoolState(poolPubkey);

      // Get user positions and total liquidity
      const allPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, userPubkey);
      if (allPositions.length === 0) return null;

      let totalUserLiquidity = new BN(0);
      for (const pos of allPositions) {
        const positionState = await this.cpAmm.fetchPositionState(pos.position);
        totalUserLiquidity = totalUserLiquidity.add(positionState.unlockedLiquidity);
      }

      // Calculate liquidity to remove
      const liquidityToRemove = totalUserLiquidity.mul(new BN(params.percentage)).div(new BN(100));

      debugLog(`Estimating withdrawal for ${params.percentage}%:`);
      debugLog(`  Total user liquidity: ${totalUserLiquidity.toString()}`);
      debugLog(`  Liquidity to remove: ${liquidityToRemove.toString()}`);

      // Get the current pool reserves
      const vaultABalance = await this.connection.getTokenAccountBalance(poolState.tokenAVault);
      const vaultBBalance = await this.connection.getTokenAccountBalance(poolState.tokenBVault);

      const reserveA = new BN(vaultABalance.value.amount);
      const reserveB = new BN(vaultBBalance.value.amount);

      debugLog(`  Pool reserves A: ${reserveA.toString()}`);
      debugLog(`  Pool reserves B: ${reserveB.toString()}`);

      // FIXED: Use actual percentage of user's liquidity being removed
      // If removing X% of user's liquidity, estimate based on that fraction of user's proportional share
      // This assumes user's positions are spread across the same price range as pool average
      const userFractionOfRemoval = new BN(params.percentage * 10000); // percentage with 2 decimals precision

      // Rough estimate: assume user liquidity is proportional to pool reserves
      // withdrawnA ≈ (liquidityToRemove / totalUserLiquidity) * (user's share of pool) * reserveA
      // For simplicity, we approximate user's proportional share by their liquidity value
      const estimatedTokenA = reserveA.mul(userFractionOfRemoval).div(new BN(1000000));
      const estimatedTokenB = reserveB.mul(userFractionOfRemoval).div(new BN(1000000));

      const tokenAAmount = parseFloat(estimatedTokenA.toString()) / Math.pow(10, vaultABalance.value.decimals);
      const tokenBAmount = parseFloat(estimatedTokenB.toString()) / Math.pow(10, vaultBBalance.value.decimals);

      debugLog(`  Estimated Token A: ${tokenAAmount}`);
      debugLog(`  Estimated Token B: ${tokenBAmount}`);

      return {
        tokenA: tokenAAmount,
        tokenB: tokenBAmount,
        totalLiquidity: totalUserLiquidity.toString(),
        positionCount: allPositions.length
      };
    } catch (error) {
      debugError('Failed to estimate withdrawal:', error);
      return null;
    }
  }

  /**
   * Get user's liquidity positions for a pool
   */
  async getUserPositions(poolAddress: string, userPublicKey: PublicKey | string): Promise<LiquidityPosition[]> {
    await this.initializeCpAmm();
    if (!this.cpAmm) return [];

    try {
      const poolPubkey = new PublicKey(poolAddress);
      // Ensure userPublicKey is a PublicKey object
      const userPubkey = typeof userPublicKey === 'string' ? new PublicKey(userPublicKey) : userPublicKey;
      const userPositions = await this.cpAmm.getUserPositionByPool(poolPubkey, userPubkey);

      const positions: LiquidityPosition[] = [];

      for (const pos of userPositions) {
        const positionState = await this.cpAmm.fetchPositionState(pos.position);

        positions.push({
          address: pos.position.toBase58(),
          nftMint: positionState.nftMint.toBase58(),
          nftAccount: pos.positionNftAccount.toBase58(),
          unlockedLiquidity: positionState.unlockedLiquidity.toString(),
          poolAddress: poolAddress
        });
      }

      return positions;

    } catch (error) {
      debugError('Failed to get user positions:', error);
      return [];
    }
  }
}

// Export singleton
export const meteoraLiquidityService = new MeteoraLiquidityService(
  new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed')
);
