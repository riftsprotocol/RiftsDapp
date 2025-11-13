// Server-side PDA vanity generation pool with persistence
// SECURITY FIX: Added CSRF protection and rate limiting
import type { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { validateOrigin } from '@/lib/middleware/csrf-protection';
import { checkRateLimit, apiRateLimiter } from '@/lib/middleware/rate-limiter';

// Try to load native accelerated generator
let nativeGenerator: any = null;
try {
  // Use absolute path from project root
  const addonPath = path.join(process.cwd(), 'gpu-vanity', 'index.node');
  console.log(`🔍 Attempting to load addon from: ${addonPath}`);
  console.log(`📁 Addon exists: ${require('fs').existsSync(addonPath)}`);

  nativeGenerator = require(addonPath);
  console.log('✅ LOADED NATIVE MULTI-CORE VANITY GENERATOR (~70M attempts/sec!)');
} catch (error: any) {
  console.log('⚠️ Native generator not available, using JS fallback');
  console.log('Error details:', error.message);
  console.log('Stack:', error.stack?.split('\n')[0]);
}

// Pre-generated PDA pool
interface VanityPDA {
  mintPDA: string;
  mintBump: number;
  vanitySeed: string; // hex string
  creator: string;
  underlyingMint: string;
  generated: number;
}

// File path for persistence
const POOL_FILE = path.join(process.cwd(), '.vanity-pda-pool.json');

// Load pool from file on startup
let pdaPool: VanityPDA[] = [];
try {
  if (fs.existsSync(POOL_FILE)) {
    const data = fs.readFileSync(POOL_FILE, 'utf-8');
    pdaPool = JSON.parse(data);
    console.log(`📂 Loaded ${pdaPool.length} vanity PDAs from cache`);
  }
} catch (error) {
  console.log('📂 No cached vanity PDAs found, starting fresh');
}

let isGenerating = false;
const POOL_SIZE = 10;
const RIFTS_PROGRAM_ID = new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn'); // ✅ FIXED DEPLOYMENT

// Save pool to file
function savePool() {
  try {
    fs.writeFileSync(POOL_FILE, JSON.stringify(pdaPool, null, 2));
    console.log(`💾 Saved ${pdaPool.length} vanity PDAs to cache`);
  } catch (error) {
    console.error('❌ Failed to save pool:', error);
  }
}

// Generate PDA with vanity pattern (accelerated with native addon if available)
async function generateVanityPDA(
  creator: PublicKey,
  underlyingMint: PublicKey,
  targetPattern: string,
  maxAttempts: number = 10000000
): Promise<VanityPDA | null> {
  const startTime = Date.now();

  // Use native accelerated generator if available
  if (nativeGenerator) {
    try {
      const result = nativeGenerator.generateVanityPDA(
        RIFTS_PROGRAM_ID.toBase58(),
        creator.toBase58(),
        underlyingMint.toBase58(),
        targetPattern,
        maxAttempts
      );

      const duration = Date.now() - startTime;
      console.log(`⚡ FAST: Generated "${targetPattern}" in ${(duration/1000).toFixed(2)}s (${result.attempts.toLocaleString()} attempts, ~${Math.round(result.attempts/(duration/1000)).toLocaleString()}/sec)`);

      return {
        mintPDA: result.pda,
        mintBump: result.bump,
        vanitySeed: result.seed,
        creator: creator.toBase58(),
        underlyingMint: underlyingMint.toBase58(),
        generated: Date.now()
      };
    } catch (error) {
      console.log('⚠️ Native generator failed, falling back to JS');
    }
  }

  // Fallback to JS implementation (slow)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const vanitySeed = Buffer.from(
      Array.from({ length: 12 }, () => Math.floor(Math.random() * 256))
    );

    try {
      const [mintPDA, mintBump] = PublicKey.findProgramAddressSync([
        Buffer.from("rift_mint"),
        creator.toBuffer(),
        underlyingMint.toBuffer(),
        vanitySeed
      ], RIFTS_PROGRAM_ID);

      const address = mintPDA.toBase58();

      if (targetPattern === '' || address.toLowerCase().endsWith(targetPattern.toLowerCase())) {
        const duration = Date.now() - startTime;
        console.log(`⚡ JS fallback: Generated "${targetPattern}" in ${(duration/1000).toFixed(1)}s`);

        return {
          mintPDA: mintPDA.toBase58(),
          mintBump,
          vanitySeed: vanitySeed.toString('hex'),
          creator: creator.toBase58(),
          underlyingMint: underlyingMint.toBase58(),
          generated: Date.now()
        };
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

// Refill the pool
async function refillPool(creator: string, underlyingMint: string) {
  if (isGenerating) return;
  isGenerating = true;

  console.log(`🏭 Server refilling PDA pool (current: ${pdaPool.length}/${POOL_SIZE})`);

  const creatorPubkey = new PublicKey(creator);
  const mintPubkey = new PublicKey(underlyingMint);

  try {
    while (pdaPool.length < POOL_SIZE) {
      // Just generate 'rft' pattern - much faster!
      let vanity = await generateVanityPDA(creatorPubkey, mintPubkey, 'rft', 500000);

      // If still fails, try again with more attempts (no fallback to empty pattern)
      if (!vanity) {
        vanity = await generateVanityPDA(creatorPubkey, mintPubkey, 'rft', 1000000);
      }

      if (vanity) {
        pdaPool.push(vanity);
        console.log(`📦 Server PDA pool: ${pdaPool.length}/${POOL_SIZE} ready`);
        savePool(); // Save after each addition
      } else {
        console.log('⚠️ Could not generate vanity PDA, retrying...');
      }
    }

    console.log(`✅ Server PDA pool filled: ${pdaPool.length} addresses ready`);
  } catch (error) {
    console.error('❌ Pool refill error:', error);
  } finally {
    isGenerating = false;
  }
}

// API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // SECURITY FIX: Apply CSRF protection
  if (!validateOrigin(req as any)) {
    console.warn(`🚫 CSRF: Blocked vanity-pda-pool request from origin: ${req.headers.origin}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid origin. This API endpoint can only be accessed from authorized domains.'
    });
  }

  // SECURITY FIX: Apply rate limiting
  const rateLimit = checkRateLimit(req as any, apiRateLimiter);
  if (!rateLimit.allowed) {
    console.warn(`🚫 Rate limit exceeded for vanity-pda-pool`);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: rateLimit.retryAfter
    });
  }

  if (req.method === 'GET') {
    // Get a PDA from the pool
    const { creator, underlyingMint } = req.query;

    if (!creator || !underlyingMint) {
      return res.status(400).json({ error: 'Missing creator or underlyingMint' });
    }

    // Filter pool for matching creator and mint
    const matchingPDA = pdaPool.find(
      pda => pda.creator === creator && pda.underlyingMint === underlyingMint
    );

    if (matchingPDA) {
      // Remove from pool
      pdaPool = pdaPool.filter(pda => pda !== matchingPDA);
      console.log(`🎯 Serving pre-generated PDA: ${matchingPDA.mintPDA} (${pdaPool.length} remaining)`);
      savePool(); // Save after removal

      // Trigger refill if running low
      if (pdaPool.length < 3) {
        refillPool(creator as string, underlyingMint as string);
      }

      return res.status(200).json(matchingPDA);
    }

    // If no matching PDA, generate one quickly
    console.log('⚠️ No matching PDA in pool, generating on demand...');

    try {
      const creatorPubkey = new PublicKey(creator as string);
      const mintPubkey = new PublicKey(underlyingMint as string);

      // Try rft pattern (faster) with more attempts
      let vanity = await generateVanityPDA(creatorPubkey, mintPubkey, 'rft', 200000);

      if (!vanity) {
        // Try again with even more attempts (no fallback to empty pattern)
        vanity = await generateVanityPDA(creatorPubkey, mintPubkey, 'rft', 500000);
      }

      if (vanity) {
        // Also trigger pool refill
        if (pdaPool.length < POOL_SIZE) {
          refillPool(creator as string, underlyingMint as string);
        }

        return res.status(200).json(vanity);
      }

      return res.status(500).json({ error: 'Could not generate vanity PDA' });
    } catch (error) {
      console.error('❌ PDA generation error:', error);
      return res.status(500).json({ error: 'PDA generation failed' });
    }
  }

  if (req.method === 'PUT') {
    // Pre-fill the pool (called on server start)
    const { creator, underlyingMint } = req.body;

    if (!creator || !underlyingMint) {
      return res.status(400).json({ error: 'Missing creator or underlyingMint' });
    }

    await refillPool(creator, underlyingMint);
    return res.status(200).json({ poolSize: pdaPool.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}