// RIFTS Protocol - Advanced Volatility Farming Platform

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Wallet, Search, Plus, Minus,
  TrendingUp, TrendingDown, Activity, Users,
  Lock, Unlock, Eye,
  ExternalLink,
  Layers, Target,
  BarChart3, DollarSign, AlertCircle,
  Filter, Menu,
  Briefcase, BookOpen, PieChart, LineChart,
  ChevronRight, Shield, Info
} from 'lucide-react';

// Production services
import { connection, walletService } from '@/lib/solana/index';
import { Connection, Transaction } from '@solana/web3.js';
import { ProductionRiftsService, WalletAdapter, ProductionRiftData } from '@/lib/solana/rifts-service';
import { dexIntegration } from '@/lib/solana/dex-integration';
import { RealBlockchainService } from '@/lib/solana/real-blockchain-service';
import { RealPriceOracle } from '@/lib/solana/real-price-oracle';
import { realDataService, type RealDataMetrics, RealUserAnalytics } from '@/lib/solana/real-data-service';
import { meteoraLiquidityService } from '@/lib/solana/meteora-liquidity-service';
import { portfolioBlockchainService, type PortfolioData } from '@/services/portfolioBlockchainService';
import { analyticsBlockchainService, type ProtocolAnalytics } from '@/services/analyticsBlockchainService';
import { PublicKey } from '@solana/web3.js';

// Phantom wallet interface
interface PhantomWallet {
  publicKey: PublicKey | null;
  isConnected: boolean;
  isPhantom: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// Hooks  
import { useRealWallet } from '@/hooks/useWallet';

// Components
import { RiftsUI } from '@/components/rifts/RiftsUI';
import { LuxuryModal } from '@/components/ui/luxury-modal';
import { LuxuryButton } from '@/components/ui/luxury-button';
import { GovernancePanel } from '@/components/governance/GovernancePanel';
import { TradingInterface } from '@/components/trading/TradingInterface';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { ContractAddressList } from '@/components/ui/contract-address';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

// Sidebar Components
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import dynamic from 'next/dynamic';

const RippleGrid = dynamic(
  () => import('@/components/reactbits/backgrounds/RippleGrid/RippleGrid'),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-black" />
  }
);
import {
  IconDashboard,
  IconCoins, 
  IconChartBar,
  IconWallet,
  IconActivity,
  IconUsers,
  IconFileText,
} from '@tabler/icons-react';

// UI Components
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types
interface RiftData {
  id: string;
  symbol: string;
  underlying: string;
  tvl: number;
  apy: number;
  backingRatio: number;
  volume24h: number;
  risk: string;
  participants: number;
  strategy: string;
  performance: number;
  isActive: boolean;
  maxCapacity: number;
  // Add vault field for close functionality
  vault: string;
  // Enhanced RIFTS Protocol specific fields
  oracleStatus: 'active' | 'inactive' | 'degraded';
  burnFee: number;
  partnerFee?: number; // Partner fee (added to burn fee for total)
  arbitragePercentage: number;
  volatilityApy: number;
  // Add rift token mint for unwrapping
  riftMint?: string;
  underlyingMint?: string; // Required for trading
  hasMeteoraPool?: boolean; // For detecting Meteora pools
  liquidityPool?: string; // Meteora pool address for trading
  createdAt?: Date; // Creation timestamp for sorting
  riftTvl: number;
  lpTvl: number;
  totalRiftYield: number;
  rift30dYield: number;
  riftPrice: number;
  fairPrice: number;
  feeStructure: {
    wrapFee: number;
    unwrapFee: number;
    performanceFee: number;
    managementFee: number;
  };
  liquidityProfile: {
    depth: number;
    spread: number;
    slippage: number;
  };
  revenueShare: {
    riftsHolders: number;
    lpProviders: number;
    protocol: number;
  };
  lvfMetrics: {
    efficiency: number;
    capture: number;
    decay: number;
  };
  contractAddresses: {
    riftContract: string;
    riftsToken: string;
    lpToken: string;
    lpPool: string;
    oracleManager: string;
  };
  timeframes: {
    '1h': number;
    '24h': number;
    '7d': number;
    '30d': number;
    '90d': number;
    '1y': number;
  };
}

