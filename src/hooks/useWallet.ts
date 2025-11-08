// hooks/useWallet.ts - Fixed Real Solana Wallet Integration

import { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { 
  walletService, 
  riftProtocolService, 
  formatSolanaAddress
} from '@/lib/solana';
import { debugLog, debugError } from '@/utils/debug';

// Define RiftPosition type locally to avoid import issues
interface RiftPosition {
  riftId: string;
  amount: number;
  value: number;
  rewards: number;
  lastUpdate: number;
}

// Wallet adapter interface (compatible with @solana/wallet-adapter)
interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: Transaction) => Promise<string>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

// Phantom wallet interface with proper typing
interface PhantomWallet {
  publicKey: PublicKey | null;
  isConnected: boolean;
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: string;
  balance: number;
  positions: RiftPosition[];
  error: string | null;
}

export const useRealWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    connecting: false,
    publicKey: '',
    balance: 0,
    positions: [],
    error: null
  });

  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null);

  // Initialize wallet adapter (Phantom, Solflare, etc.)
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        // Check for Phantom wallet
        if (typeof window !== 'undefined') {
          const windowSolana = (window as unknown as { solana?: PhantomWallet }).solana;
          
          if (windowSolana?.isPhantom) {
            const phantom = windowSolana;
            
            const adapter: WalletAdapter = {
              publicKey: phantom.publicKey,
              connected: phantom.isConnected,
              connecting: false,
              connect: async () => {
                await phantom.connect();
              },
              disconnect: async () => {
                await phantom.disconnect();
              },
              sendTransaction: async (transaction: Transaction, connection?: Connection) => {
                try {
                  const connectionToUse = connection || (await import('@/lib/solana')).connection;

                  // Ensure transaction has all required fields
                  if (!transaction.recentBlockhash) {
                    const { blockhash } = await (connectionToUse as unknown as { getLatestBlockhash: () => Promise<{ blockhash: string }> }).getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                  }
                  if (!transaction.feePayer && phantom.publicKey) {
                    transaction.feePayer = phantom.publicKey;
                  }

                  debugLog('📝 Transaction to sign:', {
                    feePayer: transaction.feePayer?.toBase58(),
                    recentBlockhash: transaction.recentBlockhash,
                    instructions: transaction.instructions.length
                  });

                  // Use sign + send pattern instead of signAndSendTransaction
                  // This is more reliable with modern Phantom versions
                  if (typeof (phantom as any).signTransaction === 'function') {
                    debugLog('Using signTransaction + sendRawTransaction pattern');
                    const signed = await (phantom as any).signTransaction(transaction);
                    const rawTransaction = signed.serialize();
                    const signature = await (connectionToUse as any).sendRawTransaction(rawTransaction, {
                      skipPreflight: false,
                      preflightCommitment: 'confirmed'
                    });
                    debugLog('✅ Transaction sent:', signature);
                    return signature;
                  } else {
                    // Fallback to signAndSendTransaction
                    debugLog('Using signAndSendTransaction (fallback)');
                    const { signature } = await phantom.signAndSendTransaction(transaction);
                    debugLog('✅ Transaction sent via Phantom:', signature);
                    return signature;
                  }
                } catch (error) {
                  // Check if this is "already processed" error - if so, it means success
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  if (errorMsg.includes('already been processed')) {
                    debugLog('✅ Transaction already processed (Phantom duplicate submission - this is normal)');
                    throw error; // Re-throw so executeMeteoraSwap can handle it
                  }
                  debugError('❌ Phantom sendTransaction error:', error);
                  throw error;
                }
              },
              signTransaction: async (transaction: Transaction) => {
                // For signing only, return the transaction as-is
                return transaction;
              }
            };

            setWalletAdapter(adapter);
            walletService.setWalletAdapter(adapter);

            // Auto-connect if previously connected
            if (phantom.isConnected && phantom.publicKey) {
              await updateWalletState(adapter);
            }
          }
        }
      } catch (error) {
        debugError('Error initializing wallet:', error);
        setWallet(prev => ({ 
          ...prev, 
          error: 'Failed to initialize wallet' 
        }));
      }
    };

    initializeWallet();
  }, []);

  const updateWalletState = async (adapter: WalletAdapter) => {
    try {
      if (adapter.publicKey) {
        const balance = await walletService.getBalance(adapter.publicKey);
        const positions = await riftProtocolService.getUserPositions(adapter.publicKey);
        
        setWallet({
          connected: adapter.connected,
          connecting: false,
          publicKey: adapter.publicKey.toBase58(),
          balance,
          positions: positions as unknown as RiftPosition[],
          error: null
        });
      }
    } catch (error) {
      debugError('Error updating wallet state:', error);
      setWallet(prev => ({ 
        ...prev, 
        error: 'Failed to update wallet state',
        connecting: false 
      }));
    }
  };

  const connect = useCallback(async () => {
    if (!walletAdapter) {
      setWallet(prev => ({ 
        ...prev, 
        error: 'No wallet found. Please install Phantom wallet.' 
      }));
      return;
    }

    setWallet(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const result = await walletService.connectWallet();
      
      if (result.success) {
        await updateWalletState(walletAdapter);
      } else {
        setWallet(prev => ({ 
          ...prev, 
          connecting: false, 
          error: result.error || 'Failed to connect wallet' 
        }));
      }
    } catch {
      setWallet(prev => ({ 
        ...prev, 
        connecting: false, 
        error: 'Failed to connect wallet' 
      }));
    }
  }, [walletAdapter]);

  const disconnect = useCallback(async () => {
    try {
      await walletService.disconnectWallet();
      setWallet({
        connected: false,
        connecting: false,
        publicKey: '',
        balance: 0,
        positions: [],
        error: null
      });
    } catch (error) {
      debugError('Error disconnecting wallet:', error);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (walletAdapter?.publicKey) {
      try {
        const balance = await walletService.getBalance(walletAdapter.publicKey);
        setWallet(prev => ({ ...prev, balance }));
      } catch (error) {
        debugError('Error refreshing balance:', error);
      }
    }
  }, [walletAdapter]);

  const refreshPositions = useCallback(async () => {
    if (walletAdapter?.publicKey) {
      try {
        const positions = await riftProtocolService.getUserPositions(walletAdapter.publicKey);
        setWallet(prev => ({ ...prev, positions: positions as unknown as RiftPosition[] }));
      } catch (error) {
        debugError('Error refreshing positions:', error);
      }
    }
  }, [walletAdapter]);

  // Auto-refresh balance every 3 seconds when wallet is connected
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const doRefresh = async () => {
      if (walletAdapter?.publicKey) {
        try {
          // debugLog(`💰 Fetching balance for ${walletAdapter.publicKey.toBase58().slice(0, 8)}...`);
          const balance = await walletService.getBalance(walletAdapter.publicKey);
          // debugLog(`✅ Balance fetched: ${balance} SOL`);
          setWallet(prev => {
            if (prev.balance !== balance) {
              // debugLog(`🔄 Balance updated: ${prev.balance} → ${balance} SOL`);
            }
            return { ...prev, balance };
          });
        } catch (error) {
          debugError('❌ Error refreshing balance:', error);
        }
      } else {
        debugError('❌ Cannot refresh balance: no publicKey');
      }
    };

    if (wallet.connected && walletAdapter?.publicKey) {
      // debugLog('🔄 Started real-time balance polling (every 3s)');

      // Refresh immediately on connection
      doRefresh();

      // Set up polling interval (3 seconds)
      intervalId = setInterval(() => {
        doRefresh();
      }, 3000);
    }

    // Cleanup on disconnect or unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        // debugLog('🛑 Stopped real-time balance polling');
      }
    };
  }, [wallet.connected, walletAdapter]);

  // Format public key for display
  const formattedPublicKey = wallet.publicKey ? formatSolanaAddress(wallet.publicKey) : '';

  return {
    ...wallet,
    connect,
    disconnect,
    refreshBalance,
    refreshPositions,
    formattedPublicKey,
    isConnecting: wallet.connecting,
    sendTransaction: walletAdapter?.sendTransaction
  };
};

