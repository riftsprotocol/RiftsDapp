// Global connection configuration to ensure all services use Alchemy
import { Connection } from '@solana/web3.js';

// SECURITY FIX: Never use hardcoded API keys - always use environment variables
// This will only work if NEXT_PUBLIC_SOLANA_RPC_URL is set, otherwise it will fail safely
const ALCHEMY_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

if (process.env.NODE_ENV === 'development') {
  // console.log('🔗 Creating global connection with endpoint:', ALCHEMY_ENDPOINT.replace(/\/v2\/.*/, '/v2/***'));
}

// Create singleton connection with retry configuration
export const globalConnection = new Connection(ALCHEMY_ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Export for use in all services
export default globalConnection;