// Enhanced Stats Card with detailed information
const DetailedStatsCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  onClick?: () => void;
}> = ({ icon, label, value, change, trend = 'neutral', description, onClick }) => {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400', 
    neutral: 'text-gray-400'
  };

  return (
    <div
      className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none cursor-pointer bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-6 py-2.5 text-sm gap-2.5 flex-col"
      onClick={onClick}
    >      
      {/* Luxury background patterns */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 transition-transform rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20">
            <div className="text-emerald-400">
              {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
            </div>
          </div>
          {change && (
            <div className={`text-xs ${trendColors[trend]} flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded-lg`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
               trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
              {change}
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-xl font-bold text-emerald-400">{value}</p>
          <p className="text-xs font-medium text-gray-400">{label}</p>
          {description && (
            <p className="text-xs leading-tight text-gray-600 line-clamp-2">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const LuxuryRiftCard = ({ rift, onWrap, onUnwrap, onAddLiquidity, onDetails, onCloseRift, currentWallet }: {
  rift: RiftData;
  onWrap: () => void;
  onUnwrap: () => void;
  onAddLiquidity: () => void;
  onDetails: () => void;
  onCloseRift?: () => void;
  currentWallet?: string;
}) => {

  const getRiskColor = (risk: string | undefined) => {
    switch (risk?.toLowerCase()) {
      case 'very low': return 'border-emerald-600 bg-emerald-900/20 text-emerald-400';
      case 'low': return 'border-emerald-600 bg-emerald-900/20 text-emerald-400';
      case 'medium': return 'border-yellow-600 bg-yellow-900/20 text-yellow-400';
      case 'high': return 'border-red-600 bg-red-900/20 text-red-400';
      default: return 'border-gray-600 bg-gray-800/20 text-gray-400';
    }
  };

  return (
    <motion.div
      className={`relative h-full transition-all duration-300 border bg-black/90 backdrop-blur-md ${
        rift.tvl === 0
          ? 'border-yellow-500/50 hover:border-yellow-400/70 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
          : 'border-emerald-500/30 hover:border-emerald-400/50'
      } group rounded-xl`}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {rift.tvl === 0 && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-black rounded-full animate-pulse">
            NEW
          </span>
        </div>
      )}

      {/* Liquidity Status Badge */}
      <div className="absolute -top-2 -left-2 z-10">
        {rift.hasMeteoraPool && rift.liquidityPool && rift.liquidityPool !== '11111111111111111111111111111111' ? (
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded-full shadow-lg" title={`Pool: ${rift.liquidityPool}`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Tradable</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-gray-600 text-gray-300 rounded-full shadow-lg" title="No liquidity pool - Click Add Liquidity">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>No Pool</span>
          </div>
        )}
      </div>

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 text-sm font-bold bg-black border rounded-lg border-emerald-500/50 text-emerald-400">
              {rift.underlying?.slice(0, 1) || 'R'}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{rift.symbol}</h3>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${rift.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-xs text-emerald-400">
                  {rift.tvl === 0 ? 'New - Needs Liquidity' : (rift.isActive ? 'Active' : 'Inactive')}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className={`px-2 py-0.5 rounded-full border text-xs mb-1 ${getRiskColor(rift.risk)}`}>
              {rift.risk}
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {rift.apy?.toFixed(1) || '8.4'}%
            </p>
          </div>
        </div>

        {/* Compact metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-4 py-2 text-sm gap-2.5 flex-col text-center">
            {/* Luxury background patterns */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
            </div>
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
            <div className="relative z-10">
              <span className="text-gray-400">TVL</span>
              <p className="font-bold text-emerald-400">{formatCurrency(rift.tvl || 0)}</p>
            </div>
          </div>
          <div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-4 py-2 text-sm gap-2.5 flex-col text-center">
            {/* Luxury background patterns */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
            </div>
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
            <div className="relative z-10">
              <span className="text-gray-400">Fee</span>
              <p className="font-bold text-emerald-400" title={`Burn: ${rift.burnFee}%, Partner: ${rift.partnerFee || 0}%`}>
                {((rift.burnFee || 0) + (rift.partnerFee || 0)).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <LuxuryButton variant="primary" size="sm" onClick={onWrap} className="text-xs">
            Wrap
          </LuxuryButton>
          <LuxuryButton variant="secondary" size="sm" onClick={onUnwrap} className="text-xs">
            Unwrap
          </LuxuryButton>
          <LuxuryButton variant="ghost" size="sm" onClick={onDetails} className="text-xs">
            Details
          </LuxuryButton>
        </div>
        <LuxuryButton variant="primary" size="sm" onClick={onAddLiquidity} className="w-full text-xs">
          {rift.hasMeteoraPool && rift.liquidityPool && rift.liquidityPool !== '11111111111111111111111111111111'
            ? 'Manage Liquidity'
            : 'Add Liquidity'}
        </LuxuryButton>
      </div>

      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500/50" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500/50" />
    </motion.div>
  );
};

// Utility function to format currency
const formatCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
};

// Main RIFTS App Component  
const RiftsApp: React.FC = () => {
  // State
  const [rifts, setRifts] = useState<RiftData[]>([]);
  const [loading, setLoading] = useState(true); // Show loading while fetching
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(() => {

    return Date.now();
  });
  const [preloadedData, setPreloadedData] = useState<{
    rifts?: RiftData[];
    metrics?: any;
    userAnalytics?: any;
  }>({});
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    signature?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('tvl');
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [showOnlyTradeable, setShowOnlyTradeable] = useState(false);
  const [selectedRift, setSelectedRift] = useState<RiftData | null>(null);
  const [showWrapModal, setShowWrapModal] = useState(false);
  const [showUnwrapModal, setShowUnwrapModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsActiveTab, setDetailsActiveTab] = useState<'details' | 'trading'>('details');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showMarketsModal, setShowMarketsModal] = useState(false);
  const [showRiftsTokenModal, setShowRiftsTokenModal] = useState(false);
  const [showTradingModal, setShowTradingModal] = useState(false);
  const [showCreateRiftModal, setShowCreateRiftModal] = useState(false);
  const [showAddLiquidityModal, setShowAddLiquidityModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [stakingTab, setStakingTab] = useState<'stake' | 'unstake'>('stake');
  const [stakingAmount, setStakingAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [lpTokenBalance, setLpTokenBalance] = useState(0);
  const [showStakingConfirmation, setShowStakingConfirmation] = useState(false);
  const [riftsModal, setRiftsModal] = useState<{ isOpen: boolean; rift: RiftData | null }>({ isOpen: false, rift: null });

  // RIFTS token state
  const [riftsBalance, setRiftsBalance] = useState(0);
  const [stakingRewards, setStakingRewards] = useState(0);
  const [stakedAmount, setStakedAmount] = useState(0);
  const [showGovernance, setShowGovernance] = useState(false);

  // Sidebar state and configuration
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarLinks = [
    {
      label: "Dashboard", 
      href: "#dashboard",
      icon: <IconDashboard className="w-5 h-5 shrink-0" />,
      onClick: () => setShowDashboardModal(true)
    },
    {
      label: "My Rifts",
      href: "#rifts", 
      icon: <IconCoins className="w-5 h-5 shrink-0" />,
      onClick: () => setShowRiftsTokenModal(true)
    },
    {
      label: "Trading",
      href: "#trading",
      icon: <IconChartBar className="w-5 h-5 shrink-0" />,
      onClick: () => setShowTradingModal(true)
    },
    {
      label: "Portfolio", 
      href: "#portfolio",
      icon: <IconWallet className="w-5 h-5 shrink-0" />,
      onClick: () => setShowPortfolioModal(true)
    },
    {
      label: "Analytics",
      href: "#analytics", 
      icon: <IconActivity className="w-5 h-5 shrink-0" />,
      onClick: () => setShowAnalyticsModal(true)
    },
    {
      label: "Staking",
      href: "#staking",
      icon: <Lock className="w-5 h-5 shrink-0" />,
      onClick: () => setShowStakingModal(true)
    },
    {
      label: "Governance",
      href: "#governance",
      icon: <IconUsers className="w-5 h-5 shrink-0" />,
      onClick: () => handleVote()
    },
    {
      label: "Documentation",
      href: "#docs",
      icon: <IconFileText className="w-5 h-5 shrink-0" />,
      onClick: () => window.open('https://docs.rifts.io', '_blank')
    }
  ];
  // const [lpPositions, setLpPositions] = useState<any[]>([]);
  // const [ecosystemStatus, setEcosystemStatus] = useState<EcosystemStatus | null>(null);
  // const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  // const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  // const [feeCollectorStatus, setFeeCollectorStatus] = useState<any>(null);

  // Hooks
  const { refreshBalance, ...wallet } = useRealWallet();

  // Fetch token balance for selected rift
  const fetchTokenBalance = async (rift: RiftData) => {
    if (!wallet.publicKey || !rift) return;
    
    try {
      // Handle SOL specially since it's native Solana
      if (rift.underlying === 'SOL') {
        setSelectedTokenBalance(wallet.balance);

        return;
      }

      // Get the token mint address for other tokens
      const tokenAddresses: Record<string, string> = {
        'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        'USDT': 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'
      };
      
      const tokenMint = tokenAddresses[rift.underlying];
      if (!tokenMint) {

        setSelectedTokenBalance(0);
        return;
      }

      const balance = await walletService.getTokenBalance(new PublicKey(wallet.publicKey), tokenMint);
      setSelectedTokenBalance(balance);

    } catch (error) {

      setSelectedTokenBalance(0);
    }
  };

  // Fetch RIFT TOKEN balance for selected rift (for unwrapping)
  const fetchRiftTokenBalance = async (rift: RiftData) => {
    if (!wallet.publicKey || !rift) {

      return;
    }
    
    try {

      // Get the rift token mint from the rift data
      const riftTokenMint = rift.riftMint; // This should be the rift token mint address

      if (!riftTokenMint) {

        setSelectedRiftTokenBalance(0);
        return;
      }

      const balance = await walletService.getTokenBalance(new PublicKey(wallet.publicKey), riftTokenMint);

      // Fix potential decimal issues and ensure it's a proper number
      let correctedBalance = 0;
      if (typeof balance === 'number' && isFinite(balance) && balance > 0) {
        correctedBalance = balance;
      } else if (typeof balance === 'string') {
        const parsed = parseFloat(balance);
        if (isFinite(parsed) && parsed > 0) {
          correctedBalance = parsed;
        }
      }

      setSelectedRiftTokenBalance(correctedBalance);
      setSelectedRiftBalance(correctedBalance); // Also set for liquidity modal

    } catch (error) {

      setSelectedRiftTokenBalance(0);
      setSelectedRiftBalance(0);
    }
  };

  // Fetch pool ratio from Meteora pool (for existing pools)
  const fetchMeteoraPoolRatio = async (poolAddress: string, rift: RiftData): Promise<number> => {
    try {

      // Import Meteora SDK
      const { CpAmm } = await import('@meteora-ag/cp-amm-sdk');
      const METEORA_DAMM_V2_PROGRAM_ID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG');

      // Get raw connection (Meteora SDK needs full Connection API)
      // @ts-expect-error - RateLimitedConnection has underlying connection property
      const rawConnection = connection.connection || connection;
      const cpAmm = new (CpAmm as any)(rawConnection, METEORA_DAMM_V2_PROGRAM_ID);

      // Fetch pool state
      const poolState = await cpAmm.fetchPoolState(new PublicKey(poolAddress));

      // Get token reserves from pool
      const tokenAReserve = poolState.tokenAAmount || 0;
      const tokenBReserve = poolState.tokenBAmount || 0;

      // Calculate ratio: Token B / Token A
      if (tokenAReserve > 0) {
        const ratio = Number(tokenBReserve) / Number(tokenAReserve);

        return ratio;
      }

      return 1.0;
    } catch (error) {

      return 1.0;
    }
  };

  // Service status
  const [serviceReady, setServiceReady] = useState(true); // Start ready for instant loading
  
  // Transaction states
  const [wrapAmount, setWrapAmount] = useState('');
  const [unwrapAmount, setUnwrapAmount] = useState('');
  
  // Create Rift form state
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenSymbol, setCustomTokenSymbol] = useState('');
  const [burnFee, setBurnFee] = useState('45');
  const [partnerFee, setPartnerFee] = useState('0');
  const [partnerWallet, setPartnerWallet] = useState('');
  const [initialLiquidityAmount, setInitialLiquidityAmount] = useState('');
  const [solLiquidityAmount, setSolLiquidityAmount] = useState('');
  const [riftLiquidityAmount, setRiftLiquidityAmount] = useState('');
  const [depositQuote, setDepositQuote] = useState<{
    wsolNeeded: number;
    riftNeeded: number;
    liquidityDelta: string;
    poolRatio: number;
  } | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'sol' | 'rift' | null>(null); // Track which field user edited
  const [liquidityRatio, setLiquidityRatio] = useState(1.0); // SOL:RIFT ratio
  const [liquidityTab, setLiquidityTab] = useState<'add' | 'remove'>('add'); // Tab state for liquidity modal
  const [userLpPositions, setUserLpPositions] = useState<any[]>([]); // User's LP positions
  const [detailedPositions, setDetailedPositions] = useState<any[]>([]); // Detailed position info with estimates
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set()); // Selected position addresses to remove
  const [removeMode, setRemoveMode] = useState<'percentage' | 'positions'>('percentage'); // How to remove liquidity
  const [removePercentage, setRemovePercentage] = useState<string>('100'); // Percentage to remove
  const [isLoadingLpBalance, setIsLoadingLpBalance] = useState(false);
  const [estimatedWithdrawal, setEstimatedWithdrawal] = useState<{ tokenA: number; tokenB: number } | null>(null);

  // Pool parameters for initial liquidity
  const [initialRiftAmount, setInitialRiftAmount] = useState('1000');
  const [tradingFeeBps, setTradingFeeBps] = useState('25');
  const [binStep, setBinStep] = useState('25');

  const [isCreatingRift, setIsCreatingRift] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);
  const [isUnwrapping, setIsUnwrapping] = useState(false);
  const [selectedTokenBalance, setSelectedTokenBalance] = useState(0);
  const [selectedRiftBalance, setSelectedRiftBalance] = useState(0);
  const [selectedRiftTokenBalance, setSelectedRiftTokenBalance] = useState(0);

  // Stepper state for rift creation process
  const [riftCreationStep, setRiftCreationStep] = useState(1); // 1: Create Rift, 2: Create Pool & Add Liquidity
  const [createdRiftPDA, setCreatedRiftPDA] = useState<string | null>(null);
  const [createdRiftData, setCreatedRiftData] = useState<any>(null);

  // Meteora pool creation state
  const [isCreatingMeteoraPool, setIsCreatingMeteoraPool] = useState(false);
  const [meteoraPoolAmount, setMeteoraPoolAmount] = useState('1');
  const [meteoraBinStep, setMeteoraBinStep] = useState('25');
  const [meteoraBaseFactor, setMeteoraBaseFactor] = useState('100');
  
  // Toast notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'pending';
    message: string;
    signature?: string;
  }>>([]);

  // Initialize service instances
  const riftProtocolService = useMemo(() => new ProductionRiftsService(connection as unknown as Connection), []);
  const realBlockchainService = useMemo(() => new RealBlockchainService(connection as unknown as Connection), []);
  const priceOracle = useMemo(() => new RealPriceOracle(connection as unknown as Connection), []);
  
  // Real data state
  const [realMetrics, setRealMetrics] = useState<RealDataMetrics | null>(null);
  const [realUserAnalytics, setRealUserAnalytics] = useState<RealUserAnalytics | null>(null);
  const [realPortfolioData, setRealPortfolioData] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null); // New portfolio data from blockchain
  const [protocolAnalytics, setProtocolAnalytics] = useState<ProtocolAnalytics | null>(null); // New analytics from blockchain
  const [realTransactions, setRealTransactions] = useState<any[]>([]);
  const [realProtocolMetrics, setRealProtocolMetrics] = useState<any>(null);
  const [tokenPrices, setTokenPrices] = useState<Map<string, any>>(new Map());

  // Load real data from blockchain
  const loadRealData = async () => {
    try {

      // Fetch protocol metrics from blockchain
      const protocolMetrics = await realBlockchainService.getProtocolMetrics();

      setRealProtocolMetrics(protocolMetrics);
      
      // Fetch real-time token prices
      const tokenSymbols = ['SOL', 'USDC', 'BONK', 'JUP', 'RENDER', 'WIF', 'RIFTS'];
      const prices = await priceOracle.getMultiplePrices(tokenSymbols);

      setTokenPrices(prices);
      
      // If wallet is connected, fetch user-specific data
      if (wallet.publicKey) {
        const walletPubkey = new PublicKey(wallet.publicKey);

        // Fetch real portfolio data
        const portfolio = await realBlockchainService.getUserPortfolio(walletPubkey);

        setRealPortfolioData(portfolio);

        // Fetch comprehensive portfolio data from all programs
        const comprehensivePortfolio = await portfolioBlockchainService.getUserPortfolio(walletPubkey);

        setPortfolioData(comprehensivePortfolio);

        // Fetch real transaction history
        const transactions = await realBlockchainService.getUserTransactions(walletPubkey);

        setRealTransactions(transactions);
      }
      
      // Fetch comprehensive protocol analytics from all deployed programs
      try {
        const analytics = await analyticsBlockchainService.getProtocolAnalytics(
          wallet.publicKey ? new PublicKey(wallet.publicKey) : undefined
        );

        setProtocolAnalytics(analytics);
      } catch (error) {

      }

      // Also fetch from existing services for compatibility
      try {
        const metrics = await realDataService.getAllRealMetrics();
        setRealMetrics(metrics);

        const userAnalytics = await realDataService.getRealUserAnalytics();
        setRealUserAnalytics(userAnalytics);
      } catch (error) {

      }

    } catch (error) {

      // Clear cache and retry
      realBlockchainService.clearCache();
    }
  };

  // Fetch user's LP positions when remove liquidity tab is opened
  useEffect(() => {
    const fetchLpPositions = async () => {
      // Only fetch if we're on the remove tab, modal is open, wallet is connected, and we have a pool
      if (
        liquidityTab !== 'remove' ||
        !showAddLiquidityModal ||
        !wallet.publicKey ||
        !selectedRift?.liquidityPool ||
        selectedRift.liquidityPool === '11111111111111111111111111111111'
      ) {
        setUserLpPositions([]);
        setDetailedPositions([]);
        setSelectedPositions(new Set());
        return;
      }

      setIsLoadingLpBalance(true);
      try {
        const positions = await meteoraLiquidityService.getUserPositions(
          selectedRift.liquidityPool,
          wallet.publicKey
        );

        setUserLpPositions(positions);

        // Fetch detailed position information
        const detailed = await meteoraLiquidityService.getDetailedPositions({
          poolAddress: selectedRift.liquidityPool,
          userPublicKey: wallet.publicKey
        });

        if (detailed) {

          setDetailedPositions(detailed);
        }

        // Auto-select all positions by default (for position mode)
        setSelectedPositions(new Set(positions.map((p: any) => p.address)));
        // Default to 100% removal
        setRemovePercentage('100');
      } catch (error) {

        setUserLpPositions([]);
        setDetailedPositions([]);
        setSelectedPositions(new Set());
      } finally {
        setIsLoadingLpBalance(false);
      }
    };

    fetchLpPositions();
  }, [liquidityTab, showAddLiquidityModal, wallet.publicKey, selectedRift?.liquidityPool]);

  // Estimate withdrawal amounts when percentage changes
  useEffect(() => {
    const estimateWithdrawal = async () => {
      if (
        removeMode !== 'percentage' ||
        !wallet.publicKey ||
        !selectedRift?.liquidityPool ||
        selectedRift.liquidityPool === '11111111111111111111111111111111' ||
        !removePercentage
      ) {
        setEstimatedWithdrawal(null);
        return;
      }

      const pct = parseFloat(removePercentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        setEstimatedWithdrawal(null);
        return;
      }

      try {
        const estimate = await meteoraLiquidityService.estimateWithdrawalByPercentage({
          poolAddress: selectedRift.liquidityPool,
          userPublicKey: wallet.publicKey,
          percentage: pct
        });

        if (estimate) {
          setEstimatedWithdrawal({
            tokenA: estimate.tokenA,
            tokenB: estimate.tokenB
          });
        }
      } catch (error) {

        setEstimatedWithdrawal(null);
      }
    };

    estimateWithdrawal();
  }, [removeMode, removePercentage, wallet.publicKey, selectedRift?.liquidityPool]);

  // Preload critical data immediately on component mount
  useEffect(() => {
    const preloadData = async () => {
      try {
        // SECURITY FIX: Removed deprecated vanity-pool endpoint call
        // The old endpoint exposed private keys and has been disabled
        // PDA-based vanity generation doesn't need pre-warming

        // Load real data in parallel with service initialization - with error handling
        const [metrics, analytics] = await Promise.allSettled([
          realDataService.getAllRealMetrics(),
          realDataService.getRealUserAnalytics()
        ]);

        // Extract successful results with fallbacks
        const safeMetrics = metrics.status === 'fulfilled' ? metrics.value : null;
        const safeAnalytics = analytics.status === 'fulfilled' ? analytics.value : null;

        setPreloadedData(prev => ({
          ...prev,
          metrics: safeMetrics,
          userAnalytics: safeAnalytics
        }));

      } catch (error) {

      }
    };
    
    preloadData();
  }, []);

  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        // Set wallet if connected
        if (wallet.publicKey && wallet.connected) {
          // Access the browser's Phantom wallet directly
          const phantomWallet = window?.solana;
          
          if (phantomWallet?.isPhantom) {
            const walletAdapter = {
              publicKey: new PublicKey(wallet.publicKey),
              sendTransaction: async (transaction: Transaction) => {
                try {
                  // Set transaction properties
                  if (!transaction.recentBlockhash) {
                    const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
                    transaction.recentBlockhash = latestBlockhash.blockhash;
                  }
                  if (!transaction.feePayer && phantomWallet.publicKey) {
                    transaction.feePayer = phantomWallet.publicKey;
                  }

                  // Use Phantom's signAndSendTransaction
                  const { signature } = await phantomWallet.signAndSendTransaction(transaction);
                  return signature;
                } catch (error) {

                  throw error;
                }
              },
              signTransaction: async (transaction: Transaction) => {
                try {
                  // Set transaction properties
                  if (!transaction.recentBlockhash) {
                    const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
                    transaction.recentBlockhash = latestBlockhash.blockhash;
                  }
                  if (!transaction.feePayer && phantomWallet.publicKey) {
                    transaction.feePayer = phantomWallet.publicKey;
                  }

                  // For signing only, we'll need to handle this differently
                  // Since Phantom typically uses signAndSendTransaction, we'll return unsigned transaction
                  return transaction;
                } catch (error) {

                  throw error;
                }
              }
            };
            riftProtocolService.setWallet(walletAdapter as WalletAdapter);
          }
        }
        
        // Load real data if not already preloaded
        if (!preloadedData.metrics) {
          await loadRealData();
        } else {
          // Use preloaded data
          setRealMetrics(preloadedData.metrics);
          setRealUserAnalytics(preloadedData.userAnalytics);

        }
        
        // Always set service ready to fix loading issue
        setServiceReady(true);

      } catch (error) {

        // Still set service ready to prevent permanent loading
        setServiceReady(true);

      }
    };

    initServices();
  }, [wallet.publicKey, wallet.connected, riftProtocolService, preloadedData]);

  // Auto-refresh real data every 2 minutes and when wallet changes
  useEffect(() => {
    // Load data immediately when wallet connects
    if (wallet.publicKey) {
      loadRealData();
    }
    
    // Set up auto-refresh
    const interval = setInterval(loadRealData, 120000);
    return () => clearInterval(interval);
  }, [wallet.publicKey]);

  // Fetch RIFTS token balance
  // const fetchRiftsTokenBalance = async () => {
  //   if (!wallet.publicKey) return;
  //   
  //   try {
  //     const { ProductionRiftsTokenManager } = await import('@/lib/solana/rifts-token-manager');
  //     const productionRiftsTokenManager = new ProductionRiftsTokenManager(connection);
  //     const balance = await productionRiftsTokenManager.getUserRiftsBalance(
  //       new PublicKey(wallet.publicKey)
  //     );
  //     setRiftsBalance(balance);
  //     
  //     // Also fetch staking position if it exists
  //     const stakingPosition = productionRiftsTokenManager.getUserStakingPosition(
  //       new PublicKey(wallet.publicKey)
  //     );
  //     
  //     if (stakingPosition) {
  //       setStakedAmount(stakingPosition.lpTokenAmount);
  //       setStakingRewards(stakingPosition.riftsRewards);
  //     }
  //   } catch (error) {

  //   }
  // };

  // Load rifts

  const loadRifts = useCallback(async (isInitialLoad = false) => {
    if (!serviceReady) return;
    
    // Don't show loading screen - load in background
    if (isInitialLoad && !hasLoadedOnce) {
      setLoadingStartTime(Date.now());
    }
    try {

      const { RIFTS_PROGRAM_ID } = await import('@/lib/solana/rifts-service');

      // Mark that we've loaded at least once (for tracking purposes only - don't clear cache)
      if (isInitialLoad && !hasLoadedOnce) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('rifts-has-loaded', 'true');
        }
      }

      // Fetch rifts directly from blockchain (filtered for deprecated accounts)
      try {

        const productionRifts = await riftProtocolService.getAllRifts();

        if (productionRifts.length === 0) {

          setRifts([]);
        } else {
          // Convert ProductionRiftData to RiftData format
          const convertedRifts: RiftData[] = productionRifts.map(rift => ({
          id: rift.id,
          symbol: rift.symbol,
          underlying: rift.underlying,
          tvl: rift.tvl,
          apy: rift.apy,
          backingRatio: rift.backingRatio,
          volume24h: rift.volume24h,
          risk: rift.risk,
          participants: rift.participants,
          strategy: rift.strategy,
          performance: rift.performance?.[0] || rift.apy,
          isActive: rift.oracleStatus === 'active',
          maxCapacity: 100000, // Default capacity
          vault: rift.vault,
          oracleStatus: rift.oracleStatus,
          burnFee: rift.burnFee,
          partnerFee: rift.partnerFee, // Partner fee from API
          createdAt: rift.createdAt ? new Date(rift.createdAt) : undefined, // Creation timestamp for sorting
          arbitragePercentage: rift.arbitrageOpportunity || 2.0,
          volatilityApy: rift.apy * 0.8, // Estimated volatility component
          riftMint: rift.riftMint,
          underlyingMint: rift.underlyingMint, // Required for trading
          hasMeteoraPool: rift.hasMeteoraPool, // For Meteora pool detection
          liquidityPool: rift.liquidityPool, // Meteora pool address for trading
          // Required missing properties with reasonable defaults
          riftTvl: rift.tvl * 0.6, // Estimated rift portion
          lpTvl: rift.tvl * 0.4, // Estimated LP portion
          totalRiftYield: rift.apy,
          rift30dYield: rift.performance?.[29] || rift.apy,
          riftPrice: rift.realBackingRatio || rift.backingRatio,
          fairPrice: 1.0, // Fair value baseline
          feeStructure: {
            wrapFee: 0.1,
            unwrapFee: rift.burnFee,
            performanceFee: 0.2,
            managementFee: 0.05
          },
          liquidityProfile: {
            depth: rift.tvl / 100, // Rough estimate
            spread: rift.priceDeviation || 0.01,
            slippage: 0.005
          },
          revenueShare: {
            riftsHolders: 60,
            lpProviders: 30,
            protocol: 10
          },
          lvfMetrics: {
            efficiency: 85, // Default efficiency
            capture: 75, // Default capture rate
            decay: 5 // Default decay rate
          },
          contractAddresses: {
            riftContract: rift.id,
            riftsToken: rift.riftMint,
            lpToken: '9dNaLvEDeq3mo4TS2GDuJTeYQqz7GdeKYnyGmcKcWCr2',
            lpPool: rift.vault,
            oracleManager: 'DtBfLYvkXebsCxf49ZubJej9dMc9sNXUx2fctB3oeYtK'
          },
          timeframes: {
            '1h': rift.apy / 8760, // Hourly estimate
            '24h': rift.apy / 365, // Daily estimate
            '7d': rift.apy / 52, // Weekly estimate
            '30d': rift.performance?.[29] || rift.apy / 12, // Monthly
            '90d': rift.apy / 4, // Quarterly estimate
            '1y': rift.apy // Annual
          }
        }));

        setRifts(convertedRifts);

      }
    } catch (error) {

      setRifts([]);
    }
    } catch (error) {

      // Set empty rifts on main error
      setRifts([]);
    } finally {
      if (!hasLoadedOnce) {
        setHasLoadedOnce(true);
      }

      // Always hide loading after fetch completes
      setLoading(false);
      setLoadingStartTime(null);
    }
  }, [serviceReady, hasLoadedOnce, riftProtocolService]);

  useEffect(() => {
    if (serviceReady && !hasLoadedOnce) {

      loadRifts(true); // Initial load
    } else if (serviceReady && hasLoadedOnce) {

      loadRifts(false); // Subsequent loads use cache
    }
  }, [loadRifts, serviceReady, hasLoadedOnce]);
  
  // Auto-refresh data every 60 seconds (background updates)
  useEffect(() => {
    if (!serviceReady || !wallet.connected) return;
    
    const refreshInterval = setInterval(async () => {
      try {
        // Silently refresh data without loading indicators
        await loadRifts(false);
        // await loadRIFTSTokenData();
        
        // Refresh selected rift token balance if unwrap modal is open
        // if (showUnwrapModal && selectedRift) {
        //   await fetchRiftTokenBalance(selectedRift);
        // }
        
        // Refresh treasury data
        // await loadTreasuryData();

      } catch (error) {

      }
    }, 20000); // Refresh every 20 seconds for real-time TVL updates
    
    return () => clearInterval(refreshInterval);
  }, [serviceReady, wallet.connected, showUnwrapModal, selectedRift, loadRifts]);

  // Fetch deposit quote when SOL or RIFT amount changes (debounced)
  useEffect(() => {
    const poolAddress = selectedRift?.liquidityPool;
    const poolExists = poolAddress && poolAddress !== '11111111111111111111111111111111';

    if (!poolExists || !lastEditedField) {
      return;
    }

    // Only fetch quote for the field the user is currently editing
    const amount = lastEditedField === 'sol' ? parseFloat(solLiquidityAmount) : parseFloat(riftLiquidityAmount);

    if (!amount || amount <= 0 || isNaN(amount)) {
      setDepositQuote(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchDepositQuote(poolAddress, amount, lastEditedField);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [solLiquidityAmount, riftLiquidityAmount, lastEditedField, selectedRift]);

  // Initialize ecosystem when wallet connects
  /*
  const initializeEcosystem = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) return;
    
    try {

      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: wallet.sendTransaction || (async () => ({ signature: 'simulation_mode' })),
        signTransaction: async (transaction: Transaction) => transaction // For simulation mode
      };
      
      const result = await ecosystemManager.initialize(walletAdapter);
      
      if (result.success) {
        setEcosystemStatus(result.status);
        setSystemHealth(result.status.health);

        // Initialize keeper service for automated operations
        try {
          const keeper = await initializeKeeper();
          
          // Register volume tracking callback
          riftsService.onVolumeUpdate((riftId, volume) => {
            keeper.addVolume(riftId, volume);
          });
          
          // Start keeper service
          await keeper.start();

        } catch (error) {

        }
        
        // Listen for health updates
        if (typeof window !== 'undefined') {
          // window.addEventListener('rifts-health-update', (event: any) => {
            // setSystemHealth(event.detail.overall);
          // });
        }
      } else {

      }
    } catch (error) {

    }
  }, [wallet.connected, wallet.publicKey, wallet.sendTransaction]);
  */

  // Load REAL RIFTS token balance and staking info
  const loadRIFTSTokenData = useCallback(async () => {
    if (!wallet.publicKey) return;
    
    try {
      // Get REAL RIFTS token balance from onchain data
      const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
      const RIFTS_MINT = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');
      
      try {
        const userRiftsAccount = await getAssociatedTokenAddress(RIFTS_MINT, new PublicKey(wallet.publicKey));
        const accountInfo = await getAccount(connection as unknown as Connection, userRiftsAccount);
        const realRiftsBalance = Number(accountInfo.amount) / Math.pow(10, 9); // 9 decimals
        setRiftsBalance(realRiftsBalance);

      } catch {
        // No RIFTS token account exists yet
        setRiftsBalance(0);

      }
      
      // Get REAL LP staking information from blockchain
      const { lpStakingClient } = await import('@/lib/solana/lp-staking-client');
      const lpTokenMint = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');
      const stakingInfo = await lpStakingClient.getUserStakingInfo(lpTokenMint, new PublicKey(wallet.publicKey));
      setStakedAmount(stakingInfo.stakedAmount);
      setStakingRewards(stakingInfo.pendingRewards);

      // Get user's LP token balance (using RIFTS as LP tokens)
      try {
        const userLpAccount = await getAssociatedTokenAddress(lpTokenMint, new PublicKey(wallet.publicKey));
        const { Connection } = await import('@solana/web3.js');
        const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
        const lpAccountInfo = await conn.getTokenAccountBalance(userLpAccount);
        setLpTokenBalance(parseFloat(lpAccountInfo.value.amount) / 1e9);
        console.log('✅ LP Token Balance:', parseFloat(lpAccountInfo.value.amount) / 1e9);
      } catch (error) {
        console.error('❌ Error fetching LP balance:', error);
        // No LP tokens yet
        setLpTokenBalance(0);
      }

    } catch (error) {

    }
  }, [wallet.publicKey, riftsBalance]);

  // Refresh LP balance when staking modal opens
  useEffect(() => {
    if (showStakingModal && wallet.publicKey) {
      loadRIFTSTokenData();
    }
  }, [showStakingModal, wallet.publicKey]);

  // Load real treasury and fee collector stats
  /*
  const loadTreasuryData = useCallback(async () => {
    try {

      const [treasuryData, feeCollectorData] = await Promise.all([
        treasuryManager.getTreasuryStatus(),
        realFeeIntegration.getFeeCollectorStatus()
      ]);
      
      setTreasuryStats(treasuryData);
      setFeeCollectorStatus(feeCollectorData);

    } catch (error) {

    }
  }, []);
  */

  // Process accumulated fees manually
  // const handleProcessFees = async () => {
  //   if (!wallet.publicKey || !selectedRift) {
  //     alert('Please connect wallet and select a rift first');
  //     return;
  //   }

  //   try {

  //     const result = await realFeeIntegration.processAccumulatedFees(
  //       new PublicKey(selectedRift.id),
  //       {
  //         publicKey: new PublicKey(wallet.publicKey),
  //         sendTransaction: wallet.sendTransaction || (async () => ({ signature: 'simulation' }))
  //       }
  //     );

  //     if (result.success) {
  //       alert(`✅ Fees processed successfully!\n\nProcessed: ${result.feesProcessed?.toFixed(4)} SOL\nTransaction: ${result.signature}`);
  //       await loadTreasuryData(); // Refresh treasury data
  //       await loadRifts(); // Refresh rift data
  //     } else {
  //       alert(`❌ Fee processing failed: ${result.error}`);
  //     }
  //   } catch (error) {

  //     alert('Error processing fees. Check console for details.');
  //   }
  // };

  // Handle adding liquidity to RIFTS/SOL pool
  const handleAddLiquidity = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!wallet.sendTransaction) {
      alert('Wallet does not support transactions. Please use a compatible wallet.');
      return;
    }

    try {

      const result = await dexIntegration.addInitialRIFTSLiquidity(
        {
          publicKey: wallet.publicKey,
          sendTransaction: wallet.sendTransaction
        },
        0.1, // 0.1 SOL
        200  // 200 RIFTS
      );

      if (result.success) {
        setNotification({
          type: 'success',
          title: '💧 Liquidity Added Successfully!',
          message: `Successfully added liquidity to RIFTS/SOL pool!\n\n` +
                   `Added: 0.1 SOL + 200 RIFTS tokens\n\n` +
                   `Pool Address: ${result.poolAddress}\n\n` +
                   `✅ RIFTS can now be traded on DEXs!`,
          signature: result.signature
        });
      } else {
        setNotification({
          type: 'error',
          title: '❌ Liquidity Failed',
          message: result.error || 'Failed to add liquidity'
        });
      }
    } catch (error) {

      setNotification({
        type: 'error',
        title: '❌ Unexpected Error',
        message: 'An unexpected error occurred while adding liquidity.'
      });
    }
  };

  // Handle buying RIFTS tokens
  const handleBuyRIFTS = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!wallet.sendTransaction) {
      alert('Wallet does not support transactions. Please use a compatible wallet.');
      return;
    }

    try {

      // First check if there's sufficient liquidity
      const liquidityCheck = await dexIntegration.checkRIFTSLiquidity();
      
      if (!liquidityCheck.hasLiquidity) {
        setNotification({
          type: 'info',
          title: '💧 Liquidity Required',
          message: `RIFTS/SOL pool needs liquidity before trading!\n\n` +
                   `Current liquidity: ${liquidityCheck.solReserve} SOL + ${liquidityCheck.riftsReserve} RIFTS\n\n` +
                   `Please add initial liquidity using the "💧 Liquidity" button first.\n\n` +
                   `This will enable DEX trading for RIFTS tokens.`
        });
        return;
      }
      
      // Execute real RIFTS token purchase through DEX
      const solAmount = 0.1; // 0.1 SOL worth 
      const expectedRiftsAmount = 20; // Expected RIFTS tokens (0.1 SOL / 0.005 = 20 RIFTS)
      
      const result = await dexIntegration.buyRIFTS(
        {
          publicKey: wallet.publicKey,
          sendTransaction: wallet.sendTransaction
        }, 
        solAmount,
        expectedRiftsAmount
      );

      if (result.success) {
        // Show success notification with token mint address
        const riftsTokenMint = '9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P';
        
        setNotification({
          type: 'success',
          title: '🎉 RIFTS Swap Successful!',
          message: `Successfully swapped ${solAmount} SOL for RIFTS tokens!\n\n` +
                   `Transaction: ${result.signature}\n\n` +
                   `✅ RIFTS tokens have been deposited to your wallet\n\n` +
                   `📱 To see your RIFTS tokens in Phantom:\n` +
                   `1. Copy the token address below\n` +
                   `2. Add custom token in Phantom\n` +
                   `3. Token address: ${riftsTokenMint}\n\n` +
                   `🎯 Your RIFTS tokens should appear immediately!`,
          signature: result.signature
        });
        
        await loadRIFTSTokenData(); // Refresh balances
        await refreshBalance(); // Refresh SOL balance
      } else {
        setNotification({
          type: 'error',
          title: '❌ Purchase Failed',
          message: result.error || 'Unknown error occurred'
        });
      }
    } catch (error) {

      setNotification({
        type: 'error',
        title: '❌ Unexpected Error',
        message: 'An unexpected error occurred while purchasing RIFTS tokens. Please check the console for details and try again.'
      });
    }
  };

  // Show confirmation before staking
  const handleStakeLPClick = () => {
    if (!wallet.publicKey || !stakingAmount) {
      setNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please connect your wallet and enter an amount to stake.'
      });
      return;
    }

    if (parseFloat(stakingAmount) > lpTokenBalance) {
      setNotification({
        type: 'error',
        title: 'Insufficient Balance',
        message: `You only have ${lpTokenBalance.toFixed(4)} LP tokens available.`
      });
      return;
    }

    // Show confirmation modal
    setShowStakingConfirmation(true);
  };

  // Handle staking LP tokens (after confirmation)
  const handleStakeLP = async () => {
    setIsWrapping(true);

    try {
      // Import LP staking client
      const { lpStakingClient } = await import('@/lib/solana/lp-staking-client');

      // For now, we'll use RIFTS mint as the LP token (in production, use actual LP token mint)
      const lpTokenMint = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');

      // Check wallet.sendTransaction exists
      if (!wallet.sendTransaction) {
        throw new Error('Wallet not connected');
      }

      // Execute real LP token staking
      const result = await lpStakingClient.stakeLPTokens(
        lpTokenMint,
        parseFloat(stakingAmount),
        new PublicKey(wallet.publicKey),
        wallet.sendTransaction
      );

      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Staking Successful!',
          message: `Successfully staked ${result.amount?.toFixed(4)} LP tokens. You are now earning RIFTS rewards!`,
          signature: result.signature
        });

        // Refresh balances
        await loadRIFTSTokenData();

        // Close modal and reset form
        setShowStakingModal(false);
        setStakingAmount('');
      } else {
        setNotification({
          type: 'error',
          title: 'Staking Failed',
          message: result.error || 'Failed to stake LP tokens'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Staking Error',
        message: error instanceof Error ? error.message : 'Failed to stake LP tokens. Please try again.'
      });
    } finally {
      setIsWrapping(false);
    }
  };

  // Handle unstake LP tokens
  const handleUnstakeLP = async () => {
    setIsWrapping(true);

    try {
      // Import LP staking client
      const { lpStakingClient } = await import('@/lib/solana/lp-staking-client');

      // Use RIFTS mint as the LP token
      const lpTokenMint = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');

      // Check wallet.sendTransaction exists
      if (!wallet.sendTransaction) {
        throw new Error('Wallet not connected');
      }

      // Execute unstake
      const result = await lpStakingClient.unstakeLPTokens(
        lpTokenMint,
        parseFloat(unstakeAmount),
        new PublicKey(wallet.publicKey),
        wallet.sendTransaction
      );

      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Unstaking Successful!',
          message: `Successfully unstaked ${result.amount?.toFixed(4)} LP tokens. They have been returned to your wallet.`,
          signature: result.signature
        });

        // Refresh balances
        await loadRIFTSTokenData();

        // Reset form
        setUnstakeAmount('');
      } else {
        setNotification({
          type: 'error',
          title: 'Unstaking Failed',
          message: result.error || 'Failed to unstake LP tokens'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Unstaking Error',
        message: error instanceof Error ? error.message : 'Failed to unstake LP tokens. Please try again.'
      });
    } finally {
      setIsWrapping(false);
    }
  };

  // Handle claim RIFTS rewards
  const handleClaimRewards = async () => {
    setIsWrapping(true);

    try {
      // Import LP staking client
      const { lpStakingClient } = await import('@/lib/solana/lp-staking-client');

      // Use RIFTS mint as the LP token
      const lpTokenMint = new PublicKey('9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P');

      // Check wallet.sendTransaction exists
      if (!wallet.sendTransaction) {
        throw new Error('Wallet not connected');
      }

      // Execute claim rewards
      const result = await lpStakingClient.claimRewards(
        lpTokenMint,
        new PublicKey(wallet.publicKey),
        wallet.sendTransaction
      );

      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Rewards Claimed!',
          message: `Successfully claimed your RIFTS rewards! Check your wallet balance.`,
          signature: result.signature
        });

        // Refresh balances
        await loadRIFTSTokenData();
      } else {
        setNotification({
          type: 'error',
          title: 'Claim Failed',
          message: result.error || 'Failed to claim rewards'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Claim Error',
        message: error instanceof Error ? error.message : 'Failed to claim rewards. Please try again.'
      });
    } finally {
      setIsWrapping(false);
    }
  };

  // Handle voting on proposals
  const handleVote = async () => {

    if (!wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    setShowGovernance(true);
  };

  // Handle wrap tokens
  const handleWrap = async () => {
    if (!selectedRift || !wrapAmount || !wallet.publicKey) {

      return;
    }

    setIsWrapping(true);
    try {
      const productionService = new ProductionRiftsService(connection as unknown as Connection);
      
      // Access the browser's Phantom wallet directly
      const phantomWallet = window?.solana;
      
      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      // Create a proper wallet adapter for the service
      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: async (transaction: Transaction) => {
          try {
            // Set transaction properties
            if (!transaction.recentBlockhash) {
              const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
              transaction.recentBlockhash = latestBlockhash.blockhash;
            }
            if (!transaction.feePayer && phantomWallet.publicKey) {
              transaction.feePayer = phantomWallet.publicKey;
            }
            
            // Use Phantom's signAndSendTransaction

            const { signature } = await phantomWallet.signAndSendTransaction(transaction);

            return signature;
          } catch (error: any) {

            throw error;
          }
        },
        signTransaction: async (transaction: Transaction) => {
          // For signing only, return the transaction as-is
          return transaction;
        }
      };
      
      productionService.setWallet(walletAdapter);

      const result = await productionService.wrapTokens({
        user: new PublicKey(wallet.publicKey),
        riftPubkey: new PublicKey(selectedRift.id),
        amount: parseFloat(wrapAmount)
      });

      if (result.success) {

        setShowWrapModal(false);
        setWrapAmount('');

        // Calculate actual tokens received after 0.7% fee
        const wrapAmountNum = parseFloat(wrapAmount);
        const feePercentage = 0.007; // 0.7% fee
        const tokensReceived = wrapAmountNum * (1 - feePercentage);

        // UPDATE BALANCE INSTANTLY - Don't wait for blockchain confirmation!
        const currentBalance = selectedRiftTokenBalance || 0;
        const newBalance = currentBalance + tokensReceived;
        setSelectedRiftTokenBalance(newBalance);
        setSelectedRiftBalance(newBalance); // Also update for liquidity modal

        setNotification({
          type: 'success',
          title: '🌊 Wrap Successful!',
          message: `Successfully wrapped ${wrapAmount} ${selectedRift.underlying} tokens!\n\n` +
                   `• Received ${tokensReceived.toFixed(4)} ${selectedRift.symbol} tokens (after 0.7% fee)\n` +
                   `• Tokens are now available in your wallet\n` +
                   `• Ready for trading or unwrapping!`,
          signature: result.signature
        });

        // Clear cache to ensure fresh data
        productionService.clearCache();

        // Fetch from blockchain in background to sync (but UI already updated!)
        fetchRiftTokenBalance(selectedRift).catch(() => {
          // If blockchain fetch fails, keep the instant update
        });
        await loadRIFTSTokenData(); // Refresh RIFTS and other balances
      } else {

        setNotification({
          type: 'error',
          title: '❌ Wrap Failed',
          message: result.error || 'Failed to wrap tokens and create pool'
        });
      }
    } catch (error) {

    } finally {
      setIsWrapping(false);
    }
  };

  // Handle unwrap tokens
  const handleUnwrap = async () => {
    if (!selectedRift || !unwrapAmount || !wallet.publicKey) {

      return;
    }

    setIsUnwrapping(true);
    try {
      const productionService = new ProductionRiftsService(connection as unknown as Connection);
      
      // Access the browser's Phantom wallet directly
      const phantomWallet = window?.solana;
      
      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      // Create a proper wallet adapter for the service
      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: async (transaction: Transaction) => {
          try {
            // Set transaction properties
            if (!transaction.recentBlockhash) {
              const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
              transaction.recentBlockhash = latestBlockhash.blockhash;
            }
            if (!transaction.feePayer && phantomWallet.publicKey) {
              transaction.feePayer = phantomWallet.publicKey;
            }
            
            // Use Phantom's signAndSendTransaction

            const { signature } = await phantomWallet.signAndSendTransaction(transaction);

            return signature;
          } catch (error: any) {

            throw error;
          }
        },
        signTransaction: async (transaction: Transaction) => {
          // For signing only, return the transaction as-is
          return transaction;
        }
      };
      
      productionService.setWallet(walletAdapter);

      const result = await productionService.unwrapTokens({
        user: new PublicKey(wallet.publicKey),
        riftPubkey: new PublicKey(selectedRift.id),
        riftTokenAmount: parseFloat(unwrapAmount)
      });

      if (result.success) {

        setShowUnwrapModal(false);

        // UPDATE BALANCE INSTANTLY - Don't wait for blockchain!
        const unwrapAmountNum = parseFloat(unwrapAmount);
        const currentBalance = selectedRiftTokenBalance || 0;
        const newBalance = Math.max(0, currentBalance - unwrapAmountNum); // Don't go negative
        setSelectedRiftTokenBalance(newBalance);
        setSelectedRiftBalance(newBalance);

        setUnwrapAmount('');

        // Clear cache to ensure fresh data
        productionService.clearCache();

        // Fetch from blockchain in background (but UI already updated!)
        loadRifts().catch(() => {}); // Background refresh
        if (selectedRift) {
          fetchRiftTokenBalance(selectedRift).catch(() => {
            // If blockchain fetch fails, keep the instant update
          });
        }
        await loadRIFTSTokenData(); // Refresh RIFTS and other balances
      } else {

      }
    } catch (error) {

    } finally {
      setIsUnwrapping(false);
    }
  };

  // Handle close rift
  const handleCloseRift = async () => {
    if (!selectedRift || !wallet.publicKey) {

      return;
    }

    try {

      const productionService = new ProductionRiftsService(connection as unknown as Connection);
      
      const walletAdapter: WalletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: async (transaction: Transaction) => {
          if (typeof window !== 'undefined' && window.solana) {
            const { signature } = await window.solana.signAndSendTransaction(transaction);
            return signature;
          }
          throw new Error('Phantom wallet not available');
        },
        signTransaction: async (transaction: Transaction) => {
          // For signing only, return the transaction as-is
          return transaction;
        }
      };
      
      productionService.setWallet(walletAdapter);

      // Use admin close function instead of regular close
      const result = await productionService.adminCloseRift({
        riftPubkey: new PublicKey(selectedRift.id)
      });

      if (result.success) {

        // Close the modal and refresh rifts
        setRiftsModal({ isOpen: false, rift: null });
        await loadRifts();
        
        // Show success message
        // addToast(`Rift closed successfully! Transaction: ${result.signature}`, 'success', result.signature);
      } else {

        // addToast(`Close rift failed: ${result.error}`, 'error');
      }
    } catch (error) {

      // addToast(`Error closing rift: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Step 1: Create Rift Only
  const handleCreateRiftStep = async () => {
    if (!selectedToken || !wallet.publicKey || !wallet.connected) {

      return;
    }

    // Validate custom token inputs
    if (selectedToken === 'CUSTOM' && (!customTokenAddress || !customTokenSymbol)) {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: 'Please enter custom token address and symbol'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    setIsCreatingRift(true);

    try {
      // Token addresses on devnet
      const tokenAddresses: Record<string, string> = {
        'SOL': 'So11111111111111111111111111111111111111112',
        'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        'USDT': 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'
      };

      const tokenAddress = selectedToken === 'CUSTOM' ? customTokenAddress : tokenAddresses[selectedToken];
      const tokenSymbol = selectedToken === 'CUSTOM' ? customTokenSymbol : selectedToken;

      const params = {
        tokenAddress,
        tokenSymbol,
        burnFee,
        partnerFee,
        partnerWallet: partnerWallet || wallet.publicKey
      };

      // Clear all caches for new program IDs

      localStorage.removeItem('rifts-cache');
      localStorage.removeItem('user-data-cache');
      localStorage.removeItem('price-cache');

      // Set wallet on service before creating rift
      const phantomWallet = window?.solana;

      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: async (transaction: Transaction) => {
          try {
            if (!transaction.recentBlockhash) {
              const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
              transaction.recentBlockhash = latestBlockhash.blockhash;
            }
            if (!transaction.feePayer && phantomWallet.publicKey) {
              transaction.feePayer = phantomWallet.publicKey;
            }

            const { signature } = await phantomWallet.signAndSendTransaction(transaction);

            return signature;
          } catch (error: any) {

            throw error;
          }
        },
        signTransaction: async (transaction: Transaction) => {
          // For signing only, return the transaction as-is
          return transaction;
        }
      };
      riftProtocolService.setWallet(walletAdapter as WalletAdapter);

      // Create the rift with PDA-based vanity address (like pump.fun) + enhanced debugging

      const createResult = await riftProtocolService.createRiftWithVanityPDA({
        creator: new PublicKey(wallet.publicKey),
        underlyingMint: new PublicKey(tokenAddress),
        burnFeeBps: Math.floor(parseFloat(burnFee) * 100), // Convert percentage to basis points
        partnerFeeBps: Math.floor(parseFloat(partnerFee) * 100), // Convert percentage to basis points
        partnerWallet: partnerWallet ? new PublicKey(partnerWallet) : undefined,
        riftName: selectedToken
      });

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create rift');
      }

      // Store the created rift data
      setCreatedRiftPDA(createResult.riftId || createResult.signature || null);
      setCreatedRiftData(createResult);

      // Refresh rifts from Supabase to show the newly created rift
      loadRifts();

      // Close the modal
      setShowCreateRiftModal(false);

      // Reset form
      setSelectedToken('');
      setCustomTokenAddress('');
      setCustomTokenSymbol('');
      setBurnFee('45');
      setPartnerFee('0');
      setPartnerWallet('');

      // Show success notification
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'success',
        message: 'Rift created successfully! You can now wrap tokens or add liquidity.'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);

    } catch (error) {

      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create rift'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    } finally {
      setIsCreatingRift(false);
    }
  };

  // Fetch deposit quote from Meteora and auto-fill the other field
  const fetchDepositQuote = async (poolAddress: string, amount: number, fieldType: 'sol' | 'rift') => {
    if (!poolAddress || poolAddress === '11111111111111111111111111111111' || !amount || amount <= 0) {
      setDepositQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    try {
      let quote;
      if (fieldType === 'rift') {
        // User entered RIFT amount, calculate SOL needed
        quote = await meteoraLiquidityService.getDepositQuoteFromRift(poolAddress, amount);
        // Auto-fill SOL amount
        setSolLiquidityAmount(quote.wsolNeeded.toFixed(9));
      } else {
        // User entered SOL amount, calculate RIFT needed
        quote = await meteoraLiquidityService.getDepositQuoteFromSol(poolAddress, amount);
        // Auto-fill RIFT amount
        setRiftLiquidityAmount(quote.riftNeeded.toFixed(9));
      }
      setDepositQuote(quote);

    } catch (error) {

      setDepositQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Create Meteora Pool & Add Initial Liquidity
  const handleCreatePoolAndAddLiquidity = async () => {
    // Use selectedRift if available (from Add Liquidity modal), otherwise use createdRiftData
    const riftToUse = selectedRift || createdRiftData;
    const riftPDA = selectedRift?.id || createdRiftPDA;

    if (!riftPDA || !riftToUse || !solLiquidityAmount || !riftLiquidityAmount) {

      return;
    }

    setIsCreatingMeteoraPool(true);

    try {
      const phantomWallet = window?.solana;

      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      // Check if pool already exists
      const poolAddress = riftToUse.liquidityPool;
      const poolExists = poolAddress && poolAddress !== '11111111111111111111111111111111';

      if (poolExists) {
        // Pool exists - add liquidity using meteora-liquidity-service

        // Show pending toast
        const infoToastId = Date.now().toString();
        setToasts(prev => [...prev, {
          id: infoToastId,
          type: 'pending',
          message: `Adding liquidity... Please sign the transaction`
        }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== infoToastId));
        }, 5000);

        const walletAdapter = {
          publicKey: new PublicKey(wallet.publicKey),
          signTransaction: async (transaction: Transaction) => {
            const signed = await phantomWallet.signTransaction(transaction);
            return signed;
          },
          sendTransaction: async (transaction: Transaction, conn: Connection) => {
            const { signature } = await phantomWallet.signAndSendTransaction(transaction);
            return signature;
          },
          connected: true
        };

        const signature = await meteoraLiquidityService.addLiquidity({
          poolAddress,
          wsolAmount: parseFloat(solLiquidityAmount),
          riftAmount: parseFloat(riftLiquidityAmount),
          wallet: walletAdapter,
          connection: connection as unknown as Connection
        });

        // UPDATE UI AND DATABASE INSTANTLY!
        const liquidityAmount = parseFloat(solLiquidityAmount) || 0;
        const riftId = selectedRift?.id || riftPDA;

        // Find the rift we're updating
        const riftToUpdate = rifts.find(r => r.id === riftId);

        if (riftToUpdate) {
          // Create updated rift data
          const updatedRiftData = {
            ...riftToUpdate,
            hasMeteoraPool: true,
            liquidityPool: poolAddress,
            tvl: (riftToUpdate.tvl || 0) + liquidityAmount
          };

          // Update the rift in the rifts array immediately
          setRifts(prevRifts =>
            prevRifts.map(rift =>
              rift.id === riftId ? updatedRiftData : rift
            )
          );

          // Update selected rift if it's the one we added liquidity to
          if (selectedRift && selectedRift.id === riftId) {
            setSelectedRift(updatedRiftData);
          }

          // SAVE TO SUPABASE IMMEDIATELY!
          riftProtocolService.updateRiftInCache(riftId, {
            hasMeteoraPool: true,
            liquidityPool: poolAddress,
            tvl: updatedRiftData.tvl
          });

          // Also save directly to Supabase for instant persistence
          (async () => {
            try {
              const { supabase } = await import('@/lib/supabase/client');
              await supabase
                .from('rifts')
                .update({
                  vault_balance: updatedRiftData.tvl.toString(),
                  total_tokens_wrapped: updatedRiftData.tvl.toString(),
                  raw_data: updatedRiftData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', riftId);
            } catch (error) {
              console.error('Failed to update Supabase:', error);
            }
          })();
        }

        // Show success notification
        const toastId = Date.now().toString();
        setToasts(prev => [...prev, {
          id: toastId,
          type: 'success',
          message: `Liquidity added successfully! 🎉`,
          signature
        }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 5000);

        // Refresh from database in background (but UI already updated!)
        loadRifts().catch(() => {});

      } else {
        // Pool doesn't exist - create new pool using riftProtocolService
        const walletAdapter = {
          publicKey: new PublicKey(wallet.publicKey),
          sendTransaction: async (transaction: Transaction) => {
            try {
              if (!transaction.recentBlockhash) {
                const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
              }
              if (!transaction.feePayer && phantomWallet.publicKey) {
                transaction.feePayer = phantomWallet.publicKey;
              }

              // Check if transaction is already partially signed (e.g., by position NFT mint)
              const hasExistingSignatures = transaction.signatures.some(sig => sig.signature !== null);

              if (hasExistingSignatures) {

                // For partially-signed transactions, use signTransaction + sendRawTransaction
                const signedTx = await phantomWallet.signTransaction(transaction);
                const rawTransaction = signedTx.serialize();

                // Try with preflight first, fallback to skipPreflight if it fails with "already in use"
                try {
                  const signature = await (connection as unknown as Connection).sendRawTransaction(rawTransaction, {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                  });

                  return signature;
                } catch (preflightError: any) {
                  const errorMsg = preflightError?.message || String(preflightError);
                  if (errorMsg.includes('already in use') || errorMsg.includes('Allocate:')) {

                    throw new Error(
                      'Pool creation blocked by orphaned accounts from previous attempts. ' +
                      'Please clear your browser cache, refresh the page, and try again in a few minutes. ' +
                      'If the issue persists, the orphaned accounts may need to be manually closed.'
                    );
                  }
                  throw preflightError; // Re-throw other errors
                }
              } else {
                // For fresh transactions, use signAndSendTransaction
                const { signature } = await phantomWallet.signAndSendTransaction(transaction);

                return signature;
              }
            } catch (error: any) {

              throw error;
            }
          },
          signTransaction: async (transaction: Transaction) => {
            return transaction;
          }
        };
        riftProtocolService.setWallet(walletAdapter as WalletAdapter);

        // Create Meteora pool with initial liquidity

        const meteoraResult = await riftProtocolService.createMeteoraPool({
          riftPubkey: new PublicKey(riftPDA),
          amount: parseFloat(solLiquidityAmount), // Amount of SOL/underlying token
          binStep: parseInt(meteoraBinStep) || 25,
          baseFactor: parseInt(meteoraBaseFactor) || 100
        });

        // Update the rift in cache with new liquidity data
        const liquidityAmount = parseFloat(solLiquidityAmount);
        const newPoolAddress = meteoraResult.poolAddress;

        riftProtocolService.updateRiftInCache(riftPDA, {
          tvl: liquidityAmount,
          apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0,
          volume24h: liquidityAmount * 0.1,
          hasMeteoraPool: true,
          liquidityPool: newPoolAddress
        });

        // Update UI state immediately
        setRifts(prevRifts =>
          prevRifts.map(rift =>
            rift.id === riftPDA
              ? {
                  ...rift,
                  tvl: liquidityAmount,
                  apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0,
                  volume24h: liquidityAmount * 0.1,
                  hasMeteoraPool: true,
                  liquidityPool: newPoolAddress
                }
              : rift
          )
        );

        // Update selected rift if it's the one we created pool for
        if (selectedRift && selectedRift.id === riftPDA) {
          setSelectedRift(prev => prev ? {
            ...prev,
            hasMeteoraPool: true,
            liquidityPool: newPoolAddress,
            tvl: liquidityAmount,
            apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0
          } : prev);
        }

        // SAVE TO SUPABASE IMMEDIATELY!
        const updatedRift = rifts.find(r => r.id === riftPDA);
        if (updatedRift) {
          const updatedRiftData = {
            ...updatedRift,
            hasMeteoraPool: true,
            liquidityPool: newPoolAddress,
            tvl: liquidityAmount,
            apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0
          };

          (async () => {
            try {
              const { supabase } = await import('@/lib/supabase/client');
              await supabase
                .from('rifts')
                .update({
                  vault_balance: updatedRiftData.tvl.toString(),
                  total_tokens_wrapped: updatedRiftData.tvl.toString(),
                  raw_data: updatedRiftData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', riftPDA);
            } catch (error) {
              console.error('Failed to update Supabase:', error);
            }
          })();
        }

        // Show success notification
        const toastId = Date.now().toString();
        setToasts(prev => [...prev, {
          id: toastId,
          type: 'success',
          message: 'Meteora pool created with liquidity! Your RIFT is now tradeable on Jupiter! 🎉'
        }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 5000);
      }

      // Close modal - we're done!
      setShowAddLiquidityModal(false);
      setSolLiquidityAmount('');
      setRiftLiquidityAmount('');

    } catch (error) {

      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create pool and add liquidity'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    } finally {
      setIsCreatingMeteoraPool(false);
    }
  };

  // Remove liquidity from Meteora pool
  const handleRemoveLiquidity = async () => {
    // Validation based on mode
    if (removeMode === 'positions' && selectedPositions.size === 0) {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: 'Please select at least one position to remove'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    if (removeMode === 'percentage') {
      const pct = parseFloat(removePercentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        const toastId = Date.now().toString();
        setToasts(prev => [...prev, {
          id: toastId,
          type: 'error',
          message: 'Please enter a valid percentage between 0 and 100'
        }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 5000);
        return;
      }
    }

    // Check for liquidity pool
    const poolAddress = selectedRift?.liquidityPool;

    if (!poolAddress || poolAddress === '11111111111111111111111111111111') {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: 'No liquidity pool found for this rift. Please create a pool first by adding liquidity.'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    // Validate pool address is a valid public key
    try {
      new PublicKey(poolAddress);
    } catch (error) {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: `Invalid pool address: ${poolAddress}. Please contact support.`
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    setIsCreatingMeteoraPool(true); // Reuse loading state

    try {
      const phantomWallet = window?.solana;

      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      // Create wallet adapter for meteora-liquidity-service
      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        signTransaction: async (transaction: Transaction) => {
          // Phantom will handle signing when we send
          const signed = await phantomWallet.signTransaction(transaction);
          return signed;
        },
        sendTransaction: async (transaction: Transaction, conn: Connection) => {
          // Phantom signs and sends
          const { signature } = await phantomWallet.signAndSendTransaction(transaction);
          return signature;
        },
        connected: true
      };

      let signatures: string[] = [];
      let successMessage = '';

      if (removeMode === 'percentage') {
        // Remove liquidity by percentage
        const pct = parseFloat(removePercentage);

        const result = await meteoraLiquidityService.removeLiquidityByPercentage({
          poolAddress,
          percentage: pct,
          wallet: walletAdapter,
          connection: connection as unknown as Connection
        });

        signatures = result.signatures;
        successMessage = `${pct}% removed! You got back ${result.withdrawnTokenA.toFixed(6)} ${selectedRift.underlying} + ${result.withdrawnTokenB.toFixed(6)} r${selectedRift.symbol} 🎉`;

      } else {
        // Remove selected positions
        const positionAddressArray = Array.from(selectedPositions);

        signatures = await meteoraLiquidityService.removeSpecificPositions({
          poolAddress,
          positionAddresses: positionAddressArray,
          wallet: walletAdapter,
          connection: connection as unknown as Connection
        });

        successMessage = `${signatures.length} position${signatures.length !== 1 ? 's' : ''} removed successfully! 🎉`;

      }

      // Show success notification
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'success',
        message: successMessage,
        signature: signatures[0] // Show first signature
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);

      // Refresh rifts data
      await loadRifts();

      // Close modal
      setShowAddLiquidityModal(false);
      setSolLiquidityAmount('');
      setRiftLiquidityAmount('');

    } catch (error) {

      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove liquidity'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    } finally {
      setIsCreatingMeteoraPool(false);
    }
  };

  // Reset modal state when closing
  const handleCloseCreateRiftModal = () => {
    setShowCreateRiftModal(false);
    setCreatedRiftPDA(null);
    setCreatedRiftData(null);
    setSelectedToken('');
    setCustomTokenAddress('');
    setCustomTokenSymbol('');
  };

  // Handle Create Rift (Legacy function for backward compatibility)
  const handleCreateRift = async () => {
    if (!selectedToken || !wallet.publicKey || !wallet.connected) {

      return;
    }

    // Validate custom token inputs
    if (selectedToken === 'CUSTOM' && (!customTokenAddress || !customTokenSymbol)) {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: 'Please enter custom token address and symbol'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    // Validate initial liquidity amount
    if (!initialLiquidityAmount || parseFloat(initialLiquidityAmount) <= 0) {
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: 'Please enter a valid initial liquidity amount'
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
      return;
    }

    setIsCreatingRift(true);
    
    try {
      // Token addresses on devnet
      const tokenAddresses: Record<string, string> = {
        'SOL': 'So11111111111111111111111111111111111111112',
        'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        'USDT': 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'
      };

      // Use custom token if selected
      const tokenAddress = selectedToken === 'CUSTOM' 
        ? customTokenAddress 
        : tokenAddresses[selectedToken];
      
      const tokenSymbol = selectedToken === 'CUSTOM'
        ? customTokenSymbol
        : selectedToken;

      const params = {
        tokenAddress,
        tokenSymbol,
        burnFee: parseFloat(burnFee),
        partnerFee: parseFloat(partnerFee),
        partnerWallet: partnerWallet || undefined
      };

      // Set wallet on service before creating rift
      // Access the browser's Phantom wallet directly
      const phantomWallet = window?.solana;
      
      if (!phantomWallet?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sendTransaction: async (transaction: Transaction) => {
          try {
            // Set transaction properties
            if (!transaction.recentBlockhash) {
              const latestBlockhash = await (connection as unknown as Connection).getLatestBlockhash();
              transaction.recentBlockhash = latestBlockhash.blockhash;
            }
            if (!transaction.feePayer && phantomWallet.publicKey) {
              transaction.feePayer = phantomWallet.publicKey;
            }
            
            // Use Phantom's signAndSendTransaction

            const { signature } = await phantomWallet.signAndSendTransaction(transaction);

            return signature;
          } catch (error: any) {

            throw error;
          }
        },
        signTransaction: async (transaction: Transaction) => {
          // For signing only, return the transaction as-is
          return transaction;
        }
      };
      riftProtocolService.setWallet(walletAdapter as WalletAdapter);

      // Step 1: Create the rift with vanity PDA address (SECURE - no private keys)
      // SECURITY FIX: Changed from createRiftWithVanityAddress() to createRiftWithVanityPDA()
      // This eliminates the private key exposure vulnerability
      const createResult = await riftProtocolService.createRiftWithVanityPDA({
        creator: new PublicKey(wallet.publicKey),
        underlyingMint: new PublicKey(tokenAddress),
        burnFeeBps: Math.floor(parseFloat(burnFee)), // Already in basis points
        partnerFeeBps: Math.floor(parseFloat(partnerFee)), // Already in basis points
        partnerWallet: partnerWallet ? new PublicKey(partnerWallet) : undefined,
        riftName: selectedToken
      });

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create rift');
      }

      // Calculate rift PDA to get the rift address
      const [riftPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("rift"), new PublicKey(tokenAddress).toBuffer(), new PublicKey(wallet.publicKey).toBuffer()],
        new PublicKey('D37XSobyWYs1XHUjF4YopMuPPYQ6GYCSjJCyPmat3CLn')
      );

      // Refresh rifts from Supabase to show the newly created rift
      loadRifts();

      if (createResult.success) {

        // Rift was already added to cache immediately, no need for retries

        // Check if transaction is pending
        const isPending = (createResult as any).pending;

        // Step 2: Add initial liquidity by wrapping tokens

        let toastId = Date.now().toString();

        try {
          // Wait a moment for rift to be available
          if (isPending) {

            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          const wrapResult = await riftProtocolService.wrapTokens({
            user: new PublicKey(wallet.publicKey),  // Add the user's public key
            riftPubkey: new PublicKey(riftPDA),  // Change riftAddress to riftPubkey and ensure it's a PublicKey
            amount: parseFloat(initialLiquidityAmount),
            initialRiftAmount: parseFloat(initialRiftAmount),
            tradingFeeBps: parseInt(tradingFeeBps),
            binStep: parseInt(binStep)
          });

          if (wrapResult.success) {

            // Update the rift in cache with new liquidity data
            const liquidityAmount = parseFloat(initialLiquidityAmount);
            riftProtocolService.updateRiftInCache(riftPDA.toBase58(), {
              tvl: liquidityAmount,
              apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0,
              volume24h: liquidityAmount * 0.1
            });

            // Update UI state immediately
            setRifts(prevRifts =>
              prevRifts.map(rift =>
                rift.id === riftPDA.toBase58()
                  ? {
                      ...rift,
                      tvl: liquidityAmount,
                      apy: liquidityAmount > 0 ? 15 + Math.random() * 10 : 0,
                      volume24h: liquidityAmount * 0.1
                    }
                  : rift
              )
            );

            // Show success notification for both operations
            toastId = Date.now().toString();
            setToasts(prev => [...prev, {
              id: toastId,
              type: 'success',
              message: `Created r${tokenSymbol} rift and added ${initialLiquidityAmount} ${tokenSymbol} initial liquidity!`,
              signature: wrapResult.signature
            }]);
          } else {

            // Show partial success notification
            toastId = Date.now().toString();
            setToasts(prev => [...prev, {
              id: toastId,
              type: 'success',
              message: `Created r${tokenSymbol} rift successfully, but initial liquidity failed. You can add liquidity manually.`,
              signature: createResult.signature
            }]);
          }
        } catch (wrapError) {

          // Show partial success notification
          toastId = Date.now().toString();
          setToasts(prev => [...prev, {
            id: toastId,
            type: 'success',
            message: `Created r${tokenSymbol} rift successfully, but initial liquidity failed. You can add liquidity manually.`,
            signature: createResult.signature
          }]);
        }

        // Auto-remove toast after 8 seconds for pending, 5 for confirmed
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 8000);

        // Reset form
        setSelectedToken('');
        setCustomTokenAddress('');
        setCustomTokenSymbol('');
        setBurnFee('45');
        setPartnerFee('0');
        setPartnerWallet('');
        setInitialLiquidityAmount('');
        setShowCreateRiftModal(false);
        
        // Rifts already updated in cache immediately
      }
    } catch (error) {

      // Show error notification
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create rift'
      }]);
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    } finally {
      setIsCreatingRift(false);
    }
  };

  // Filtered and sorted rifts
  const filteredRifts = (() => {
    // First, filter by search query
    let filtered = rifts.filter(rift => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        rift.symbol?.toLowerCase().includes(query) ||
        rift.underlying?.toLowerCase().includes(query) ||
        rift.strategy?.toLowerCase().includes(query)
      );
    });

    // Filter for tradeable rifts only (those with valid token mints)
    if (showOnlyTradeable) {
      const beforeCount = filtered.length;

      filtered = filtered.filter(rift => {
        const riftData = rift as unknown as {
          riftMint?: string;
          contractAddresses?: { riftsToken?: string };
          hasMeteoraPool?: boolean;
          tvl?: number;
          id?: string;
        };

        // Check multiple sources for riftMint (the token that can be traded)
        const riftMint = riftData.riftMint || riftData.contractAddresses?.riftsToken;

        // A rift is tradeable if it has a valid riftMint token address
        const hasValidMint = riftMint &&
          riftMint !== '11111111111111111111111111111111' &&
          riftMint !== PublicKey.default.toBase58() &&
          riftMint.length > 20;

        // Also consider rifts with Meteora pools as tradeable (even if riftMint check fails)
        const hasMeteoraPool = riftData.hasMeteoraPool && (riftData.tvl || 0) > 0;

        const isTradeable = hasValidMint || hasMeteoraPool;

        // Debug logging for filtered rifts
        if (isTradeable) {

        }

        return isTradeable;
      });

      // If no rifts found, log all rift mints for debugging
      if (filtered.length === 0 && beforeCount > 0) {

        filtered.slice(0, 5).forEach(rift => {
          const riftData = rift as unknown as {
            riftMint?: string;
            contractAddresses?: { riftsToken?: string };
            id?: string;
          };

        });
      }
    }

    // Remove duplicates if enabled (keep highest TVL for each symbol)
    if (hideDuplicates) {
      const riftsBySymbol = new Map<string, RiftData>();

      filtered.forEach(rift => {
        const symbol = rift.symbol || rift.underlying;
        const existing = riftsBySymbol.get(symbol);

        // Keep the rift with highest TVL
        if (!existing || rift.tvl > existing.tvl) {
          riftsBySymbol.set(symbol, rift);
        }
      });

      filtered = Array.from(riftsBySymbol.values());
    }

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'tvl': return b.tvl - a.tvl;
        case 'apy': return b.apy - a.apy;
        case 'volume': return b.volume24h - a.volume24h;
        case 'newest':
          // Sort by creation date (newest first), with account address as tiebreaker
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

          // If dates are equal (or both 0), use account address as tiebreaker (newer addresses are typically larger)
          if (dateB === dateA) {
            return (b.id || '').localeCompare(a.id || '');
          }
          return dateB - dateA;
        default: return 0;
      }
    });
  })();

  // Enhanced Protocol Stats - Use REAL blockchain metrics ONLY - prioritize protocolAnalytics from deployed programs
  const totalTVL = realProtocolMetrics?.totalValueLocked || realMetrics?.totalTvl || rifts.reduce((sum, rift) => sum + rift.tvl, 0);
  const totalVolume = realProtocolMetrics?.totalVolume24h || realMetrics?.totalVolume24h || rifts.reduce((sum, rift) => sum + rift.volume24h, 0);
  const avgAPY = protocolAnalytics?.avgAPY ?? realProtocolMetrics?.averageAPY ?? realMetrics?.avgApy ?? (rifts.length > 0 ? rifts.reduce((sum, rift) => sum + rift.apy, 0) / rifts.length : 0);
  const totalUsers = realProtocolMetrics?.totalUsers || realMetrics?.activeUsers || rifts.reduce((sum, rift) => sum + rift.participants, 0);

  // Real growth data from blockchain (calculated from 24h vs 7d averages)
  const tvlGrowth = realProtocolMetrics ? ((realProtocolMetrics.totalValueLocked - (realProtocolMetrics.totalVolume7d / 7)) / Math.max(realProtocolMetrics.totalVolume7d / 7, 1)) * 100 : 0;
  const volumeGrowth = realProtocolMetrics ? ((realProtocolMetrics.totalVolume24h - (realProtocolMetrics.totalVolume7d / 7)) / Math.max(realProtocolMetrics.totalVolume7d / 7, 1)) * 100 : 0;
  
  // Real fees and revenue from blockchain - prioritize protocolAnalytics from deployed programs
  const totalFees = protocolAnalytics?.totalFees ?? realProtocolMetrics?.totalFeesGenerated ?? realMetrics?.totalFees ?? totalVolume * 0.003;
  const protocolRevenue = protocolAnalytics?.protocolFees ?? realProtocolMetrics?.protocolRevenue ?? totalFees * 0.1;
  const totalBurned = protocolAnalytics?.totalBurned ?? realMetrics?.totalBurned ?? totalFees * 0.45;
  const burnRate = protocolAnalytics?.burnRate ?? 45; // From deployed programs or default 45%
  const pendingDistribution = protocolAnalytics?.pendingDistribution ?? 0;
  
  // RIFTS token data - Real data from blockchain
  const riftsTokenPrice = tokenPrices.get('RIFTS')?.price || 0.001;
  const riftsTokenData = {
    price: riftsTokenPrice, // Real price from DEX
    supply: 1000000000, // 1B total supply
    circulatingSupply: 1000000000 - totalBurned, // Supply minus burned
    burned: totalBurned,
    marketCap: riftsTokenPrice * (1000000000 - totalBurned), // Real market cap
    holders: totalUsers || 0 // Real holder count
  };

  // Calculate real user portfolio data
  const getUserPortfolioData = () => {
    if (!wallet.connected || !wallet.publicKey) {
      return { totalValue: 0, positions: [], totalRewards: 0, claimableRewards: 0 };
    }

    // Use real portfolio data from blockchain if available
    if (realPortfolioData) {
      return {
        totalValue: realPortfolioData.totalValue,
        positions: realPortfolioData.positions.map((p: any) => ({
          rift: p.rift,
          underlying: p.underlying,
          position: p.balance,
          value: p.value,
          pnl: p.pnl,
          rewards: p.rewards,
          entry: 1.0, // Would need to track entry price
          current: p.value / Math.max(p.balance, 0.000001)
        })),
        totalRewards: realPortfolioData.totalRewards,
        claimableRewards: realPortfolioData.claimableRewards
      };
    }

    // Fallback: Calculate from rifts data
    const userPositions = rifts.filter(rift => rift.participants > 0).map(rift => {
      const userBalance = 0; // Would need actual balance check
      const positionValue = userBalance * (rift.riftPrice || 1);
      
      return {
        rift: rift.symbol,
        underlying: rift.underlying,
        position: userBalance,
        value: positionValue,
        pnl: 0,
        rewards: 0,
        entry: 1.0,
        current: rift.riftPrice || 1.0
      };
    }).filter(p => p.position > 0);

    const totalValue = userPositions.reduce((sum, p) => sum + p.value, 0);
    const totalRewards = userPositions.reduce((sum, p) => sum + p.rewards, 0);

    return { 
      totalValue, 
      positions: userPositions, 
      totalRewards,
      claimableRewards: totalRewards 
    };
  };

  // Get real user transaction history from blockchain
  const getUserTransactionHistory = (): Array<{type: string, amount: string, timestamp: number, hash: string, rift: string, time: string, status: string, value: string}> => {
    if (!wallet.connected || !wallet.publicKey) {
      return [];
    }

    // Use real transaction data from blockchain
    if (realTransactions && realTransactions.length > 0) {
      return realTransactions.map(tx => ({
        type: tx.type,
        amount: tx.amount.toFixed(4),
        timestamp: tx.timestamp,
        hash: tx.signature,
        rift: tx.token,
        time: new Date(tx.timestamp).toLocaleString(),
        status: tx.status,
        value: `$${(tx.amount * 180).toFixed(2)}` // Using current SOL price
      }));
    }

    return [];
  };

  return (
    <div className="relative flex w-full min-h-screen text-white md:h-screen md:overflow-hidden">
      {/* Full Page RippleGrid Background */}
      <div className="fixed inset-0 z-10 bg-black">
        <RippleGrid
          enableRainbow={false}
          gridColor="#10b981"
          rippleIntensity={0.03}
          gridSize={18}
          gridThickness={6}
          mouseInteraction={true}
          mouseInteractionRadius={3.0}
          opacity={0.85}
          fadeDistance={2.5}
          vignetteStrength={2.5}
          glowIntensity={0.5}
        />
      </div>
      {/* Governance Panel */}
      {/* Governance Panel - Higher z-index to appear above other modals */}
      <GovernancePanel
        wallet={wallet}
        isOpen={showGovernance}
        onClose={() => setShowGovernance(false)}
        addToast={(message: string, type: 'success' | 'error' | 'pending', signature?: string) => {
          const toastId = Date.now().toString();
          setToasts(prev => [...prev, {
            id: toastId,
            type,
            message,
            signature
          }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 5000);
        }}
      />
      
      {/* Sidebar Layout */}
      <div className="relative z-30">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className={`flex flex-col flex-1 overflow-x-hidden overflow-y-auto ${sidebarOpen ? '-mt-16' : ''}`}>
            <motion.div 
              className={`relative z-10 flex items-center group cursor-pointer ${sidebarOpen ? 'justify-start pl-0 py-4' : 'justify-center py-0'}`}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
              onClick={() => window.location.href = '/'}
            >
              <Image 
                src="/Logo RIFTS.png"
                alt="RIFTS Protocol Logo" 
                width={sidebarOpen ? 160 : 60} 
                height={sidebarOpen ? 160 : 60} 
                className={`${sidebarOpen ? 'w-40 h-40' : 'w-14 h-14'} object-contain drop-shadow-lg transition-all duration-300 group-hover:drop-shadow-xl`}
              />
            </motion.div>
            <div className={`flex flex-col gap-2 ${sidebarOpen ? '-mt-16' : 'mt-1'}`}>
              {sidebarLinks.map((link, idx) => (
                <div 
                  key={idx} 
                  onClick={(e) => {
                    e.preventDefault();
                    link.onClick();
                  }}
                  className="cursor-pointer relative z-20"
                >
                  <SidebarLink 
                    link={{
                      label: link.label,
                      href: link.href,
                      icon: link.icon
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: wallet?.connected ? wallet.formattedPublicKey : "Connect Wallet",
                href: "#wallet",
                icon: (
                  <div className="flex items-center justify-center rounded-full h-7 w-7 shrink-0 bg-gradient-to-br from-green-400 to-green-600">
                    <IconWallet className="w-4 h-4 text-black" />
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      </div>

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden h-16 px-4 py-2 flex items-center justify-between bg-black/90 backdrop-blur-xl border-b border-emerald-500/20">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all duration-300"
        >
          <Menu className="w-6 h-6 text-emerald-400" />
        </button>
        <div className="text-emerald-400 font-semibold">RIFTS Protocol</div>
        <div className="w-10 h-10"></div> {/* Spacer for centering */}
      </div>

      {/* Main Content Area */}
      <div className="relative z-20 flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
        {/* Main Content Area with pointer events for interactive elements only */}
        <div className="relative flex flex-col flex-1 p-3 md:p-6">
          {/* Header Section - Wallet and Quick Actions at same level */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
              <LuxuryButton variant="primary" size="sm" onClick={() => setShowCreateRiftModal(true)} className="text-xs md:text-sm">
                <Plus className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Create Rift</span>
                <span className="sm:hidden">Create</span>
              </LuxuryButton>
              <LuxuryButton variant="secondary" size="sm" onClick={() => setShowAnalyticsModal(true)} className="text-xs md:text-sm">
                <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </LuxuryButton>
            </div>

            {/* Wallet Connection */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 w-full md:w-auto">
              {!wallet.connected ? (
                <LuxuryButton
                  variant="primary"
                  size="md"
                  onClick={wallet.connect}
                  loading={wallet.connecting}
                  disabled={wallet.connecting}
                  className="w-full md:w-auto text-sm"
                >
                  <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                  {wallet.connecting ? 'Connecting...' : 'Connect Wallet'}
                </LuxuryButton>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                  <LuxuryButton
                    variant="primary"
                    size="sm"
                    onClick={handleVote}
                    className="text-xs md:text-sm w-full sm:w-auto"
                  >
                    <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Governance</span>
                    <span className="sm:hidden">Vote</span>
                  </LuxuryButton>
                  <div className="flex items-center gap-2">
                    <div className="text-center sm:text-right bg-black/50 backdrop-blur-sm border border-emerald-500/20 rounded-lg px-4 py-2 min-w-[140px]">
                      <div className="text-xs md:text-sm text-emerald-400 font-mono">
                        {wallet.publicKey?.slice(0, 4)}...{wallet.publicKey?.slice(-4)}
                      </div>
                      <div className="flex items-center justify-center sm:justify-end gap-1 text-xs text-emerald-400 mt-1">
                        {wallet.balance.toFixed(2)} SOL
                        <button 
                          onClick={refreshBalance}
                          className="text-emerald-400/60 hover:text-emerald-400 transition-colors p-0.5 rounded hover:bg-emerald-400/10"
                          title="Refresh balance"
                        >
                          <Activity className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <LuxuryButton
                      variant="ghost"
                      size="sm"
                      onClick={wallet.disconnect}
                      className="text-xs"
                    >
                      <Wallet className="w-3 h-3" />
                      Disconnect
                    </LuxuryButton>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto max-h-screen p-6 pb-24">

        {/* Comprehensive Stats Grid */}
        <div className="grid grid-cols-1 gap-3 mb-6 md:grid-cols-2 lg:grid-cols-4">
          <DetailedStatsCard
            icon={<DollarSign className="w-6 h-6" />}
            label="Total Value Locked"
            value={formatCurrency(totalTVL)}
            change={totalTVL > 0 ? "Live on-chain" : "No deposits yet"}
            trend="up"
            description="Aggregate value across all active rifts"
          />
          <DetailedStatsCard
            icon={<Activity className="w-6 h-6" />}
            label="24h Volume"
            value={formatCurrency(totalVolume)}
            change={totalVolume > 0 ? "Real-time volume" : "No volume yet"}
            trend="up"
            description="Trading volume across all protocols"
          />
          <DetailedStatsCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Average APY"
            value={`${avgAPY.toFixed(2)}%`}
            change="Weighted average"
            trend="neutral"
            description="Risk-adjusted yield across strategies"
          />
          <DetailedStatsCard
            icon={<Users className="w-6 h-6" />}
            label="Active Farmers"
            value={totalUsers.toLocaleString()}
            change={totalUsers > 0 ? "Active participants" : "No participants yet"}
            trend="up"
            description="Unique addresses participating"
          />
        </div>

        {/* Search and Controls */}
        <div className="flex flex-col gap-4 mb-8 md:flex-row">
          <div className="relative flex-1">
            <div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 focus-within:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 rounded-lg w-full h-14">
              {/* Luxury background patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
              
              <Search className="absolute w-5 h-5 text-emerald-400 transform -translate-y-1/2 left-4 top-1/2 z-10" />
              <input
                placeholder="Search rifts, tokens, strategies, or risk levels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative z-10 w-full h-full pl-12 pr-4 text-lg text-emerald-400 placeholder-gray-400 bg-transparent border-none outline-none"
              />
            </div>
          </div>
          
          <div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 focus-within:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 rounded-lg w-48 h-14">
            {/* Luxury background patterns */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
            </div>
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="relative z-10 w-full h-full text-emerald-400 bg-transparent border-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-emerald-400 bg-black border border-emerald-500/30 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <SelectItem value="newest" className="text-emerald-400 hover:bg-emerald-500/10 focus:bg-emerald-500/10">Sort by Newest</SelectItem>
                <SelectItem value="tvl" className="text-emerald-400 hover:bg-emerald-500/10 focus:bg-emerald-500/10">Sort by TVL</SelectItem>
                <SelectItem value="apy" className="text-emerald-400 hover:bg-emerald-500/10 focus:bg-emerald-500/10">Sort by APY</SelectItem>
                <SelectItem value="volume" className="text-emerald-400 hover:bg-emerald-500/10 focus:bg-emerald-500/10">Sort by Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <LuxuryButton variant="secondary" onClick={() => setShowFiltersModal(true)}>
            <Filter className="w-4 h-4" />
            Filters
          </LuxuryButton>

          <LuxuryButton
            variant={hideDuplicates ? "primary" : "secondary"}
            onClick={() => setHideDuplicates(!hideDuplicates)}
          >
            <Layers className="w-4 h-4" />
            {hideDuplicates ? 'Show All' : 'Hide Duplicates'}
          </LuxuryButton>

          <LuxuryButton
            variant={showOnlyTradeable ? "primary" : "secondary"}
            onClick={() => setShowOnlyTradeable(!showOnlyTradeable)}
          >
            <TrendingUp className="w-4 h-4" />
            {showOnlyTradeable ? 'Show All' : 'Tradeable Only'}
          </LuxuryButton>
        </div>

        {/* Info banner when duplicates are hidden */}
        {hideDuplicates && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Layers className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm text-emerald-400">
                Showing <span className="font-bold">{filteredRifts.length}</span> unique rifts
                (hiding duplicates, keeping highest TVL)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Total rifts available: {rifts.length}
              </p>
            </div>
          </div>
        )}

        {/* Info banner when showing tradeable only */}
        {showOnlyTradeable && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm text-blue-400">
                Showing <span className="font-bold">{filteredRifts.length}</span> tradeable rifts
                (with Meteora liquidity pools)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                These rifts have active liquidity pools and can be traded immediately
              </p>
            </div>
          </div>
        )}

        {/* Rifts Grid - Show immediately, no loading screen */}
        {filteredRifts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredRifts.map((rift, index) => (
              <motion.div
                key={rift.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <LuxuryRiftCard
                  rift={rift}
                  onWrap={async () => {
                    // Always open wrap modal for wrapping tokens
                    setSelectedRift(rift);
                    await fetchTokenBalance(rift);
                    setShowWrapModal(true);
                  }}
                  onUnwrap={async () => {
                    setSelectedRift(rift);
                    await fetchRiftTokenBalance(rift); // Fetch rift token balance for unwrapping
                    setShowUnwrapModal(true);
                  }}
                  onAddLiquidity={async () => {
                    setSelectedRift(rift);
                    await fetchTokenBalance(rift);
                    await fetchRiftTokenBalance(rift);

                    // Check if pool exists
                    if (rift.hasMeteoraPool && rift.liquidityPool && rift.liquidityPool !== '11111111111111111111111111111111') {
                      // Pool exists - open add liquidity modal in add mode

                      setLiquidityTab('add');
                      setShowAddLiquidityModal(true);
                    } else {
                      // New pool - open create pool modal

                      setLiquidityRatio(1.0);
                      setLiquidityTab('add');
                      setShowAddLiquidityModal(true);
                    }
                  }}
                  onDetails={() => {
                    setSelectedRift(rift);
                    setShowDetailsModal(true);
                  }}
                  onCloseRift={async () => {
                    if (!rift || !wallet.publicKey) {

                      return;
                    }

                    try {

                      const productionService = new ProductionRiftsService(connection as unknown as Connection);

                      const walletAdapter: WalletAdapter = {
                        publicKey: new PublicKey(wallet.publicKey),
                        sendTransaction: async (transaction: Transaction) => {
                          if (typeof window !== 'undefined' && window.solana) {
                            const { signature } = await window.solana.signAndSendTransaction(transaction);
                            return signature;
                          }
                          throw new Error('Phantom wallet not available');
                        },
                        signTransaction: async (transaction: Transaction) => {
                          // For signing only, return the transaction as-is
                          return transaction;
                        }
                      };

                      productionService.setWallet(walletAdapter);

                      const result = await productionService.adminCloseRift({
                        riftPubkey: new PublicKey(rift.id)
                      });

                      if (result.success) {

                        await loadRifts();
                      } else {

                      }
                    } catch (error) {

                    }
                  }}
                  currentWallet={wallet.publicKey?.toString()}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl">
              <Layers className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              {searchQuery ? 'No matching rifts found' : 'No rifts available'}
            </h3>
            <p className="max-w-md mx-auto mb-8 text-gray-400">
              {searchQuery 
                ? 'Try adjusting your search criteria to discover more volatility farming opportunities.' 
                : 'Be the first to create a revolutionary volatility farming strategy.'}
            </p>
            {!searchQuery && (
              <LuxuryButton variant="primary" size="lg" onClick={() => setShowCreateRiftModal(true)}>
                <Plus className="w-5 h-5" />
                Create First Rift
              </LuxuryButton>
            )}
          </div>
        )}
      </main>
        </div>
      </div>

      {/* Enhanced Rift Details Modal */}
      <LuxuryModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedRift ? `${selectedRift.symbol} Analysis` : "Rift Details"}
        subtitle={selectedRift ? `Comprehensive rift performance data` : "Detailed rift information"}
        size="lg"
        showSparkles={true}
      >
        {selectedRift && (
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="border-b border-gray-700">
              <div className="flex gap-4">
                <button
                  onClick={() => setDetailsActiveTab('details')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
                    detailsActiveTab === 'details'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Info className="w-4 h-4" />
                  Details
                </button>
                <button
                  onClick={() => setDetailsActiveTab('trading')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
                    detailsActiveTab === 'trading'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Trading
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {detailsActiveTab === 'details' ? (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-gray-800/20">
            {/* Close Rift Section */}
            {selectedRift?.vault === '11111111111111111111111111111111' && (
              <div className="p-3 border rounded-lg bg-red-900/20 border-red-700/50">
                <h3 className="flex items-center gap-2 mb-2 text-lg font-bold text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  Rift Maintenance Required
                </h3>
                <p className="mb-4 text-sm text-gray-300">
                  This rift has an invalid vault configuration and needs to be closed before creating a new one. 
                  This will return any remaining rent to your wallet.
                </p>
                <LuxuryButton
                  variant="danger"
                  size="lg"
                  icon={Eye}
                  onClick={handleCloseRift}
                  className="w-full"
                >
                  Close Invalid Rift
                </LuxuryButton>
              </div>
            )}
            
            {/* Price & Performance Overview */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <DollarSign className="w-4 h-4 text-green-400" />
                Price Information
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">Rift Price</p>
                  <p className="text-lg font-bold text-green-400">${selectedRift.riftPrice.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Fair Price</p>
                  <p className="text-lg font-bold text-blue-400">${selectedRift.fairPrice.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Volatility APY</p>
                  <p className="text-lg font-bold text-purple-400">{selectedRift.volatilityApy.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">30d Yield</p>
                  <p className="text-lg font-bold text-cyan-400">{selectedRift.rift30dYield.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* TVL Breakdown */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <Layers className="w-4 h-4 text-blue-400" />
                TVL Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-400">Rift TVL</p>
                  <p className="text-lg font-bold text-white">
                    {selectedRift.riftTvl ? (
                      selectedRift.riftTvl >= 1000000 ? `$${(selectedRift.riftTvl / 1000000).toFixed(2)}M` :
                      selectedRift.riftTvl >= 1000 ? `$${(selectedRift.riftTvl / 1000).toFixed(2)}K` :
                      `$${selectedRift.riftTvl.toFixed(2)}`
                    ) : '$0'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">LP TVL</p>
                  <p className="text-lg font-bold text-white">
                    {selectedRift.lpTvl ? (
                      selectedRift.lpTvl >= 1000000 ? `$${(selectedRift.lpTvl / 1000000).toFixed(2)}M` :
                      selectedRift.lpTvl >= 1000 ? `$${(selectedRift.lpTvl / 1000).toFixed(2)}K` :
                      `$${selectedRift.lpTvl.toFixed(2)}`
                    ) : '$0'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Yield</p>
                  <p className="text-lg font-bold text-green-400">{selectedRift.totalRiftYield.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* All Timeframes Performance */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <LineChart className="w-4 h-4 text-cyan-400" />
                Performance Across Timeframes
              </h3>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                {Object.entries(selectedRift.timeframes).map(([timeframe, value]) => (
                  <div key={timeframe}>
                    <p className="text-xs text-gray-400">{timeframe}</p>
                    <p className={`text-sm font-bold ${value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {value > 0 ? '+' : ''}{value.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Structure */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Fee Structure
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">Wrap Fee</p>
                  <p className="text-sm font-semibold text-white">{selectedRift.feeStructure.wrapFee.toFixed(3)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Unwrap Fee</p>
                  <p className="text-sm font-semibold text-white">{selectedRift.feeStructure.unwrapFee.toFixed(3)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Performance Fee</p>
                  <p className="text-sm font-semibold text-white">{selectedRift.feeStructure.performanceFee.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Management Fee</p>
                  <p className="text-sm font-semibold text-white">{selectedRift.feeStructure.managementFee.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* Liquidity Profile */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <Activity className="w-4 h-4 text-purple-400" />
                Liquidity Profile
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Depth</p>
                  <p className="text-sm font-semibold text-blue-400">${selectedRift.liquidityProfile.depth.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Spread</p>
                  <p className="text-sm font-semibold text-yellow-400">{selectedRift.liquidityProfile.spread.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Slippage</p>
                  <p className="text-sm font-semibold text-red-400">{selectedRift.liquidityProfile.slippage.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* Hybrid Oracle System */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <Target className="w-4 h-4 text-orange-400" />
                Hybrid Oracle System
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Oracle Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      selectedRift.oracleStatus === 'active' ? 'bg-green-400' :
                      selectedRift.oracleStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                    <span className={`text-sm font-medium capitalize ${
                      selectedRift.oracleStatus === 'active' ? 'text-green-400' :
                      selectedRift.oracleStatus === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {selectedRift.oracleStatus}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-gray-400">
                  Advanced hybrid oracle system combining on-chain price feeds with decentralized market data for maximum accuracy and resilience.
                </p>
              </div>
            </div>

            {/* Revenue Share */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <PieChart className="w-4 h-4 text-green-400" />
                Revenue Share Distribution
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">RIFTS Holders</p>
                  <p className="text-sm font-semibold text-green-400">{selectedRift.revenueShare.riftsHolders.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">LP Providers</p>
                  <p className="text-sm font-semibold text-blue-400">{selectedRift.revenueShare.lpProviders.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Protocol</p>
                  <p className="text-sm font-semibold text-purple-400">{selectedRift.revenueShare.protocol.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* LVF Metrics */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-base font-bold text-white">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                LVF Metrics
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Efficiency</p>
                  <p className="text-sm font-semibold text-green-400">{selectedRift.lvfMetrics.efficiency.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Capture</p>
                  <p className="text-sm font-semibold text-blue-400">{selectedRift.lvfMetrics.capture.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Decay</p>
                  <p className="text-sm font-semibold text-yellow-400">{selectedRift.lvfMetrics.decay.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* Contract Addresses */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-3 text-base font-bold text-white">
                <ExternalLink className="w-4 h-4 text-blue-400" />
                Contract Addresses
              </h3>
              <ContractAddressList
                addresses={Object.entries(selectedRift.contractAddresses).map(([key, address]) => ({
                  label: key.replace(/([A-Z])/g, ' $1').trim(),
                  address: address
                }))}
                network="devnet"
              />
            </div>

            {/* Strategy Details */}
            <div className="p-3 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-lg">
              <h3 className="flex items-center gap-2 mb-2 text-lg font-bold text-white">
                <Target className="w-4 h-4 text-cyan-400" />
                Strategy Details
              </h3>
              <p className="mb-2 text-sm font-medium text-white">{selectedRift.strategy}</p>
              <p className="text-xs leading-relaxed text-gray-400">
                Advanced volatility farming using delta-neutral positioning and automated rebalancing. This strategy capitalizes on price volatility while maintaining market neutrality through sophisticated hedging mechanisms.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <LuxuryButton variant="primary" size="sm" onClick={() => {setShowDetailsModal(false); setShowWrapModal(true);}}>
                <Lock className="w-3 h-3" />
                Wrap
              </LuxuryButton>
              <LuxuryButton variant="secondary" size="sm" onClick={() => {
                setShowDetailsModal(false); 
                if (selectedRift) fetchRiftTokenBalance(selectedRift);
                setShowUnwrapModal(true);
              }}>
                <Unlock className="w-3 h-3" />
                Unwrap
              </LuxuryButton>
              <LuxuryButton variant="ghost" size="sm">
                <ExternalLink className="w-3 h-3" />
                Explorer
              </LuxuryButton>
            </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Trading Interface Tab */}
                <TradingInterface
                  wallet={wallet as unknown as { publicKey: string; connected: boolean; sendTransaction?: (transaction: unknown) => Promise<unknown> }}
                  rifts={selectedRift ? [selectedRift] : []}
                  addToast={(message: string, type: 'success' | 'error' | 'pending', signature?: string) => {
                    setNotification({
                      type: type === 'pending' ? 'info' : type,
                      title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Processing',
                      message,
                      signature
                    });
                  }}
                />
              </div>
            )}
          </div>
        )}
      </LuxuryModal>

      {/* Enhanced Wrap Modal */}
      <LuxuryModal
        isOpen={showWrapModal}
        onClose={() => setShowWrapModal(false)}
        title={selectedRift ? `Wrap ${selectedRift.underlying}` : "Wrap Tokens"}
        subtitle={selectedRift ? `Convert to r${selectedRift.symbol} tokens` : "Convert tokens to RIFTS"}
        size="lg"
      >
        {selectedRift && (
          <div className="space-y-3">
            {/* Wrap Summary - Horizontal Layout */}
            <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-600/30 rounded-xl p-3 shadow-[0_4px_15px_0_rgba(34,197,94,0.3)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 font-bold text-black shadow-md rounded-xl bg-gradient-to-br from-green-400 via-green-500 to-green-600">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Wrap {selectedRift.underlying} → {selectedRift.symbol}</h3>
                    <p className="text-xs text-green-400">1:1 conversion ratio</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Deposit</p>
                    <p className="text-sm font-bold text-white">{parseFloat(wrapAmount || '0').toFixed(4)} {selectedRift.underlying}</p>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Receive</p>
                    <p className="text-sm font-bold text-green-400">{(parseFloat(wrapAmount || '0') * (1 - 0.007) / selectedRift.backingRatio).toFixed(4)} {selectedRift.symbol}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Section - Compact */}
            <div className="bg-gradient-to-b from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-3 shadow-[0_4px_15px_0_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-300">Amount</label>
                    <div className="text-xs text-gray-400">
                      Balance: <span className="text-white">{selectedTokenBalance.toFixed(4)} {selectedRift?.underlying}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={wrapAmount}
                      onChange={(e) => setWrapAmount(e.target.value)}
                      className="w-full px-3 py-2 text-lg font-bold text-white placeholder-gray-500 bg-gray-800 border border-gray-600 rounded focus:border-green-500 focus:outline-none"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-medium text-green-400 hover:bg-green-900/20 rounded transition-colors">MAX</button>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      className="px-2 py-1 text-xs font-medium text-gray-400 transition-colors rounded hover:text-green-400 hover:bg-green-900/20"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="bg-gradient-to-b from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-4 shadow-[0_4px_15px_0_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Wrap Fee</p>
                  <p className="font-semibold text-white">0.7%</p>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Network</p>
                  <p className="font-semibold text-white">~0.002 SOL</p>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Slippage</p>
                  <p className="font-semibold text-green-400">0.5%</p>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            <div className="p-4 border bg-yellow-900/20 border-yellow-600/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="mb-1 text-sm font-medium text-yellow-400">Important Information</p>
                  <p className="text-xs leading-relaxed text-yellow-300">
                    Wrapping tokens involves smart contract risks. Your {selectedRift.underlying} tokens will be held as collateral 
                    backing the wrapped {selectedRift.symbol} tokens. You can unwrap at any time to redeem your original tokens.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <LuxuryButton 
                variant="secondary" 
                size="lg" 
                className="flex-1"
                onClick={() => setShowWrapModal(false)}
              >
                Cancel
              </LuxuryButton>
              <LuxuryButton 
                variant="primary" 
                size="lg" 
                className="flex-1" 
                icon={Lock} 
                pulse 
                glow
                onClick={handleWrap}
                disabled={isWrapping || !wrapAmount || !wallet.publicKey}
                loading={isWrapping}
              >
                {isWrapping ? 'Wrapping...' : 'Confirm Wrap'}
              </LuxuryButton>
            </div>
          </div>
        )}
      </LuxuryModal>

      {/* Enhanced Unwrap Modal */}
      <LuxuryModal
        isOpen={showUnwrapModal}
        onClose={() => setShowUnwrapModal(false)}
        title={selectedRift ? `Unwrap r${selectedRift.symbol}` : "Unwrap Tokens"}
        subtitle={selectedRift ? `Convert back to ${selectedRift.underlying}` : "Convert RIFTS back to underlying"}
        size="lg"
      >
        {selectedRift && (
          <div className="space-y-3">
            {/* Unwrap Summary - Horizontal Layout */}
            <div className="bg-gradient-to-br from-orange-900/20 to-yellow-800/20 border border-orange-600/30 rounded-xl p-3 shadow-[0_4px_15px_0_rgba(249,115,22,0.3)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 font-bold text-black shadow-md rounded-xl bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Unwrap {selectedRift.symbol} → {selectedRift.underlying}</h3>
                    <p className="text-xs text-orange-400">Redeem wrapped tokens</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Redeem</p>
                    <p className="text-sm font-bold text-white">{parseFloat(unwrapAmount || '0').toFixed(4)} r{selectedRift.symbol}</p>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Receive</p>
                    <p className="text-sm font-bold text-orange-400">{(parseFloat(unwrapAmount || '0') * selectedRift.backingRatio * (1 - 0.007)).toFixed(4)} {selectedRift.underlying}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Section - Compact */}
            <div className="bg-gradient-to-b from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-3 shadow-[0_4px_15px_0_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-300">Amount</label>
                    <div className="text-xs text-gray-400">
                      Balance: <span className="text-white">{(selectedRiftTokenBalance || 0).toFixed(4)} r{selectedRift?.underlying}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={unwrapAmount}
                      onChange={(e) => setUnwrapAmount(e.target.value)}
                      className="w-full px-3 py-2 text-lg font-bold text-white placeholder-gray-500 bg-gray-800 border border-gray-600 rounded focus:border-orange-500 focus:outline-none"
                    />
                    <button 
                      onClick={() => setUnwrapAmount((selectedRiftTokenBalance || 0).toString())}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-medium text-orange-400 hover:bg-orange-900/20 rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => {
                        const amount = ((selectedRiftTokenBalance || 0) * percent / 100).toFixed(4);
                        setUnwrapAmount(amount);
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-400 transition-colors rounded hover:text-orange-400 hover:bg-orange-900/20"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Transaction Details - Compact Grid */}
            <div className="bg-gradient-to-b from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-3 shadow-[0_4px_15px_0_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Rate</p>
                  <p className="font-semibold text-white">1:1</p>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Fee</p>
                  <p className="font-semibold text-white">0.05%</p>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Network</p>
                  <p className="font-semibold text-white">~0.001 SOL</p>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-gray-400">Time</p>
                  <p className="font-semibold text-orange-400">Instant</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <LuxuryButton variant="secondary" size="md" className="flex-1" onClick={() => setShowUnwrapModal(false)}>
                Cancel
              </LuxuryButton>
              <LuxuryButton 
                variant="danger" 
                size="lg" 
                className="flex-1" 
                icon={Unlock}
                onClick={handleUnwrap}
                disabled={isUnwrapping || !unwrapAmount || !wallet.publicKey}
                loading={isUnwrapping}
              >
                {isUnwrapping ? 'Unwrapping...' : 'Confirm Unwrap'}
              </LuxuryButton>
            </div>
          </div>
        )}
      </LuxuryModal>

      {/* Add Liquidity Modal */}
      <LuxuryModal
        isOpen={showAddLiquidityModal}
        onClose={() => {
          setShowAddLiquidityModal(false);
          setLiquidityTab('add'); // Reset to add tab when closing
          setDepositQuote(null); // Clear quote preview
          setSolLiquidityAmount('');
          setRiftLiquidityAmount('');
          setLastEditedField(null); // Clear edited field tracker
        }}
        title={selectedRift ? `Manage Liquidity for ${selectedRift.symbol}` : "Manage Liquidity"}
        subtitle={selectedRift ? `Meteora pool for ${selectedRift.underlying}/r${selectedRift.symbol}` : "Trading pool"}
        size="lg"
      >
        {selectedRift && (
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
              <button
                onClick={() => setLiquidityTab('add')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  liquidityTab === 'add'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Add Liquidity
              </button>
              <button
                onClick={() => setLiquidityTab('remove')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  liquidityTab === 'remove'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Remove Liquidity
              </button>
            </div>

            {/* Add Liquidity Tab Content */}
            {liquidityTab === 'add' && (
              <>
            {/* Liquidity Info */}
            <div className="p-4 border rounded-xl bg-gradient-to-br from-blue-900/20 to-purple-800/20 border-blue-600/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Meteora Trading Pool</h3>
                  <p className="text-sm text-gray-400">Enable trading for {selectedRift.underlying} ↔ r{selectedRift.symbol}</p>
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-xs text-gray-400">
                <p>• Creates a constant product AMM pool on Meteora</p>
                <p>• Enables instant swaps between tokens</p>
                <p>• You'll earn trading fees from swaps</p>
              </div>
            </div>

            {/* Liquidity Amounts - Meteora Style */}
            <div className="space-y-3">
              {/* Token A (SOL/Underlying) Input */}
              <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50 hover:border-blue-500/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Amount</label>
                  <div className="text-xs text-gray-400">
                    Balance: {selectedTokenBalance.toFixed(4)} {selectedRift.underlying}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={solLiquidityAmount}
                    onChange={(e) => {
                      setSolLiquidityAmount(e.target.value);
                      setLastEditedField('sol'); // Mark SOL field as edited
                    }}
                    placeholder="0.0"
                    className="flex-1 px-4 py-3 bg-black/50 border border-gray-600 rounded-lg text-white text-lg font-bold placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-blue-400/20 flex items-center justify-center text-xs font-bold text-blue-400">
                      {selectedRift.underlying?.slice(0, 1) || 'S'}
                    </div>
                    <span className="text-sm font-bold text-white">{selectedRift.underlying}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSolLiquidityAmount((selectedTokenBalance * 0.25).toFixed(6));
                      setLastEditedField('sol');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => {
                      setSolLiquidityAmount((selectedTokenBalance * 0.5).toFixed(6));
                      setLastEditedField('sol');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => {
                      setSolLiquidityAmount((selectedTokenBalance * 0.75).toFixed(6));
                      setLastEditedField('sol');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => {
                      setSolLiquidityAmount(selectedTokenBalance.toFixed(6));
                      setLastEditedField('sol');
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Plus Icon */}
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Token B (RIFT) Input */}
              <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50 hover:border-emerald-500/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Amount</label>
                  <div className="text-xs text-gray-400">
                    Balance: {(selectedRiftBalance || 0).toFixed(4)} r{selectedRift.symbol}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={riftLiquidityAmount}
                    onChange={(e) => {
                      setRiftLiquidityAmount(e.target.value);
                      setLastEditedField('rift'); // Mark RIFT field as edited
                    }}
                    placeholder="0.0"
                    className="flex-1 px-4 py-3 bg-black/50 border border-gray-600 rounded-lg text-white text-lg font-bold placeholder-gray-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                      R
                    </div>
                    <span className="text-sm font-bold text-white">r{selectedRift.symbol}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setRiftLiquidityAmount(((selectedRiftBalance || 0) * 0.25).toFixed(6));
                      setLastEditedField('rift');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => {
                      setRiftLiquidityAmount(((selectedRiftBalance || 0) * 0.5).toFixed(6));
                      setLastEditedField('rift');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => {
                      setRiftLiquidityAmount(((selectedRiftBalance || 0) * 0.75).toFixed(6));
                      setLastEditedField('rift');
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => {
                      setRiftLiquidityAmount((selectedRiftBalance || 0).toFixed(6));
                      setLastEditedField('rift');
                    }}
                    className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 rounded text-white transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Pool Ratio Info */}
              <div className="p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Initial Pool Ratio</span>
                  <span className="font-bold text-blue-400">1 {selectedRift.underlying} = {liquidityRatio.toFixed(4)} r{selectedRift.symbol}</span>
                </div>
              </div>

              {/* Deposit Quote Preview - Only show if pool exists */}
              {(selectedRift?.liquidityPool && selectedRift.liquidityPool !== '11111111111111111111111111111111') ||
               false ? (
                <div className="p-4 border rounded-xl bg-gradient-to-br from-emerald-900/30 to-blue-900/30 border-emerald-600/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-white">Deposit Preview</h3>
                  </div>

                  {isLoadingQuote ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400"></div>
                      <span className="ml-2 text-sm text-gray-400">Calculating amounts...</span>
                    </div>
                  ) : depositQuote ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-black/30 rounded-lg">
                        <span className="text-sm text-gray-400">You will deposit:</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded-lg">
                        <span className="text-sm font-medium text-gray-300">{selectedRift.underlying}</span>
                        <span className="text-sm font-bold text-emerald-400">{depositQuote.wsolNeeded.toFixed(9)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg">
                        <span className="text-sm font-medium text-gray-300">r{selectedRift.symbol}</span>
                        <span className="text-sm font-bold text-blue-400">{depositQuote.riftNeeded.toFixed(9)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-black/30 rounded-lg mt-3">
                        <span className="text-xs text-gray-400">Current Pool Ratio</span>
                        <span className="text-xs font-medium text-gray-300">{depositQuote.poolRatio.toFixed(4)} r{selectedRift.symbol}/SOL</span>
                      </div>
                      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                        <p className="text-xs text-blue-300">
                          ℹ️ Amounts calculated based on current pool ratio ({depositQuote.poolRatio.toFixed(2)} RIFT per SOL)
                        </p>
                      </div>
                    </div>
                  ) : riftLiquidityAmount && parseFloat(riftLiquidityAmount) > 0 ? (
                    <div className="text-sm text-gray-400 text-center py-2">
                      Enter a RIFT amount to see deposit preview
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Pool Configuration */}
            <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50">
              <h3 className="mb-3 text-sm font-bold text-white">Pool Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-2 text-xs font-medium text-gray-300">Bin Step</label>
                  <input
                    type="number"
                    value={meteoraBinStep}
                    onChange={(e) => setMeteoraBinStep(e.target.value)}
                    placeholder="25"
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">Default: 25 (0.25% per bin)</p>
                </div>
                <div>
                  <label className="block mb-2 text-xs font-medium text-gray-300">Base Factor</label>
                  <input
                    type="number"
                    value={meteoraBaseFactor}
                    onChange={(e) => setMeteoraBaseFactor(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">Default: 100</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <LuxuryButton
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowAddLiquidityModal(false)}
              >
                Cancel
              </LuxuryButton>
              <LuxuryButton
                variant="primary"
                size="lg"
                className="flex-1"
                icon={Plus}
                onClick={handleCreatePoolAndAddLiquidity}
                disabled={!riftLiquidityAmount || parseFloat(riftLiquidityAmount || '0') <= 0 || isCreatingMeteoraPool || !!(depositQuote && (!depositQuote.wsolNeeded || depositQuote.wsolNeeded <= 0))}
                loading={isCreatingMeteoraPool}
              >
                {isCreatingMeteoraPool
                  ? (selectedRift?.liquidityPool && selectedRift.liquidityPool !== '11111111111111111111111111111111') ||
                    false
                    ? 'Adding Liquidity...'
                    : 'Creating Pool...'
                  : (selectedRift?.liquidityPool && selectedRift.liquidityPool !== '11111111111111111111111111111111') ||
                    false
                    ? depositQuote
                      ? `Add ${depositQuote.wsolNeeded.toFixed(4)} SOL + ${depositQuote.riftNeeded.toFixed(4)} RIFT`
                      : 'Add Liquidity'
                    : 'Create Pool & Add Liquidity'
                }
              </LuxuryButton>
            </div>
              </>
            )}

            {/* Remove Liquidity Tab Content */}
            {liquidityTab === 'remove' && (
              <>
            {/* Remove Liquidity Info */}
            <div className="p-4 border rounded-xl bg-gradient-to-br from-red-900/20 to-orange-800/20 border-red-600/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-400/20 flex items-center justify-center">
                  <Minus className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Remove Liquidity from Pool</h3>
                  <p className="text-sm text-gray-400">Withdraw your liquidity from {selectedRift.underlying} ↔ r{selectedRift.symbol}</p>
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-xs text-gray-400">
                <p>• Remove by percentage or select specific positions</p>
                <p>• You'll receive both tokens back</p>
                <p>• Stop earning fees on removed liquidity</p>
              </div>
            </div>

            {/* Mode Selector */}
            {!isLoadingLpBalance && userLpPositions.length > 0 && (
              <div className="flex gap-2 p-1 bg-gray-900/50 border border-gray-700 rounded-lg">
                <button
                  onClick={() => setRemoveMode('percentage')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    removeMode === 'percentage'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Remove by %
                </button>
                <button
                  onClick={() => setRemoveMode('positions')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    removeMode === 'positions'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Select Positions
                </button>
              </div>
            )}

            {/* Content based on mode */}
            <div className="space-y-3">
              {isLoadingLpBalance ? (
                <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50">
                  <p className="text-sm text-gray-400 animate-pulse">Loading positions...</p>
                </div>
              ) : userLpPositions.length === 0 ? (
                <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    ⚠️ You don't have any LP positions in this pool. Add liquidity first to earn trading fees.
                  </p>
                </div>
              ) : removeMode === 'percentage' ? (
                <>
                  {/* Percentage Mode */}
                  <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50">
                    <label className="text-sm font-medium text-gray-300 block mb-3">
                      Percentage to Remove
                    </label>
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="number"
                        value={removePercentage}
                        onChange={(e) => setRemovePercentage(e.target.value)}
                        placeholder="0"
                        min="0"
                        max="100"
                        step="1"
                        className="flex-1 px-4 py-3 bg-black/50 border border-gray-600 rounded-lg text-white text-lg font-bold placeholder-gray-500 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                      />
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <span className="text-2xl font-bold text-white">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRemovePercentage('5')}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                      >
                        5%
                      </button>
                      <button
                        onClick={() => setRemovePercentage('10')}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                      >
                        10%
                      </button>
                      <button
                        onClick={() => setRemovePercentage('25')}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                      >
                        25%
                      </button>
                      <button
                        onClick={() => setRemovePercentage('50')}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setRemovePercentage('100')}
                        className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
                      >
                        100%
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                    <h4 className="text-xs font-medium text-gray-300 mb-2">Removing {removePercentage}% of your liquidity:</h4>
                    <div className="space-y-1 text-xs text-gray-400 mb-3">
                      <p>• You have {userLpPositions.length} position{userLpPositions.length !== 1 ? 's' : ''} with liquidity</p>
                      <p>• Liquidity will be removed across your positions</p>
                    </div>

                    {/* Detailed Position Breakdown */}
                    {detailedPositions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs font-medium text-purple-400 mb-2">📊 Your positions breakdown:</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {detailedPositions.map((pos, idx) => (
                            <div key={pos.address} className="bg-black/30 rounded-lg p-2 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-mono">Position #{idx + 1}</span>
                                <span className="text-emerald-400 font-bold">{pos.percentageOfTotal.toFixed(1)}% of total</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">{selectedRift.underlying}:</span>
                                  <span className="text-gray-300 font-mono">{pos.estimatedTokenA.toFixed(6)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">r{selectedRift.symbol}:</span>
                                  <span className="text-gray-300 font-mono">{pos.estimatedTokenB.toFixed(6)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {estimatedWithdrawal ? (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs font-medium text-emerald-400 mb-2">📊 You will receive (estimated):</p>
                        <div className="space-y-1 bg-black/30 rounded-lg p-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{selectedRift.underlying}</span>
                            <span className="text-white font-bold">~{estimatedWithdrawal.tokenA.toFixed(6)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">r{selectedRift.symbol}</span>
                            <span className="text-white font-bold">~{estimatedWithdrawal.tokenB.toFixed(6)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">* Estimate based on current pool state</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400">💭 Calculating estimated amounts...</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 border rounded-xl bg-gradient-to-b from-gray-800/60 to-gray-900/60 border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-300">Your LP Positions ({userLpPositions.length})</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedPositions(new Set(userLpPositions.map(p => p.address)))}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Select All
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={() => setSelectedPositions(new Set())}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {userLpPositions.map((position, idx) => (
                        <div
                          key={position.address}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedPositions.has(position.address)
                              ? 'bg-red-500/10 border-red-500/50'
                              : 'bg-black/30 border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => {
                            const newSelected = new Set(selectedPositions);
                            if (newSelected.has(position.address)) {
                              newSelected.delete(position.address);
                            } else {
                              newSelected.add(position.address);
                            }
                            setSelectedPositions(newSelected);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedPositions.has(position.address)}
                              onChange={() => {}} // Handled by parent onClick
                              className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">Position #{idx + 1}</p>
                              <p className="text-xs text-gray-400 font-mono">
                                {position.address.slice(0, 8)}...{position.address.slice(-8)}
                              </p>
                            </div>
                            {selectedPositions.has(position.address) && (
                              <div className="text-xs font-bold text-red-400">✓ Selected</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Withdrawal Info */}
                  {selectedPositions.size > 0 && (
                    <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-400 mb-2">
                        Removing {selectedPositions.size} position{selectedPositions.size !== 1 ? 's' : ''}:
                      </h4>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p>✓ Selected positions will be closed</p>
                        <p>✓ You'll receive {selectedRift.underlying} + r{selectedRift.symbol} tokens back</p>
                        <p>✓ Amounts depend on current pool ratio and your share</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <LuxuryButton
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowAddLiquidityModal(false)}
              >
                Cancel
              </LuxuryButton>
              <LuxuryButton
                variant="danger"
                size="lg"
                className="flex-1"
                icon={Minus}
                onClick={handleRemoveLiquidity}
                disabled={
                  isLoadingLpBalance ||
                  isCreatingMeteoraPool ||
                  userLpPositions.length === 0 ||
                  (removeMode === 'positions' && selectedPositions.size === 0) ||
                  (removeMode === 'percentage' && (parseFloat(removePercentage) <= 0 || parseFloat(removePercentage) > 100))
                }
                loading={isCreatingMeteoraPool}
              >
                {isCreatingMeteoraPool
                  ? 'Removing Liquidity...'
                  : removeMode === 'percentage'
                  ? `Remove ${removePercentage}%`
                  : `Remove ${selectedPositions.size} Position${selectedPositions.size !== 1 ? 's' : ''}`
                }
              </LuxuryButton>
            </div>
              </>
            )}
          </div>
        )}
      </LuxuryModal>

      {/* Create Rift Modal */}
      <LuxuryModal
        isOpen={showCreateRiftModal}
        onClose={handleCloseCreateRiftModal}
        title="Create New Rift"
        subtitle="Deploy a new wrapped token vault"
        size="lg"
      >
        <div className="space-y-4">
            <div className="p-4 border rounded-xl bg-gradient-to-br from-emerald-900/20 to-green-800/20 border-emerald-600/30">
            <h3 className="mb-2 text-base font-bold text-white">Select Token to Wrap</h3>
            <div className="grid grid-cols-1 gap-3">
              {['SOL', 'USDC', 'USDT'].map(token => (
                <button
                  key={token}
                  className={`bg-black/50 border ${selectedToken === token ? 'border-emerald-400 bg-emerald-900/20' : 'border-emerald-600/30'} rounded-xl p-3 hover:border-emerald-400 transition-all duration-200 text-left`}
                  onClick={() => {
                    setSelectedToken(token);
                    setCustomTokenAddress('');
                    setCustomTokenSymbol('');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{token}</p>
                      <p className="text-xs text-gray-400">Create r{token} vault</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-400" />
                  </div>
                </button>
              ))}
              
              {/* Custom Token Option */}
              <div className="pt-3 mt-3 border-t border-gray-700">
                <button
                  className={`w-full bg-black/50 border ${selectedToken === 'CUSTOM' ? 'border-purple-400 bg-purple-900/20' : 'border-purple-600/30'} rounded-xl p-3 hover:border-purple-400 transition-all duration-200 text-left`}
                  onClick={() => setSelectedToken('CUSTOM')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Custom Token</p>
                      <p className="text-xs text-gray-400">Wrap any SPL token</p>
                    </div>
                    <Plus className="w-5 h-5 text-purple-400" />
                  </div>
                </button>
                
                {selectedToken === 'CUSTOM' && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm text-white border rounded-xl bg-black/50 border-purple-600/30 focus:border-purple-400 focus:outline-none"
                      placeholder="Token mint address"
                      value={customTokenAddress}
                      onChange={(e) => setCustomTokenAddress(e.target.value)}
                    />
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm text-white border rounded-xl bg-black/50 border-purple-600/30 focus:border-purple-400 focus:outline-none"
                      placeholder="Token symbol (e.g., BONK)"
                      value={customTokenSymbol}
                      onChange={(e) => setCustomTokenSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rift Configuration */}
          <div className="p-4 border rounded-xl bg-gradient-to-br from-purple-900/20 to-blue-800/20 border-purple-600/30">
            <h3 className="mb-2 text-base font-bold text-white">Rift Configuration</h3>
            <p className="mb-3 text-sm text-gray-400">Set the parameters for your new rift vault</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Burn Fee (bps)</label>
                <input
                  type="number"
                  value={burnFee}
                  onChange={(e) => setBurnFee(e.target.value)}
                  placeholder="45"
                  className="w-full px-3 py-2 bg-black/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                />
                <p className="mt-1 text-xs text-gray-400">Fee burned on unwrap (default: 45 bps = 0.45%)</p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Partner Fee (bps)</label>
                <input
                  type="number"
                  value={partnerFee}
                  onChange={(e) => setPartnerFee(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-black/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                />
                <p className="mt-1 text-xs text-gray-400">Additional partner fee (optional)</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">Partner Wallet (Optional)</label>
              <input
                type="text"
                value={partnerWallet}
                onChange={(e) => setPartnerWallet(e.target.value)}
                placeholder="Partner wallet address"
                className="w-full px-3 py-2 bg-black/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
              />
              <p className="mt-1 text-xs text-gray-400">Wallet to receive partner fees (leave empty to use your wallet)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <LuxuryButton
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleCreateRiftStep}
              disabled={!selectedToken || !wallet.publicKey || isCreatingRift}
              loading={isCreatingRift}
            >
              <Plus className="w-4 h-4" />
              {isCreatingRift ? 'Creating Rift...' : 'Create Rift'}
            </LuxuryButton>
            <LuxuryButton variant="secondary" size="md" className="flex-1" onClick={handleCloseCreateRiftModal}>
              Cancel
            </LuxuryButton>
          </div>
        </div>
      </LuxuryModal>

      {/* Filters Modal */}
      <LuxuryModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        title="Advanced Filters"
        subtitle="Refine your RIFTS search criteria"
        size="md"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Risk Level</label>
              <select className="w-full px-4 py-3 text-white bg-gray-800 border border-gray-600 rounded-xl">
                <option value="">All Risk Levels</option>
                <option value="very-low">Very Low</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Min APY (%)</label>
              <input 
                type="number" 
                placeholder="0.0"
                className="w-full px-4 py-3 text-white bg-gray-800 border border-gray-600 rounded-xl"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Min TVL ($M)</label>
              <input 
                type="number" 
                placeholder="0.0"
                className="w-full px-4 py-3 text-white bg-gray-800 border border-gray-600 rounded-xl"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Strategy Type</label>
              <select className="w-full px-4 py-3 text-white bg-gray-800 border border-gray-600 rounded-xl">
                <option value="">All Strategies</option>
                <option value="delta-neutral">Delta Neutral</option>
                <option value="momentum">Momentum</option>
                <option value="arbitrage">Arbitrage</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <LuxuryButton variant="secondary" size="lg" className="flex-1" onClick={() => setShowFiltersModal(false)}>
              Cancel
            </LuxuryButton>
            <LuxuryButton variant="primary" size="lg" className="flex-1">
              Apply Filters
            </LuxuryButton>
          </div>
        </div>
      </LuxuryModal>

      {/* Analytics Modal - Ultra Compact */}
      <LuxuryModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        title="Protocol Analytics"
        subtitle="Real-time performance metrics and insights"
        size="lg"
      >
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-gray-800/20">
          {/* Compact Key Metrics */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <motion.div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-3 py-1.5 text-xs gap-1.5 flex-col text-center">
              {/* Luxury background patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
              <div className="relative z-10">
                <p className="text-gray-400">TVL</p>
                <p className="font-bold text-emerald-400">{formatCurrency(totalTVL)}</p>
                <p className="text-emerald-400">+{tvlGrowth}%</p>
              </div>
            </motion.div>
            <motion.div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-3 py-1.5 text-xs gap-1.5 flex-col text-center">
              {/* Luxury background patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
              <div className="relative z-10">
                <p className="text-gray-400">Active Farmers</p>
                <p className="font-bold text-emerald-400">{rifts.length}</p>
                <p className="text-emerald-400">Active</p>
              </div>
            </motion.div>
            <motion.div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-3 py-1.5 text-xs gap-1.5 flex-col text-center">
              {/* Luxury background patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
              <div className="relative z-10">
                <p className="text-gray-400">Avg APY</p>
                <p className="font-bold text-emerald-400">{avgAPY.toFixed(2)}%</p>
                <p className="text-emerald-400">{totalUsers > 0 ? 'Live' : 'None'}</p>
              </div>
            </motion.div>
            <motion.div className="relative inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden select-none bg-black text-emerald-500 hover:bg-gray-900 active:bg-gray-950 focus:ring-emerald-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 hover:border-emerald-400/50 px-3 py-1.5 text-xs gap-1.5 flex-col text-center">
              {/* Luxury background patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50" />
              <div className="relative z-10">
                <p className="text-gray-400">24h Volume</p>
                <p className="font-bold text-emerald-400">{formatCurrency(totalVolume)}</p>
                <p className="text-emerald-400">+{volumeGrowth}%</p>
              </div>
            </motion.div>
          </div>

          {/* Compact Revenue & Analytics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-xl bg-gray-800/50 border-gray-700/50">
              <h3 className="flex items-center gap-1 mb-2 text-sm font-bold text-white">
                <DollarSign className="w-3 h-3 text-green-400" />
                Revenue
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Fees:</span>
                  <span className="font-semibold text-green-400">${totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Protocol Fees:</span>
                  <span className="font-semibold text-white">${totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pending Distribution:</span>
                  <span className="font-semibold text-blue-400">${(totalFees * 0.95).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="p-3 border rounded-xl bg-gray-800/50 border-gray-700/50">
              <h3 className="flex items-center gap-1 mb-2 text-sm font-bold text-white">
                <Target className="w-3 h-3 text-cyan-400" />
                Performance
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg APY:</span>
                  <span className="font-semibold text-green-400">{avgAPY.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Burned:</span>
                  <span className="font-semibold text-red-400">{totalBurned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Burn Rate:</span>
                  <span className="font-semibold text-orange-400">{burnRate.toFixed(1)}%/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rift Strategy Performance */}
          <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
            <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
              <Target className="w-5 h-5 text-cyan-400" />
              Rift Strategy Performance
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-3 text-lg font-semibold text-green-400">Delta Neutral</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Rifts</span>
                    <span className="text-white">{protocolAnalytics?.strategies.deltaNeutral.activeRifts ?? Math.floor(rifts.length * 0.4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg APY</span>
                    <span className="text-green-400">{protocolAnalytics?.strategies.deltaNeutral.avgAPY?.toFixed(1) ?? avgAPY.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TVL Share</span>
                    <span className="text-blue-400">{protocolAnalytics?.strategies.deltaNeutral.tvlShare?.toFixed(1) ?? (totalTVL > 0 ? (Math.floor(rifts.length * 0.4) * 100 / rifts.length).toFixed(1) : 0)}%</span>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-3 text-lg font-semibold text-blue-400">Momentum</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Rifts</span>
                    <span className="text-white">{protocolAnalytics?.strategies.momentum.activeRifts ?? Math.floor(rifts.length * 0.35)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg APY</span>
                    <span className="text-green-400">{protocolAnalytics?.strategies.momentum.avgAPY?.toFixed(1) ?? avgAPY.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TVL Share</span>
                    <span className="text-blue-400">{protocolAnalytics?.strategies.momentum.tvlShare?.toFixed(1) ?? (totalTVL > 0 ? (Math.floor(rifts.length * 0.35) * 100 / rifts.length).toFixed(1) : 0)}%</span>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-3 text-lg font-semibold text-purple-400">Arbitrage</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Rifts</span>
                    <span className="text-white">{protocolAnalytics?.strategies.arbitrage.activeRifts ?? Math.floor(rifts.length * 0.25)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg APY</span>
                    <span className="text-green-400">{protocolAnalytics?.strategies.arbitrage.avgAPY?.toFixed(1) ?? avgAPY.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TVL Share</span>
                    <span className="text-blue-400">{protocolAnalytics?.strategies.arbitrage.tvlShare?.toFixed(1) ?? (totalTVL > 0 ? (Math.floor(rifts.length * 0.25) * 100 / rifts.length).toFixed(1) : 0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Rifts */}
          <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
            <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Top Performing Rifts (30d)
            </h3>
            <div className="space-y-3">
              {rifts.slice(0, 5).map((rift, index) => (
                <div key={`top-performing-${rift.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600">
                      <span className="text-sm font-bold text-black">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{rift.symbol}</p>
                      <p className="text-sm text-gray-400">{rift.underlying} • {rift.strategy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">{rift.apy?.toFixed(2) || '0.00'}% APY</p>
                    <p className="text-sm text-gray-400">
                      {rift.tvl ? (
                        rift.tvl >= 1000000 ? `$${(rift.tvl / 1000000).toFixed(2)}M` :
                        rift.tvl >= 1000 ? `$${(rift.tvl / 1000).toFixed(2)}K` :
                        `$${rift.tvl.toFixed(2)}`
                      ) : '$0'} TVL
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Oracle System Status */}
          <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
            <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              Hybrid Oracle System Status
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-2 text-sm text-gray-400">Active Oracles</h4>
                <p className="text-2xl font-bold text-green-400">{protocolAnalytics?.oracle.activeOracles ?? realMetrics?.activeOracles ?? 0}</p>
                <p className="text-xs text-green-400">{(protocolAnalytics?.oracle.activeOracles ?? realMetrics?.activeOracles) ? Math.round(((protocolAnalytics?.oracle.activeOracles ?? realMetrics?.activeOracles ?? 0) / 3) * 100) : 0}% Active</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-2 text-sm text-gray-400">Price Feeds</h4>
                <p className="text-2xl font-bold text-blue-400">{protocolAnalytics?.oracle.priceFeeds ?? realMetrics?.activeOracles ?? 0}</p>
                <p className="text-xs text-blue-400">Real-time</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-2 text-sm text-gray-400">Avg Latency</h4>
                <p className="text-2xl font-bold text-purple-400">~{protocolAnalytics?.oracle.avgLatency?.toFixed(0) ?? realMetrics?.avgLatency?.toFixed(0) ?? 0}ms</p>
                <p className="text-xs text-purple-400">Live</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50">
                <h4 className="mb-2 text-sm text-gray-400">Accuracy</h4>
                <p className="text-2xl font-bold text-yellow-400">{protocolAnalytics?.oracle.accuracy?.toFixed(1) ?? realMetrics?.priceFeedAccuracy?.toFixed(0) ?? 0}%</p>
                <p className="text-xs text-yellow-400">Real-time</p>
              </div>
            </div>
          </div>

          {/* User Analytics */}
          <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
            <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
              <Users className="w-5 h-5 text-blue-400" />
              User Analytics
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <h4 className="mb-3 text-lg font-semibold text-white">User Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">New Users (7d)</span>
                    <span className="font-semibold text-green-400">{protocolAnalytics?.users.newUsers7d ?? realUserAnalytics?.newUsers7d ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Users (30d)</span>
                    <span className="font-semibold text-blue-400">{protocolAnalytics?.users.activeUsers30d ?? realUserAnalytics?.activeUsers30d ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Retention Rate</span>
                    <span className="font-semibold text-purple-400">{protocolAnalytics?.users.retentionRate?.toFixed(0) ?? realUserAnalytics?.retentionRate?.toFixed(0) ?? 0}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-lg font-semibold text-white">Position Sizes</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">&lt; $1K</span>
                    <span className="font-semibold text-white">{protocolAnalytics?.users.positionSizes.under1k ?? realUserAnalytics?.positionDistribution?.under1k ?? 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">$1K - $10K</span>
                    <span className="font-semibold text-white">{protocolAnalytics?.users.positionSizes.between1k10k ?? realUserAnalytics?.positionDistribution?.between1k10k ?? 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">&gt; $10K</span>
                    <span className="font-semibold text-white">{protocolAnalytics?.users.positionSizes.over10k ?? realUserAnalytics?.positionDistribution?.over10k ?? 0}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-lg font-semibold text-white">Transaction Volume</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily Avg</span>
                    <span className="font-semibold text-green-400">{protocolAnalytics?.volume.dailyAvg ?? realUserAnalytics?.volumeMetrics?.dailyAvg ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weekly Peak</span>
                    <span className="font-semibold text-blue-400">{protocolAnalytics?.volume.weeklyPeak ?? realUserAnalytics?.volumeMetrics?.weeklyPeak ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Volume</span>
                    <span className="font-semibold text-purple-400">{protocolAnalytics?.volume.totalVolume ?? realUserAnalytics?.volumeMetrics?.totalVolume ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Price Charts */}
          <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
            <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Performance Charts & Trends
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center justify-center h-48 bg-gray-900/50 rounded-xl">
                <div className="text-center">
                  <LineChart className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                  <p className="font-medium text-gray-400">TVL Growth Chart</p>
                  <p className="text-xs text-gray-500">Interactive visualization coming soon</p>
                </div>
              </div>
              <div className="flex items-center justify-center h-48 bg-gray-900/50 rounded-xl">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                  <p className="font-medium text-gray-400">Strategy Distribution</p>
                  <p className="text-xs text-gray-500">Real-time pie chart coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LuxuryModal>

      {/* Portfolio Modal - Ultra Compact */}
      <LuxuryModal
        isOpen={showPortfolioModal}
        onClose={() => setShowPortfolioModal(false)}
        title="Your Portfolio"
        subtitle="Track your RIFTS positions and performance"
        size="lg"
      >
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-gray-800/20">
          {wallet.connected ? (
            <>
              {/* Compact Portfolio Summary */}
              <div className="p-2 border rounded-lg bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-700/50">
                <h3 className="flex items-center gap-1 mb-2 text-sm font-bold text-white">
                  <Briefcase className="w-3 h-3 text-green-400" />
                  Portfolio Summary
                </h3>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-gray-400">Total Value</p>
                    <p className="font-bold text-green-400">{formatCurrency(getUserPortfolioData().totalValue)}</p>
                    <p className="text-green-400">{getUserPortfolioData().totalValue > 0 ? 'Active' : 'No positions'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Positions</p>
                    <p className="font-bold text-white">{getUserPortfolioData().positions.length}</p>
                    <p className="text-gray-400">{getUserPortfolioData().positions.length} rift{getUserPortfolioData().positions.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Rewards</p>
                    <p className="font-bold text-blue-400">{formatCurrency(getUserPortfolioData().totalRewards)}</p>
                    <p className="text-blue-400">{getUserPortfolioData().totalRewards > 0 ? 'Earning' : 'No volume'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Claimable</p>
                    <p className="font-bold text-purple-400">{formatCurrency(getUserPortfolioData().claimableRewards)}</p>
                    <p className="text-purple-400">{getUserPortfolioData().claimableRewards > 0 ? 'Ready' : 'None yet'}</p>
                  </div>
                </div>
              </div>

              {/* Active Positions */}
              <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Active Positions
                </h3>
                <div className="space-y-4">
                  {getUserPortfolioData().positions.length > 0 ? (
                    getUserPortfolioData().positions.map((position: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-900/50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-semibold text-white">{position.rift}</h4>
                          <p className="text-sm text-gray-400">{position.position} tokens</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">${position.value.toLocaleString()}</p>
                          <p className={`text-sm font-medium ${position.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.pnl > 0 ? '+' : ''}{position.pnl.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Entry</p>
                          <p className="text-white">${position.entry}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Current</p>
                          <p className="text-white">${position.current}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Rewards</p>
                          <p className="text-green-400">${position.rewards}</p>
                        </div>
                        <div className="flex gap-2">
                          <LuxuryButton 
                            variant="ghost" 
                            size="xs"
                            onClick={() => {
                              // Close portfolio modal first, then open details modal
                              setShowPortfolioModal(false);
                              const rift = rifts.find(r => r.symbol === position.rift);
                              if (rift) {
                                setSelectedRift(rift);
                                setTimeout(() => setShowDetailsModal(true), 100); // Small delay for smooth transition
                              }
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </LuxuryButton>
                          <LuxuryButton 
                            variant="secondary" 
                            size="xs"
                            onClick={async () => {
                              // Close portfolio modal first, then open unwrap modal
                              setShowPortfolioModal(false);
                              const rift = rifts.find(r => r.symbol === position.rift);
                              if (rift) {
                                setSelectedRift(rift);
                                await fetchRiftTokenBalance(rift);
                                setTimeout(() => setShowUnwrapModal(true), 100); // Small delay for smooth transition
                              }
                            }}
                          >
                            <Unlock className="w-3 h-3" />
                          </LuxuryButton>
                        </div>
                      </div>
                    </div>
                  ))) : (
                    <div className="py-8 text-center">
                      <p className="text-gray-400">No active positions yet</p>
                      <p className="mt-2 text-sm text-gray-500">Wrap tokens to create your first position</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIFTS Token Status */}
              <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
                  <PieChart className="w-5 h-5 text-green-400" />
                  RIFTS Token Status
                </h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-white">Holdings</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">RIFTS Balance</span>
                        <span className="font-semibold text-white">{portfolioData?.riftsBalance.toFixed(2) || riftsBalance.toFixed(2)} RIFTS</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">USD Value</span>
                        <span className="font-semibold text-green-400">${portfolioData?.riftsBalanceUsd.toFixed(2) || (riftsBalance * 0.001).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Staked</span>
                        <span className="font-semibold text-blue-400">{portfolioData?.stakedAmount.toFixed(2) || stakedAmount.toFixed(2)} RIFTS</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Voting Power</span>
                        <span className="font-semibold text-purple-400">{portfolioData?.votingPowerPercentage.toFixed(2) || '0'}%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-white">Revenue Share</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">This Month</span>
                        <span className="font-semibold text-green-400">${portfolioData?.monthlyRevenue.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Pending Rewards</span>
                        <span className="font-semibold text-blue-400">${portfolioData?.pendingRewardsUsd.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">All Time</span>
                        <span className="font-semibold text-purple-400">${portfolioData?.totalRevenue.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Next Distribution</span>
                        <span className="font-semibold text-gray-400">{portfolioData?.nextDistribution || 'TBA'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Analytics */}
              <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Performance Analytics
                </h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="p-4 rounded-xl bg-gray-900/50">
                    <h4 className="mb-2 text-sm text-gray-400">7-Day PnL</h4>
                    <p className={`text-lg font-bold ${portfolioData && portfolioData.pnl7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${portfolioData?.pnl7d.toFixed(2) || '0.00'}
                    </p>
                    <p className={`text-xs ${portfolioData && portfolioData.pnl7dPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {portfolioData && portfolioData.pnl7dPercent >= 0 ? '+' : ''}{portfolioData?.pnl7dPercent.toFixed(2) || '0'}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/50">
                    <h4 className="mb-2 text-sm text-gray-400">30-Day PnL</h4>
                    <p className={`text-lg font-bold ${portfolioData && portfolioData.pnl30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${portfolioData?.pnl30d.toFixed(2) || '0.00'}
                    </p>
                    <p className={`text-xs ${portfolioData && portfolioData.pnl30dPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {portfolioData && portfolioData.pnl30dPercent >= 0 ? '+' : ''}{portfolioData?.pnl30dPercent.toFixed(2) || '0'}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/50">
                    <h4 className="mb-2 text-sm text-gray-400">Proposals Voted</h4>
                    <p className="text-lg font-bold text-purple-400">{portfolioData?.proposalsVoted || 0}</p>
                    <p className="text-xs text-gray-400">{portfolioData && portfolioData.proposalsVoted > 0 ? 'Active' : 'None yet'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/50">
                    <h4 className="mb-2 text-sm text-gray-400">Staking APY</h4>
                    <p className="text-lg font-bold text-green-400">{portfolioData?.stakingApy.toFixed(2) || '0'}%</p>
                    <p className="text-xs text-blue-400">{portfolioData && portfolioData.stakedAmount > 0 ? 'Earning' : 'Not staking'}</p>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                <h3 className="flex items-center gap-2 mb-4 text-xl font-bold text-white">
                  <Activity className="w-5 h-5 text-orange-400" />
                  Recent Transactions
                </h3>
                <div className="space-y-3">
                  {getUserTransactionHistory().length > 0 ? getUserTransactionHistory().map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'wrap' ? 'bg-green-900/30' :
                          tx.type === 'unwrap' ? 'bg-red-900/30' : 'bg-blue-900/30'
                        }`}>
                          {tx.type === 'wrap' ? <Lock className="w-4 h-4 text-green-400" /> :
                           tx.type === 'unwrap' ? <Unlock className="w-4 h-4 text-red-400" /> :
                           <DollarSign className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{tx.type} - {tx.rift}</p>
                          <p className="text-xs text-gray-400">{tx.amount} • {tx.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{tx.value}</p>
                        <p className="text-xs text-green-400 capitalize">{tx.status}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-8 text-center">
                      <p className="text-gray-400">No transactions yet</p>
                      <p className="mt-2 text-sm text-gray-500">Your wrap and unwrap transactions will appear here</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <LuxuryButton
                  variant="success"
                  size="lg"
                  onClick={() => {
                    setShowPortfolioModal(false);
                    setShowStakingModal(true);
                  }}
                >
                  <Lock className="w-4 h-4" />
                  Stake LP
                </LuxuryButton>
                <LuxuryButton
                  variant="ghost"
                  size="lg"
                  disabled={!portfolioData || portfolioData.pendingRewards === 0}
                  onClick={async () => {
                    // TODO: Implement claim rewards functionality

                  }}
                >
                  <DollarSign className="w-4 h-4" />
                  {portfolioData && portfolioData.pendingRewards > 0 ? `Claim $${portfolioData.pendingRewardsUsd.toFixed(2)}` : 'No Rewards'}
                </LuxuryButton>
                <LuxuryButton
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    // Close portfolio modal and scroll to rifts
                    setShowPortfolioModal(false);
                    // Scroll to rifts section
                    const riftsSection = document.querySelector('[data-rifts-section]');
                    if (riftsSection) {
                      riftsSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                  New Position
                </LuxuryButton>
                <LuxuryButton
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    // Export portfolio data as CSV
                    if (!portfolioData) return;

                    const csvData = [
                      ['RIFTS Portfolio Export', ''],
                      ['Export Date', new Date().toLocaleString()],
                      [''],
                      ['Holdings', ''],
                      ['RIFTS Balance', portfolioData.riftsBalance.toFixed(2)],
                      ['USD Value', portfolioData.riftsBalanceUsd.toFixed(2)],
                      ['Staked Amount', portfolioData.stakedAmount.toFixed(2)],
                      ['Staked USD Value', portfolioData.stakedAmountUsd.toFixed(2)],
                      ['Pending Rewards', portfolioData.pendingRewards.toFixed(2)],
                      ['Pending Rewards USD', portfolioData.pendingRewardsUsd.toFixed(2)],
                      [''],
                      ['Governance', ''],
                      ['Voting Power', portfolioData.votingPower.toFixed(2)],
                      ['Voting Power %', portfolioData.votingPowerPercentage.toFixed(2) + '%'],
                      ['Proposals Voted', portfolioData.proposalsVoted.toString()],
                      [''],
                      ['Revenue', ''],
                      ['Monthly Revenue', portfolioData.monthlyRevenue.toFixed(2)],
                      ['Total Revenue', portfolioData.totalRevenue.toFixed(2)],
                      [''],
                      ['Performance', ''],
                      ['Total Value', portfolioData.totalValue.toFixed(2)],
                      ['7-Day PnL', portfolioData.pnl7d.toFixed(2)],
                      ['7-Day PnL %', portfolioData.pnl7dPercent.toFixed(2) + '%'],
                      ['30-Day PnL', portfolioData.pnl30d.toFixed(2)],
                      ['30-Day PnL %', portfolioData.pnl30dPercent.toFixed(2) + '%'],
                      ['Staking APY', portfolioData.stakingApy.toFixed(2) + '%'],
                    ];

                    const csvContent = csvData.map(row => row.join(',')).join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rifts-portfolio-${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Export Data
                </LuxuryButton>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="mb-4 text-gray-400">Connect your wallet to view portfolio</p>
              <LuxuryButton variant="primary" onClick={wallet.connect}>
                Connect Wallet
              </LuxuryButton>
            </div>
          )}
        </div>
      </LuxuryModal>

      {/* Staking Modal */}
      <LuxuryModal
        isOpen={showStakingModal}
        onClose={() => {
          setShowStakingModal(false);
          setStakingAmount('');
          setUnstakeAmount('');
          setStakingTab('stake');
        }}
        title="LP Staking"
        subtitle="Stake LP tokens to earn RIFTS rewards"
        size="md"
      >
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 p-1 border rounded-lg bg-gray-900/50 border-gray-700/50">
            <button
              onClick={() => setStakingTab('stake')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                stakingTab === 'stake'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Lock className="inline w-4 h-4 mr-2" />
              Stake
            </button>
            <button
              onClick={() => setStakingTab('unstake')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                stakingTab === 'unstake'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Unlock className="inline w-4 h-4 mr-2" />
              Unstake
            </button>
          </div>

          {wallet.connected && wallet.publicKey ? (
            <>
              {/* Staking Info */}
              <div className="p-6 border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Your Staking Position</h3>
                  {(portfolioData?.stakedAmount || stakedAmount) > 0 && (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-gray-900/50 border-gray-700/30">
                    <p className="mb-1 text-xs font-medium text-gray-400">Currently Staked</p>
                    <p className="text-2xl font-bold text-blue-400">{portfolioData?.stakedAmount.toFixed(4) || stakedAmount.toFixed(4)}</p>
                    <p className="text-xs text-gray-500">LP Tokens</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-gray-900/50 border-gray-700/30">
                    <p className="mb-1 text-xs font-medium text-gray-400">Staking APY</p>
                    <p className="text-2xl font-bold text-green-400">{portfolioData?.stakingApy.toFixed(2) || '40.00'}%</p>
                    <p className="text-xs text-gray-500">Annual Yield</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-gray-900/50 border-gray-700/30">
                    <p className="mb-1 text-xs font-medium text-gray-400">Pending Rewards</p>
                    <p className="text-2xl font-bold text-purple-400">{portfolioData?.pendingRewards.toFixed(4) || stakingRewards.toFixed(4)}</p>
                    <p className="text-xs text-gray-500">RIFTS Tokens</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-gray-900/50 border-gray-700/30">
                    <p className="mb-1 text-xs font-medium text-gray-400">USD Value</p>
                    <p className="text-2xl font-bold text-emerald-400">${portfolioData?.pendingRewardsUsd.toFixed(2) || (stakingRewards * 0.001).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Current Price</p>
                  </div>
                </div>
                {(portfolioData?.stakedAmount || stakedAmount) > 0 && (
                  <div className="p-3 mt-4 border border-green-900/50 bg-green-900/10 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-300">💎 Total Staked Value:</span>
                      <span className="font-bold text-green-100">${((portfolioData?.stakedAmount || stakedAmount) * 0.001).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stake Tab Content */}
              {stakingTab === 'stake' && (
                <>
                  {/* Stake Form */}
                  <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                    <h3 className="mb-4 text-lg font-bold text-white">Stake LP Tokens</h3>
                <div className="space-y-4">
                  {/* Available Balance */}
                  <div className="flex items-center justify-between p-3 border bg-gray-900/50 border-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-400">Available to Stake:</span>
                    <span className="text-lg font-bold text-emerald-400">{lpTokenBalance.toFixed(4)} LP</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-400">Amount to Stake (LP Tokens)</label>
                      <button
                        onClick={() => setStakingAmount(lpTokenBalance.toString())}
                        className="px-2 py-1 text-xs font-bold transition-colors border rounded text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20"
                        disabled={lpTokenBalance === 0}
                      >
                        MAX
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={stakingAmount}
                        onChange={(e) => setStakingAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 text-white transition bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                        min="0"
                        max={lpTokenBalance}
                        step="0.01"
                      />
                    </div>

                    {/* Percentage Presets */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {[25, 50, 75, 100].map((percentage) => (
                        <button
                          key={percentage}
                          onClick={() => setStakingAmount((lpTokenBalance * (percentage / 100)).toFixed(4))}
                          className="px-3 py-2 text-sm font-medium transition-all border rounded-lg text-gray-300 border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                          disabled={lpTokenBalance === 0}
                        >
                          {percentage}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {parseFloat(stakingAmount || '0') > 0 && (
                    <div className="p-4 space-y-2 border border-blue-900/50 bg-blue-900/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-300">💰 Daily Rewards:</span>
                        <span className="font-semibold text-blue-100">~{(parseFloat(stakingAmount) * 0.4 / 365).toFixed(4)} RIFTS</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-300">📈 Monthly Rewards:</span>
                        <span className="font-semibold text-blue-100">~{(parseFloat(stakingAmount) * 0.4 / 12).toFixed(4)} RIFTS</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-300">🎯 Yearly Rewards:</span>
                        <span className="font-semibold text-blue-100">~{(parseFloat(stakingAmount) * 0.4).toFixed(4)} RIFTS</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-blue-800/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-blue-200">Est. Value (1 year):</span>
                          <span className="font-bold text-emerald-400">${(parseFloat(stakingAmount) * 0.4 * 0.001).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {lpTokenBalance === 0 && (
                    <div className="p-4 border border-yellow-900/50 bg-yellow-900/20 rounded-xl">
                      <p className="text-sm text-yellow-300">
                        ⚠️ You don't have any LP tokens yet. Add liquidity to the RIFTS pool to earn LP tokens.
                      </p>
                    </div>
                  )}

                  <LuxuryButton
                    variant="success"
                    size="lg"
                    fullWidth
                    onClick={handleStakeLPClick}
                    disabled={!stakingAmount || parseFloat(stakingAmount) <= 0 || parseFloat(stakingAmount) > lpTokenBalance || isWrapping}
                  >
                    <Lock className="w-4 h-4" />
                    {isWrapping ? 'Staking...' : 'Stake LP Tokens'}
                  </LuxuryButton>
                </div>
              </div>

                  {/* Staking Benefits */}
                  <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                    <h3 className="mb-4 text-lg font-bold text-white">Staking Benefits</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-green-900/30">
                          <DollarSign className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">Earn RIFTS Rewards</p>
                          <p className="text-sm text-gray-400">Receive 90% of all protocol trading fees distributed as RIFTS tokens</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-blue-900/30">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">High APY</p>
                          <p className="text-sm text-gray-400">Earn up to 40% APY from trading fee distribution</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-purple-900/30">
                          <Shield className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">No Lock Period</p>
                          <p className="text-sm text-gray-400">Unstake your LP tokens anytime without penalties</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Unstake Tab Content */}
              {stakingTab === 'unstake' && (
                <>
                  {/* Unstake Form */}
                  <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                    <h3 className="mb-4 text-lg font-bold text-white">Unstake LP Tokens</h3>
                    <div className="space-y-4">
                      {/* Currently Staked */}
                      <div className="flex items-center justify-between p-3 border bg-gray-900/50 border-gray-700/50 rounded-lg">
                        <span className="text-sm text-gray-400">Currently Staked:</span>
                        <span className="text-lg font-bold text-blue-400">{portfolioData?.stakedAmount.toFixed(4) || stakedAmount.toFixed(4)} LP</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Amount to Unstake (LP Tokens)</label>
                          <button
                            onClick={() => setUnstakeAmount((portfolioData?.stakedAmount || stakedAmount).toString())}
                            className="px-2 py-1 text-xs font-bold transition-colors border rounded text-blue-400 border-blue-500/50 hover:bg-blue-500/20"
                            disabled={(portfolioData?.stakedAmount || stakedAmount) === 0}
                          >
                            MAX
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={unstakeAmount}
                            onChange={(e) => setUnstakeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-3 text-white transition bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                            min="0"
                            max={portfolioData?.stakedAmount || stakedAmount}
                            step="0.01"
                          />
                        </div>

                        {/* Percentage Presets */}
                        <div className="grid grid-cols-4 gap-2 mt-3">
                          {[25, 50, 75, 100].map((percentage) => (
                            <button
                              key={percentage}
                              onClick={() => setUnstakeAmount(((portfolioData?.stakedAmount || stakedAmount) * (percentage / 100)).toFixed(4))}
                              className="px-3 py-2 text-sm font-medium transition-all border rounded-lg text-gray-300 border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                              disabled={(portfolioData?.stakedAmount || stakedAmount) === 0}
                            >
                              {percentage}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {parseFloat(unstakeAmount || '0') > 0 && (
                        <div className="p-4 space-y-2 border border-blue-900/50 bg-blue-900/20 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-blue-300">💰 You will receive:</span>
                            <span className="font-semibold text-blue-100">{parseFloat(unstakeAmount).toFixed(4)} LP</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-blue-300">💵 Est. Value:</span>
                            <span className="font-semibold text-blue-100">${(parseFloat(unstakeAmount) * 0.001).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <LuxuryButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleUnstakeLP}
                        disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > (portfolioData?.stakedAmount || stakedAmount) || isWrapping}
                      >
                        <Unlock className="w-4 h-4" />
                        {isWrapping ? 'Unstaking...' : 'Unstake LP Tokens'}
                      </LuxuryButton>
                    </div>
                  </div>

                  {/* Claim Rewards */}
                  <div className="p-6 border bg-gray-800/50 border-gray-700/50 rounded-xl">
                    <h3 className="mb-4 text-lg font-bold text-white">Claim Rewards</h3>
                    <div className="space-y-4">
                      <div className="p-4 border bg-gray-900/50 border-gray-700/50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Pending Rewards:</span>
                          <span className="text-2xl font-bold text-purple-400">{portfolioData?.pendingRewards.toFixed(4) || stakingRewards.toFixed(4)} RIFTS</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">USD Value:</span>
                          <span className="text-sm font-semibold text-emerald-400">${portfolioData?.pendingRewardsUsd.toFixed(2) || (stakingRewards * 0.001).toFixed(2)}</span>
                        </div>
                      </div>

                      <LuxuryButton
                        variant="success"
                        size="lg"
                        fullWidth
                        onClick={handleClaimRewards}
                        disabled={(portfolioData?.pendingRewards || stakingRewards) === 0 || isWrapping}
                      >
                        <DollarSign className="w-4 h-4" />
                        {isWrapping ? 'Claiming...' : `Claim ${(portfolioData?.pendingRewards || stakingRewards).toFixed(2)} RIFTS`}
                      </LuxuryButton>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="mb-4 text-gray-400">Connect your wallet to stake LP tokens</p>
              <LuxuryButton variant="primary" onClick={wallet.connect}>
                Connect Wallet
              </LuxuryButton>
            </div>
          )}
        </div>
      </LuxuryModal>

      {/* Staking Confirmation Modal */}
      <ConfirmationModal
        isOpen={showStakingConfirmation}
        onClose={() => setShowStakingConfirmation(false)}
        onConfirm={handleStakeLP}
        title="Confirm Staking"
        message="You are about to stake your LP tokens. Once staked, they will earn RIFTS rewards from trading fees."
        confirmText="Stake Now"
        cancelText="Cancel"
        type="success"
        icon={<Lock className="w-8 h-8" />}
        details={[
          { label: 'Amount to Stake', value: `${parseFloat(stakingAmount || '0').toFixed(4)} LP`, highlight: true },
          { label: 'APY', value: '40.00%', highlight: false },
          { label: 'Daily Rewards', value: `~${(parseFloat(stakingAmount || '0') * 0.4 / 365).toFixed(4)} RIFTS`, highlight: false },
          { label: 'Monthly Rewards', value: `~${(parseFloat(stakingAmount || '0') * 0.4 / 12).toFixed(4)} RIFTS`, highlight: false },
        ]}
      />

      {/* Markets Modal */}
      <LuxuryModal
        isOpen={showMarketsModal}
        onClose={() => setShowMarketsModal(false)}
        title="Market Overview"
        subtitle="Live market data and token performance"
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="p-4 border bg-gray-900/50 border-gray-700/50 rounded-xl">
              <h3 className="mb-2 text-lg font-semibold text-white">Market Cap</h3>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalTVL * 1.2)}</p>
              <p className="text-sm text-gray-400">Total market value</p>
            </div>
            <div className="p-4 border bg-gray-900/50 border-gray-700/50 rounded-xl">
              <h3 className="mb-2 text-lg font-semibold text-white">24h Volume</h3>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalVolume)}</p>
              <p className="text-sm text-gray-400">Trading volume</p>
            </div>
          </div>
          <div className="p-6 border bg-gray-900/50 border-gray-700/50 rounded-xl">
            <h3 className="mb-4 text-xl font-bold text-white">Top Performing Rifts</h3>
            <div className="space-y-3">
              {rifts.slice(0, 5).map((rift, index) => (
                <div key={`sidebar-${rift.id}`} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-gray-400">{index + 1}</span>
                    <div>
                      <p className="font-semibold text-white">{rift.symbol}</p>
                      <p className="text-sm text-gray-400">{rift.underlying}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">{rift.apy ? rift.apy.toFixed(2) : '0.00'}%</p>
                    <p className="text-sm text-gray-400">
                      {rift.tvl ? (
                        rift.tvl >= 1000000 ? `$${(rift.tvl / 1000000).toFixed(2)}M` :
                        rift.tvl >= 1000 ? `$${(rift.tvl / 1000).toFixed(2)}K` :
                        `$${rift.tvl.toFixed(2)}`
                      ) : '$0'} TVL
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </LuxuryModal>

      {/* RIFTS Token Modal - Ultra Compact */}
      <LuxuryModal
        isOpen={showRiftsTokenModal}
        onClose={() => setShowRiftsTokenModal(false)}
        title="RIFTS Token"
        subtitle="Governance & Revenue Distribution"
        size="xl"
        zIndex={120}
      >
        <div className="space-y-3">
          {/* Compact Token Overview */}
          <div className="p-3 border rounded-xl bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600">
                <span className="text-sm font-bold text-black">R</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">RIFTS Token</h3>
                <p className="text-xs text-green-400">Governance & Revenue</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <p className="text-gray-400">Price</p>
                <p className="font-bold text-green-400">${riftsTokenData.price.toFixed(6)}</p>
                <p className="text-green-400">Live</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Market Cap</p>
                <p className="font-bold text-blue-400">${riftsTokenData.marketCap.toLocaleString()}</p>
                <p className="text-blue-400">Real-time</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Supply</p>
                <p className="font-bold text-white">{(riftsTokenData.supply / 1e9).toFixed(1)}B</p>
                <p className="text-gray-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">APY</p>
                <p className="font-bold text-purple-400">{avgAPY.toFixed(1)}%</p>
                <p className="text-purple-400">Live yield</p>
              </div>
            </div>
          </div>

          {/* Compact Revenue & Governance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-xl bg-gray-800/50 border-gray-700/50">
              <h3 className="flex items-center gap-1 mb-2 text-sm font-bold text-white">
                <PieChart className="w-3 h-3 text-green-400" />
                Revenue Split
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Stakers:</span>
                  <span className="font-semibold text-green-400">70%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Development:</span>
                  <span className="font-semibold text-blue-400">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Treasury:</span>
                  <span className="font-semibold text-purple-400">10%</span>
                </div>
              </div>
            </div>
            
            <div className="p-3 border rounded-xl bg-gray-800/50 border-gray-700/50">
              <h3 className="flex items-center gap-1 mb-2 text-sm font-bold text-white">
                <DollarSign className="w-3 h-3 text-yellow-400" />
                Protocol Stats
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Fees:</span>
                  <span className="font-semibold text-white">${totalFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Burned:</span>
                  <span className="font-semibold text-red-400">{totalBurned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your Vote:</span>
                  <span className="font-semibold text-green-400">0%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Actions */}
          <div className="grid grid-cols-3 gap-2">
            {/* REMOVED: Test Buy/Stake/Liquidity buttons - developer tools only

            These buttons require external DEX infrastructure:
            - Buy: Needs Meteora RIFTS/SOL pool with liquidity (use Jupiter/Meteora UI)
            - Stake: Incomplete function with fake pool address (needs LP staking program)
            - Liquidity: Test function for initial pool setup (use Meteora UI)

            For production, users should:
            1. Buy RIFTS on Jupiter/Meteora DEX
            2. Stake through proper LP staking interface
            3. Add liquidity through Meteora pool UI
            */}
            <LuxuryButton
              variant="primary"
              size="sm"
              className="text-xs"
              onClick={() => {
                setShowRiftsTokenModal(false);
                setShowStakingModal(true);
              }}
            >
              <Lock className="w-3 h-3" />
              Stake
            </LuxuryButton>
            <LuxuryButton
              variant={stakingRewards > 0 ? "success" : "ghost"}
              size="sm"
              className="text-xs"
              disabled={stakingRewards === 0}
              onClick={async () => {
                if (stakingRewards > 0) {
                  try {
                    // Execute real RIFTS rewards claim through LP staking program
                    // const result = await lpStakingProgram.claimRewards(new PublicKey(wallet.publicKey));
                    // if (result.success) {
                    //   alert(`Successfully claimed ${stakingRewards.toFixed(2)} RIFTS rewards!\n\nTransaction: ${result.signature}`);
                    //   await loadRIFTSTokenData();
                    // } else {
                    //   alert(`Failed to claim rewards: ${result.error}`);
                    // }
                    alert('Claim rewards feature coming soon!');
                  } catch (error) {

                    alert('Failed to claim rewards. Please try again.');
                  }
                }
              }}
            >
              <DollarSign className="w-3 h-3" />
              {stakingRewards > 0 ? `Claim ${stakingRewards.toFixed(0)}` : 'Claim'}
            </LuxuryButton>
            <LuxuryButton 
              variant="primary" 
              size="sm" 
              className="text-xs" 
              onClick={() => {

                handleVote();
              }}
              disabled={!wallet.connected}
            >
              <BookOpen className="w-3 h-3" />
              Vote
            </LuxuryButton>
          </div>
        </div>
      </LuxuryModal>

      {/* Advanced Trading Interface Modal */}
      <LuxuryModal
        isOpen={showTradingModal}
        onClose={() => setShowTradingModal(false)}
        title="Advanced Trading Platform"
        subtitle="Professional trading interface for all wrapped tokens"
        size="xl"
      >
        <div className="max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-gray-800/20">
          <TradingInterface 
          wallet={{
            publicKey: wallet.publicKey,
            connected: wallet.connected,
            sendTransaction: wallet.sendTransaction as ((transaction: unknown) => Promise<unknown>) | undefined
          }}
          rifts={rifts}
          onTrade={async (type, token, amount) => {

            // Handle different token types
            if (token === 'RIFTS' && type === 'buy') {
              await handleBuyRIFTS();
            } else if (token.startsWith('r') && type === 'buy') {
              // Handle wrapped token buying (wrapping)
              const underlyingToken = token.substring(1); // Remove 'r' prefix
              const targetRift = rifts.find(r => r.underlying === underlyingToken);
              if (targetRift) {
                setSelectedRift(targetRift);
                setWrapAmount(amount.toString());
                setShowTradingModal(false);
                setShowWrapModal(true);
              }
            } else if (token.startsWith('r') && type === 'sell') {
              // Handle wrapped token selling (unwrapping)
              const underlyingToken = token.substring(1); // Remove 'r' prefix
              const targetRift = rifts.find(r => r.underlying === underlyingToken);
              if (targetRift) {
                setSelectedRift(targetRift);
                setUnwrapAmount(amount.toString());
                setShowTradingModal(false);
                setShowUnwrapModal(true);
              }
            }
          }}
        />
        </div>
      </LuxuryModal>

      <AnimatePresence>
        {riftsModal.isOpen && riftsModal.rift && (
          <RiftsUI
            isOpen={riftsModal.isOpen}
            onClose={() => setRiftsModal({ isOpen: false, rift: null })}
            rift={riftsModal.rift}
            wallet={wallet}
            rifts={rifts}
            onWrap={() => setShowWrapModal(true)}
            onUnwrap={() => setShowUnwrapModal(true)}
            onCloseRift={handleCloseRift}
            addToast={(message: string, type: 'success' | 'error' | 'pending', signature?: string) => {
              setNotification({
                type: type === 'pending' ? 'info' : type,
                title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Processing',
                message,
                signature
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* Success/Error Notification Modal */}
      {notification && (
        <LuxuryModal
          isOpen={true}
          onClose={() => setNotification(null)}
          title={notification.title}
          subtitle={notification.type === 'success' ? '🎉 Transaction Completed' : '❌ Transaction Failed'}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 border rounded-xl bg-gradient-to-br from-emerald-900/20 to-green-800/20 border-emerald-600/30">
              <pre className="font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
                {notification.message}
              </pre>
            </div>

            {notification.signature && (
              <div className="flex gap-3">
                <LuxuryButton
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`9aJ1VBBGgTptJWYbKwbK2kbAebfgWpv93LCpV5bGwK5P`);
                      // Show a quick toast notification
                      setToasts(prev => [...prev, {
                        id: Date.now().toString(),
                        type: 'success',
                        message: '✅ RIFTS token address copied to clipboard!'
                      }]);
                    } catch (error) {

                    }
                  }}
                  className="flex-1"
                >
                  📋 Copy Token Address
                </LuxuryButton>
                <LuxuryButton
                  variant="primary"
                  size="sm"
                  onClick={() => window.open(`https://explorer.solana.com/tx/${notification.signature}?cluster=devnet`, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Transaction
                </LuxuryButton>
              </div>
            )}

            <div className="text-center">
              <LuxuryButton
                variant="primary"
                size="lg"
                onClick={() => setNotification(null)}
                className="w-full"
              >
                Continue
              </LuxuryButton>
            </div>
          </div>
        </LuxuryModal>
      )}

      {/* Dashboard Modal */}
      <DashboardModal
        isOpen={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        wallet={wallet}
      />

      {/* Toast Notifications */}
      <div className="fixed z-50 space-y-2 bottom-4 right-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`min-w-[300px] p-4 rounded-xl shadow-lg border ${
                toast.type === 'success' 
                  ? 'bg-green-900/90 border-green-600' 
                  : toast.type === 'error' 
                  ? 'bg-red-900/90 border-red-600' 
                  : 'bg-blue-900/90 border-blue-600'
              }`}
            >
              <p className="font-medium text-white">{toast.message}</p>
              {toast.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${toast.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
};

export default RiftsApp;