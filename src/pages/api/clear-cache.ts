import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

const RIFTS_PROGRAM_ID = new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧹 Clearing old rifts cache...');

    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({
        success: true,
        message: 'Supabase not configured - cache clear skipped',
        cleared: 0
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
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
