import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { validateOrigin } from '@/lib/middleware/csrf-protection';
import { checkRateLimit, apiRateLimiter } from '@/lib/middleware/rate-limiter';
import { supabaseServer, isServiceRoleConfigured } from '@/lib/supabase/server';

const RIFTS_PROGRAM_ID = new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // SECURITY FIX: Apply CSRF protection
  if (!validateOrigin(req as any)) {
    console.warn(`🚫 CSRF: Blocked clear-cache request from origin: ${req.headers.origin}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid origin. This API endpoint can only be accessed from authorized domains.'
    });
  }

  // SECURITY FIX: Apply rate limiting
  const rateLimit = checkRateLimit(req as any, apiRateLimiter);
  if (!rateLimit.allowed) {
    console.warn(`🚫 Rate limit exceeded for clear-cache`);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: rateLimit.retryAfter
    });
  }

  // SECURITY FIX: Require authentication
  const authToken = req.headers.authorization;
  const expectedToken = process.env.CACHE_ADMIN_TOKEN;

  if (!expectedToken) {
    console.error('🚨 CACHE_ADMIN_TOKEN not configured');
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Authentication not configured'
    });
  }

  if (authToken !== `Bearer ${expectedToken}`) {
    console.warn('🚫 Unauthorized cache clear attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid authentication token required'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧹 Clearing old rifts cache...');

    // SECURITY FIX: Use service role client for database operations
    if (!isServiceRoleConfigured) {
      return res.status(503).json({
        success: false,
        error: 'Service role not configured',
        message: 'Set SUPABASE_SERVICE_ROLE_KEY environment variable'
      });
    }

    const supabase = supabaseServer;
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Get all rifts from new program
    const accounts = await connection.getProgramAccounts(RIFTS_PROGRAM_ID, {
      commitment: 'confirmed',
      encoding: 'base64',
      filters: [{ dataSize: 952 }]
    });

    const newRiftAddresses = new Set(accounts.map(a => a.pubkey.toBase58()));

    // Get cached rifts
    const { data: cachedRifts, error: fetchError } = await supabase
      .from('rifts')
      .select('address');

    if (fetchError) {
      console.error('Error fetching cached rifts:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch cached rifts' });
    }

    // Find old rifts
    const oldRifts = cachedRifts?.filter(r => !newRiftAddresses.has(r.address)) || [];

    if (oldRifts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No old rifts found - cache is clean',
        cleared: 0,
        activeRifts: newRiftAddresses.size
      });
    }

    // Mark old rifts as deprecated
    const { error: updateError } = await supabase
      .from('rifts')
      .update({ is_deprecated: true })
      .in('address', oldRifts.map(r => r.address));

    if (updateError) {
      console.error('Error updating rifts:', updateError);
      return res.status(500).json({ error: 'Failed to mark old rifts as deprecated' });
    }

    // Add to deprecated_rifts table
    const deprecatedEntries = oldRifts.map(r => ({
      address: r.address,
      deprecated_at: new Date().toISOString(),
      reason: 'Migrated to new program: D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn'
    }));

    await supabase
      .from('deprecated_rifts')
      .upsert(deprecatedEntries, { onConflict: 'address' });

    console.log(`✅ Cleared ${oldRifts.length} old rifts from cache`);

    return res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
      cleared: oldRifts.length,
      activeRifts: newRiftAddresses.size,
      oldRifts: oldRifts.map(r => r.address)
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
