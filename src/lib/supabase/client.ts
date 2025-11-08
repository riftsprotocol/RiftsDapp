import { createClient, SupabaseClient } from '@supabase/supabase-js';

// TODO: Add these to your .env.local file:
// NEXT_PUBLIC_SUPABASE_URL=your-project-url
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ Supabase credentials not found. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
  }
}

// Only create client if we have valid credentials, otherwise create a dummy client
// that won't be used during build time
let supabaseClient: SupabaseClient;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Create a dummy client for build time - this won't actually be used
  supabaseClient = createClient('https://dummy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15IiByIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.dummykey');
}

export const supabase = supabaseClient;

// Database types
export interface RiftRecord {
  id: string; // Rift account address (primary key)
  name: string;
  created_at: string;
  updated_at: string;

  // Rift state
  is_open: boolean;
  total_tokens_wrapped: string;
  total_fees_collected: string;

  // Pricing
  entry_price: string;
  current_price: string;
  price_change_24h: number;

  // Volume & participants
  volume_24h: string;
  total_participants: number;

  // Token info
  token_mint: string;
  token_symbol: string;
  token_decimals: number;

  // Vault info
  vault_balance: string;

  // Metadata
  is_deprecated: boolean; // Flag for old buggy rifts
  program_id: string; // Track which program created this rift

  // Raw data (JSON)
  raw_data: any; // Store full ProductionRiftData for compatibility
}

export interface DeprecatedRift {
  address: string;
  reason: string;
  deprecated_at: string;
}