// ==================== REAL-TIME DATA HOOKS ====================

import { priceService } from '@/lib/solana';

interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  lastUpdate: number;
}

interface TVLData {
  total: number;
  change24h: number;
  timestamp: number;
}

interface VolumeData {
  total: number;
  change24h: number;
  timestamp: number;
}

export const useRealTimeData = () => {
  const [data, setData] = useState({
    totalTvl: 0,
    volume24h: 0,
    totalUsers: 0,
    riftsPrice: 0,
    prices: {} as Record<string, number>,
    loading: true
  });

  useEffect(() => {
    const updateData = async () => {
      try {
        // Get real price data
        const prices = await priceService.getMultiplePrices(['SOL', 'ETH', 'BTC']);
        const priceMap = prices.reduce((acc: Record<string, number>, price: TokenPrice) => {
          acc[price.symbol] = price.price;
          return acc;
        }, {} as Record<string, number>);
        
        // Calculate real metrics from production services
        const totalTvlSOL = await riftProtocolService.getTotalTVL();
        const volume24hSOL = await riftProtocolService.getTotal24hVolume();
        const totalUsers = await riftProtocolService.getUniqueUserCount();
        const riftsPrice = priceMap['RIFTS'] || 0.001;
        
        // Convert SOL values to USD using current SOL price
        const solPrice = priceMap['SOL'] || 180;
        const totalTvl = totalTvlSOL * solPrice;
        const volume24h = volume24hSOL * solPrice;

        setData(prev => ({ 
          ...prev, 
          totalTvl,
          volume24h,
          totalUsers,
          riftsPrice,
          prices: priceMap,
          loading: false 
        }));
      } catch (error) {
        debugError('Error fetching real-time data:', error);
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    // Initial load
    updateData();

    // Subscribe to real-time updates with proper type handling
    const handlePriceUpdate = (data: unknown) => {
      const prices = data as TokenPrice[];
      const priceMap = prices.reduce((acc: Record<string, number>, price: TokenPrice) => {
        acc[price.symbol] = price.price;
        return acc;
      }, {} as Record<string, number>);

      setData(prev => ({ ...prev, prices: priceMap }));
    };

    const handleTVLUpdate = (data: unknown) => {
      const tvlData = data as TVLData;
      setData(prev => ({ ...prev, totalTvl: tvlData.total }));
    };

    const handleVolumeUpdate = (data: unknown) => {
      const volumeData = data as VolumeData;
      setData(prev => ({ ...prev, volume24h: volumeData.total }));
    };

    // Import and use real-time data service
    import('@/lib/solana').then(({ realTimeDataService }) => {
      realTimeDataService.subscribe('prices', handlePriceUpdate);
      realTimeDataService.subscribe('tvl', handleTVLUpdate);
      realTimeDataService.subscribe('volume', handleVolumeUpdate);
    });

    // Cleanup subscription
    return () => {
      import('@/lib/solana').then(({ realTimeDataService }) => {
        realTimeDataService.unsubscribe('prices', handlePriceUpdate);
        realTimeDataService.unsubscribe('tvl', handleTVLUpdate);
        realTimeDataService.unsubscribe('volume', handleVolumeUpdate);
      });
    };
  }, []);

  return data;
};

// ==================== RIFT OPERATIONS HOOKS ====================

export const useRiftOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(async (riftId: string, amount: number) => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.wrapTokens(riftId, amount);
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Deposit failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deposit failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const withdraw = useCallback(async (riftId: string, amount: number) => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.unwrapTokens(riftId, amount);
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Withdrawal failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Withdrawal failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const claimRewards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.claimRiftsRewards();
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Claim failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Claim failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const wrap = useCallback(async (riftId: string, amount: number) => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.wrapTokens(riftId, amount);
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Wrap failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Wrap failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const unwrap = useCallback(async (riftId: string, rTokenAmount: number) => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.unwrapTokens(riftId, rTokenAmount);
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Unwrap failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unwrap failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const createRift = useCallback(async (params: {
    tokenAddress: string;
    tokenSymbol: string;
    burnFee: number;
    partnerFee: number;
    partnerWallet?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await riftProtocolService.createRift(params);
      
      if (result.success) {
        return { success: true, signature: result.signature };
      } else {
        setError(result.error || 'Rift creation failed');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rift creation failed';
      setError(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deposit,
    withdraw,
    wrap,
    unwrap,
    claimRewards,
    createRift,
    loading,
    error,
    clearError: () => setError(null)
  };
};

// ==================== TRANSACTION TOAST NOTIFICATIONS ====================

export const useTransactionToast = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'pending';
    message: string;
    signature?: string;
  }>>([]);

  const addToast = useCallback((toast: Omit<typeof toasts[0], 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notifyTransaction = useCallback((
    type: 'pending' | 'success' | 'error',
    message: string,
    signature?: string
  ) => {
    return addToast({ type, message, signature });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    notifyTransaction
  };
};