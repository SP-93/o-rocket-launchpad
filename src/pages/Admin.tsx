import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { useAdminRole, useLegacyAdminCheck } from '@/hooks/useAdminRole';
import { useContractDeployment } from '@/hooks/useContractDeployment';
import { usePoolCreation, PoolConfig } from '@/hooks/usePoolCreation';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { useProtocolFees, PoolFeeStatus, AccumulatedFees } from '@/hooks/useProtocolFees';
import { ADMIN_WALLETS, TOKEN_ADDRESSES, PROTOCOL_FEE_CONFIG, FEE_PROTOCOL_OPTIONS, NETWORK_CONFIG, MAINNET_POOLS, TREASURY_WALLET } from '@/config/admin';
import { DEPLOYMENT_STEPS, INITIAL_POOLS, FEE_TIER_CONFIG } from '@/contracts/deployment/config';
import { getDeployedContracts, clearAllDeployedData, exportDeploymentData, importDeploymentData, DeployedContracts, saveDeployedPool, getDeployedPools, removeDeployedPool } from '@/contracts/storage';
import { ContractId } from '@/contracts/bytecode';
import { priceToSqrtPriceX96, formatPrice, validatePrice, getTokenDecimals } from '@/lib/priceUtils';
import SpaceBackground from '@/components/backgrounds/SpaceBackground';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Shield, Rocket, Database, Settings, Wallet, AlertTriangle, ExternalLink, 
  Copy, Users, CheckCircle, Clock, XCircle, Loader2, RefreshCw, Download, Trash2,
  Calculator, Edit3, DollarSign, TrendingUp, TrendingDown, EyeOff, ShieldCheck,
  Upload, Smartphone, Monitor, Clipboard, Gamepad2
} from 'lucide-react';
import PoolVerification from '@/components/admin/PoolVerification';
import TreasurySection from '@/components/admin/TreasurySection';
import WalletLinkSection from '@/components/admin/WalletLinkSection';
import ProtocolConfigSection from '@/components/admin/ProtocolConfigSection';
import AuditLogSection from '@/components/admin/AuditLogSection';
import GameManagementSection from '@/components/admin/GameManagementSection';
import CrashGameContractSection from '@/components/admin/CrashGameContractSection';
import OnChainRoundManagement from '@/components/admin/OnChainRoundManagement';
import AutoGameControl from '@/components/admin/AutoGameControl';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Admin = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  
  // Secure backend admin check
  const { isAdmin: isDbAdmin, isLoading: isAdminLoading } = useAdminRole();
  const isLegacyAdmin = useLegacyAdminCheck();
  const isAdminWallet = isDbAdmin || isLegacyAdmin;
  
  const { deployContract, saveContractAddress, deploymentState, isDeploying, checkDependencies, loadSavedState } = useContractDeployment();
  
  // Manual address input state
  const [addressInputs, setAddressInputs] = useState<Record<string, string>>({});
  const { createPool, creationStatus, isCreating } = usePoolCreation();
  const { price: cexPrice, change24h: cexChange, loading: cexLoading, refetch: refetchCexPrice } = useCoinGeckoPrice();

  const [deployedContracts, setDeployedContracts] = useState<DeployedContracts>(getDeployedContracts());
  const [deployedPools, setDeployedPools] = useState(getDeployedPools());
  
  // Pool price inputs state
  const [poolPrices, setPoolPrices] = useState<Record<string, string>>({
    'USDT/USDC': '1.0',
    'WOVER/USDC': '0.0081',
    'WOVER/USDT': '0.0081',
  });
  const [useCustomPrice, setUseCustomPrice] = useState<Record<string, boolean>>({});
  const [importText, setImportText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Detect mobile device
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Load saved deployment state on mount
  useEffect(() => {
    loadSavedState();
    setDeployedContracts(getDeployedContracts());
    setDeployedPools(getDeployedPools());
  }, [loadSavedState]);

  // Redirect non-admin users (wait for loading to complete)
  useEffect(() => {
    if (!isAdminLoading && (!isConnected || !isAdminWallet)) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/');
    }
  }, [isConnected, isAdminWallet, isAdminLoading, navigate]);

  // Show loading state while checking admin status
  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SpaceBackground><div /></SpaceBackground>
        <div className="relative z-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking admin privileges...</p>
        </div>
      </div>
    );
  }

  if (!isConnected || !isAdminWallet) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const refreshContracts = () => {
    setDeployedContracts(getDeployedContracts());
    setDeployedPools(getDeployedPools());
    loadSavedState();
    toast.success('Refreshed contract data');
  };

  const handleSaveAddress = async (contractId: string) => {
    const inputAddress = addressInputs[contractId];
    if (!inputAddress) {
      toast.error('Please enter a contract address');
      return;
    }
    
    try {
      await saveContractAddress(contractId as ContractId, inputAddress);
      toast.success(`${contractId} address saved!`, {
        description: `Address: ${inputAddress.slice(0, 10)}...${inputAddress.slice(-8)}`,
      });
      setDeployedContracts(getDeployedContracts());
      setAddressInputs(prev => ({ ...prev, [contractId]: '' }));
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    }
  };

  const handleClearData = () => {
    if (confirm('Are you sure? This will clear all saved contract addresses locally.')) {
      clearAllDeployedData();
      setDeployedContracts(getDeployedContracts());
      setDeployedPools(getDeployedPools());
      loadSavedState();
      toast.success('Cleared all deployment data');
    }
  };

  // Handle pool creation
  const handleCreatePool = async (pool: typeof INITIAL_POOLS[0]) => {
    const poolName = pool.name;
    const priceStr = poolPrices[poolName] || '1';
    const validation = validatePrice(priceStr);
    
    if (!validation.valid) {
      toast.error(`Invalid price: ${validation.error}`);
      return;
    }

    const price = parseFloat(priceStr);
    
    // Get token addresses and symbols
    const tokens = poolName.split('/');
    const token0Symbol = tokens[0];
    const token1Symbol = tokens[1];
    const token0Address = TOKEN_ADDRESSES[token0Symbol as keyof typeof TOKEN_ADDRESSES];
    const token1Address = TOKEN_ADDRESSES[token1Symbol as keyof typeof TOKEN_ADDRESSES];

    if (!token0Address || !token1Address) {
      toast.error('Token addresses not found');
      return;
    }

    try {
      toast.info(`Creating ${poolName} pool... Sign the transaction in your wallet.`);
      
      const config: PoolConfig = {
        token0Symbol,
        token1Symbol,
        token0Address,
        token1Address,
        fee: pool.fee,
        initialPrice: price,
      };

      const poolAddress = await createPool(config);
      
      if (poolAddress) {
        saveDeployedPool(poolName, poolAddress);
        setDeployedPools(getDeployedPools());
        toast.success(`${poolName} pool created!`, {
          description: `Address: ${poolAddress.slice(0, 10)}...${poolAddress.slice(-8)}`,
        });
      }
    } catch (error: any) {
      toast.error(`Pool creation failed: ${error.message}`);
    }
  };

  // Calculate sqrtPriceX96 preview
  const getSqrtPriceX96Preview = (poolName: string): string => {
    const priceStr = poolPrices[poolName];
    if (!priceStr) return '—';
    
    const validation = validatePrice(priceStr);
    if (!validation.valid) return 'Invalid';
    
    try {
      const price = parseFloat(priceStr);
      const tokens = poolName.split('/');
      const token0Decimals = getTokenDecimals(tokens[0]);
      const token1Decimals = getTokenDecimals(tokens[1]);
      const sqrtPrice = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);
      // Truncate for display
      if (sqrtPrice.length > 20) {
        return sqrtPrice.slice(0, 10) + '...' + sqrtPrice.slice(-6);
      }
      return sqrtPrice;
    } catch {
      return 'Error';
    }
  };

  const handleExportData = () => {
    const data = exportDeploymentData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orocket-deployment-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported deployment data');
  };

  // Handle import from file
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processImport(text);
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle import from pasted text
  const handleTextImport = () => {
    if (!importText.trim()) {
      toast.error('Please paste JSON data');
      return;
    }
    processImport(importText);
    setImportText('');
    setShowImportDialog(false);
  };

  // Process import data
  const processImport = (jsonData: string) => {
    const result = importDeploymentData(jsonData);
    if (result.success) {
      setDeployedContracts(getDeployedContracts());
      setDeployedPools(getDeployedPools());
      loadSavedState();
      toast.success('Data imported successfully!', {
        description: 'Contract addresses and pools synced',
      });
    } else {
      toast.error('Import failed', {
        description: result.error,
      });
    }
  };

  // Copy current page URL for sharing
  const copyPageUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('URL copied to clipboard');
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get deployment status icon and color
  const getStatusDisplay = (contractId: string) => {
    const state = deploymentState[contractId];
    const savedAddress = deployedContracts[contractId as keyof DeployedContracts];

    if (state?.status === 'deploying') {
      return { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-warning', label: 'Deploying...' };
    }
    if (state?.status === 'deployed' || savedAddress) {
      return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-success', label: 'Deployed' };
    }
    if (state?.status === 'failed') {
      return { icon: <XCircle className="w-4 h-4" />, color: 'text-destructive', label: 'Failed' };
    }
    return { icon: <Clock className="w-4 h-4" />, color: 'text-muted-foreground', label: 'Not Deployed' };
  };

  // Check if contract can be deployed
  const canDeploy = (contractId: string) => {
    if (isDeploying) return false;
    const savedAddress = deployedContracts[contractId as keyof DeployedContracts];
    if (savedAddress) return false;
    const deps = checkDependencies(contractId as ContractId);
    return deps.met;
  };


  return (
    <div className="min-h-screen relative">
      <SpaceBackground><div /></SpaceBackground>
      
      <main className="relative z-10 pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10 text-warning" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text">Admin Panel</h1>
                <p className="text-muted-foreground">Contract deployment & protocol management</p>
              </div>
            </div>
            <div className="flex gap-2">
              <NeonButton variant="secondary" className="text-xs px-3 py-1.5" onClick={refreshContracts}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </NeonButton>
              <NeonButton variant="secondary" className="text-xs px-3 py-1.5" onClick={handleExportData}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export
              </NeonButton>
            </div>
          </div>

          {/* Network Info */}
          <GlowCard className="p-4 mb-6" glowColor="cyan">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-medium">{NETWORK_CONFIG.chainName}</span>
                <span className="text-xs text-muted-foreground">Chain ID: {NETWORK_CONFIG.chainId}</span>
              </div>
              <a 
                href={NETWORK_CONFIG.blockExplorerUrls[0]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </GlowCard>

          {/* Deployed Contracts Summary */}
          <GlowCard className="p-4 mb-6" glowColor="cyan">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              Deployed Contracts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(['factory', 'nftDescriptorLibrary', 'router', 'quoter', 'nftDescriptor', 'positionManager'] as const).map(key => (
                <div key={key} className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  {deployedContracts[key] ? (
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-success truncate flex-1">
                        {truncateAddress(deployedContracts[key]!)}
                      </code>
                      <button onClick={() => copyToClipboard(deployedContracts[key]!)} className="text-muted-foreground hover:text-primary">
                        <Copy className="w-3 h-3" />
                      </button>
                      <a 
                        href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${deployedContracts[key]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Not deployed</p>
                  )}
                </div>
              ))}
            </div>
          </GlowCard>

          {/* Admin Wallets Info */}
          <GlowCard className="p-4 mb-8" glowColor="purple">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-warning" />
                <span className="font-semibold text-foreground">Admin Wallets</span>
                <span className="text-xs text-muted-foreground">({ADMIN_WALLETS.length} authorized)</span>
              </div>
              
              {ADMIN_WALLETS.map((wallet, index) => {
                const isCurrentWallet = address?.toLowerCase() === wallet.toLowerCase();
                return (
                  <div 
                    key={wallet}
                    className={`flex items-center justify-between flex-wrap gap-2 p-2 rounded-lg ${
                      isCurrentWallet ? 'bg-primary/10 border border-primary/30' : 'bg-background/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className={`w-4 h-4 ${isCurrentWallet ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs text-muted-foreground">
                        {index === 0 ? 'Primary:' : 'Security:'}
                      </span>
                      <code className="text-xs md:text-sm font-mono text-foreground">
                        <span className="hidden md:inline">{wallet}</span>
                        <span className="md:hidden">{truncateAddress(wallet)}</span>
                      </code>
                      {isCurrentWallet && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Connected
                        </span>
                      )}
                      <button 
                        onClick={() => copyToClipboard(wallet)} 
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <a 
                      href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-xs"
                    >
                      Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          </GlowCard>

          <Tabs defaultValue="deploy" className="space-y-6">
            <TabsList className="glass-card p-1 w-full md:w-auto flex-wrap">
              <TabsTrigger value="deploy" className="flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Deploy
              </TabsTrigger>
              <TabsTrigger value="pools" className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Pools
              </TabsTrigger>
              <TabsTrigger value="game" className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" /> Game
              </TabsTrigger>
              <TabsTrigger value="treasury" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Treasury
              </TabsTrigger>
              <TabsTrigger value="verify" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Verify
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Security
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </TabsTrigger>
            </TabsList>

            {/* Deploy Contracts Tab */}
            <TabsContent value="deploy" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Contract Deployment
                </h2>
                <p className="text-muted-foreground mb-6">
                  Deploy Uniswap V3 contracts to OverProtocol Mainnet. Each step requires manual transaction signing.
                </p>

                {/* Deployment Progress */}
                {(() => {
                  const totalContracts = DEPLOYMENT_STEPS.length;
                  const deployedCount = DEPLOYMENT_STEPS.filter(step => 
                    deployedContracts[step.id as keyof DeployedContracts]
                  ).length;
                  const progressPercent = (deployedCount / totalContracts) * 100;
                  
                  return (
                    <div className="bg-background/50 border border-border/30 rounded-xl p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-primary" />
                          Deployment Progress
                        </h4>
                        <span className={`text-sm font-bold ${deployedCount === totalContracts ? 'text-success' : 'text-primary'}`}>
                          {deployedCount}/{totalContracts} Contracts
                        </span>
                      </div>
                      <div className="w-full h-3 bg-background rounded-full overflow-hidden border border-border/30">
                        <div 
                          className={`h-full transition-all duration-500 ease-out ${
                            deployedCount === totalContracts 
                              ? 'bg-gradient-to-r from-success to-success/80' 
                              : 'bg-gradient-to-r from-primary to-primary/80'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{deployedCount === 0 ? 'Not started' : deployedCount === totalContracts ? 'All contracts deployed!' : 'In progress...'}</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Deploy CLI Instructions */}
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
                  <h4 className="font-medium text-sm mb-2 text-warning">🚀 Deploy Contracts Externally</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Use the official Uniswap CLI tool to deploy contracts, then enter the addresses below:
                  </p>
                  <code className="block text-xs font-mono bg-background/80 text-foreground/90 p-3 rounded-lg overflow-x-auto whitespace-pre">
{`npx @uniswap/deploy-v3 \\
  --private-key YOUR_PRIVATE_KEY \\
  --json-rpc https://rpc.overprotocol.com \\
  --weth9-address 0x59c914C8ac6F212bb655737CC80d9Abc79A1e273 \\
  --native-currency-label OVER \\
  --owner-address ${address || 'YOUR_ADMIN_WALLET'} \\
  --confirmations 2`}
                  </code>
                  <p className="text-xs text-muted-foreground mt-3">
                    After deployment, copy each contract address from the CLI output and paste it below.
                  </p>
                </div>

                {/* Deployment Order Info */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                  <h4 className="font-medium text-sm mb-2">📋 Deployment Order</h4>
                  <p className="text-xs text-muted-foreground">
                    1. Factory → 2. NFTDescriptor → 3. Router, PositionManager, Quoter (parallel)
                  </p>
                </div>

                <div className="space-y-4">
                  {DEPLOYMENT_STEPS.map((step, index) => {
                    const contractId = step.id as ContractId;
                    const status = getStatusDisplay(contractId);
                    const savedAddress = deployedContracts[contractId as keyof DeployedContracts];
                    const deps = checkDependencies(contractId as ContractId);

                    return (
                      <div key={step.id} className="bg-background/50 rounded-xl p-4 border border-primary/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                                savedAddress ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
                              }`}>
                                {savedAddress ? <CheckCircle className="w-4 h-4" /> : index + 1}
                              </span>
                              <h3 className="font-semibold text-foreground">{step.name}</h3>
                              <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                                {status.icon}
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground ml-8">{step.description}</p>
                            
                            {/* Dependencies */}
                            {step.dependencies.length > 0 && (
                              <p className={`text-xs ml-8 mt-1 ${deps.met ? 'text-success' : 'text-warning'}`}>
                                {deps.met ? '✓ Dependencies met' : `⚠ Requires: ${deps.missing.join(', ')}`}
                              </p>
                            )}
                            
                            {/* Gas estimate */}
                            <p className="text-xs text-muted-foreground ml-8 mt-1">
                              Est. Cost: <span className="text-primary font-medium">~{step.estimatedGasOVER} OVER</span>
                              <span className="text-muted-foreground/60 ml-2">
                                ({parseInt(step.estimatedGas).toLocaleString()} gas)
                              </span>
                            </p>

                            {/* Deployed Address */}
                            {savedAddress && (
                              <div className="ml-8 mt-2 flex items-center gap-2">
                                <code className="text-xs font-mono text-success bg-success/10 px-2 py-1 rounded">
                                  {savedAddress}
                                </code>
                                <button onClick={() => copyToClipboard(savedAddress)} className="text-muted-foreground hover:text-primary">
                                  <Copy className="w-3 h-3" />
                                </button>
                                <a 
                                  href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${savedAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-xs flex items-center gap-1"
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {/* Input for manual address entry */}
                            {!savedAddress && (
                              <div className="ml-8 mt-3 flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Enter deployed contract address (0x...)"
                                  value={addressInputs[contractId] || ''}
                                  onChange={(e) => setAddressInputs(prev => ({ ...prev, [contractId]: e.target.value }))}
                                  className="flex-1 text-xs font-mono bg-background/50 border border-primary/30 rounded-lg px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            {/* Error Message for Failed Save */}
                            {deploymentState[contractId]?.status === 'failed' && deploymentState[contractId]?.error && (
                              <div className="ml-8 mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                                <p className="text-xs text-destructive flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {deploymentState[contractId].error}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {savedAddress ? (
                              <NeonButton 
                                variant="secondary"
                                className="text-sm px-4 py-2"
                                disabled
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Deployed
                              </NeonButton>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <NeonButton 
                                  onClick={async () => {
                                    try {
                                      toast.info(`Deploying ${step.name}... Sign the transaction in your wallet.`);
                                      await deployContract(contractId);
                                      setDeployedContracts(getDeployedContracts());
                                      toast.success(`${step.name} deployed successfully!`);
                                    } catch (error: any) {
                                      toast.error(`Deployment failed: ${error.message}`);
                                    }
                                  }}
                                  variant="primary"
                                  className="text-sm px-4 py-2"
                                  disabled={isDeploying || !deps.met}
                                >
                                  {isDeploying && deploymentState[contractId]?.status === 'deploying' ? (
                                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Deploying...</>
                                  ) : (
                                    <>🚀 Deploy</>
                                  )}
                                </NeonButton>
                                {addressInputs[contractId] && (
                                  <NeonButton 
                                    onClick={() => handleSaveAddress(contractId)}
                                    variant="secondary"
                                    className="text-xs px-3 py-1"
                                    disabled={isDeploying}
                                  >
                                    Save Manual
                                  </NeonButton>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlowCard>

              {/* Token Addresses Reference */}
              <GlowCard className="p-6">
                <h3 className="font-semibold mb-4">Token Addresses (OverProtocol Mainnet)</h3>
                <div className="space-y-2">
                  {Object.entries(TOKEN_ADDRESSES).map(([symbol, tokenAddress]) => (
                    <div key={symbol} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                      <span className="font-medium">{symbol}</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground hidden md:block">{tokenAddress}</code>
                        <code className="text-xs font-mono text-muted-foreground md:hidden">{truncateAddress(tokenAddress)}</code>
                        <button onClick={() => copyToClipboard(tokenAddress)} className="text-muted-foreground hover:text-primary">
                          <Copy className="w-4 h-4" />
                        </button>
                        <a 
                          href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </TabsContent>

            {/* Create Pools Tab */}
            <TabsContent value="pools" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Initial Pool Creation
                </h2>
                
                {!deployedContracts.factory ? (
                  <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Deploy the Factory contract first before creating pools.
                    </p>
                  </div>
                ) : !deployedContracts.positionManager ? (
                  <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Deploy the Position Manager contract to enable pool creation.
                    </p>
                  </div>
                ) : (
                  <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                    <p className="text-sm text-foreground">
                      All required contracts deployed! You can now create pools.
                    </p>
                  </div>
                )}

                {/* Live CEX Price Reference */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Live CEX Price Reference
                  </h4>
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <div className="flex items-center gap-2 bg-background/50 px-3 py-2 rounded-lg">
                      <span className="text-sm font-medium">OVER:</span>
                      {cexLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <span className="text-lg font-bold gradient-text">${cexPrice.toFixed(5)}</span>
                          <span className={`text-xs flex items-center gap-0.5 ${cexChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {cexChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {cexChange >= 0 ? '+' : ''}{cexChange.toFixed(2)}%
                          </span>
                        </>
                      )}
                    </div>
                    <NeonButton 
                      variant="secondary" 
                      className="text-xs px-3 py-1.5"
                      onClick={() => refetchCexPrice()}
                      disabled={cexLoading}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${cexLoading ? 'animate-spin' : ''}`} /> Refresh
                    </NeonButton>
                    <a 
                      href="https://www.coingecko.com/en/coins/overprotocol" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      CoinGecko <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use "Fetch CEX Price" button below to auto-populate pool prices with live market data.
                  </p>
                </div>

                <div className="space-y-6">
                  {INITIAL_POOLS.map((pool) => {
                    const poolName = pool.name;
                    const isPoolCreated = !!deployedPools[poolName];
                    const poolStatus = creationStatus[poolName];
                    const isPoolCreating = poolStatus?.status === 'creating';
                    const currentPrice = poolPrices[poolName] || '1';
                    const isCustom = useCustomPrice[poolName];

                    return (
                      <div key={pool.name} className="bg-background/50 rounded-xl p-5 border border-primary/20">
                        <div className="flex flex-col gap-4">
                          {/* Pool Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground text-lg">{pool.name}</h3>
                                {isPoolCreated && (
                                  <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Created
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{pool.description}</p>
                              <p className="text-xs text-primary mt-1">
                                Fee Tier: {FEE_TIER_CONFIG[pool.fee]?.label || `${pool.fee / 10000}%`}
                              </p>
                            </div>
                          </div>

                          {/* Price Input Section */}
                          {!isPoolCreated && (
                            <div className="bg-background/30 rounded-lg p-4 border border-border/30">
                              <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <Calculator className="w-4 h-4 text-primary" />
                                  Initial Price
                                </label>
                                <button
                                  onClick={() => setUseCustomPrice(prev => ({ ...prev, [poolName]: !prev[poolName] }))}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  {isCustom ? 'Use Suggested' : 'Custom Price'}
                                </button>
                              </div>
                              
                              <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1">
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="any"
                                      value={currentPrice}
                                      onChange={(e) => setPoolPrices(prev => ({ ...prev, [poolName]: e.target.value }))}
                                      disabled={!isCustom && !deployedContracts.positionManager}
                                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                                      placeholder="Enter price"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                      {pool.name.split('/')[1]} per {pool.name.split('/')[0]}
                                    </span>
                                  </div>
                                  {!validatePrice(currentPrice).valid && currentPrice && (
                                    <p className="text-xs text-destructive mt-1">{validatePrice(currentPrice).error}</p>
                                  )}
                                </div>
                                {/* Fetch CEX Price Button */}
                                {poolName.startsWith('WOVER/') && (
                                  <NeonButton
                                    variant="secondary"
                                    className="text-xs px-3 py-2"
                                    onClick={() => {
                                      if (cexPrice > 0) {
                                        setPoolPrices(prev => ({ ...prev, [poolName]: cexPrice.toFixed(6) }));
                                        setUseCustomPrice(prev => ({ ...prev, [poolName]: true }));
                                        toast.success(`Set ${poolName} price to $${cexPrice.toFixed(6)} from CoinGecko`);
                                      } else {
                                        toast.error('CEX price not available. Try refreshing.');
                                      }
                                    }}
                                    disabled={cexLoading || cexPrice <= 0}
                                  >
                                    <TrendingUp className="w-3 h-3 mr-1" /> Fetch CEX Price
                                  </NeonButton>
                                )}
                              </div>

                              {/* sqrtPriceX96 Preview */}
                              <div className="mt-3 pt-3 border-t border-border/30">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">sqrtPriceX96:</span>
                                  <code className="font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                                    {getSqrtPriceX96Preview(poolName)}
                                  </code>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Created Pool Address */}
                          {isPoolCreated && deployedPools[poolName] && (
                            <div className="flex items-center gap-2 bg-success/10 rounded-lg p-3">
                              <span className="text-xs text-muted-foreground">Pool Address:</span>
                              <code className="text-xs font-mono text-success flex-1 truncate">
                                {deployedPools[poolName]}
                              </code>
                              <button onClick={() => copyToClipboard(deployedPools[poolName]!)} className="text-muted-foreground hover:text-primary">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <a 
                                href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${deployedPools[poolName]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}

                          {/* Transaction Hash (during creation) */}
                          {poolStatus?.txHash && !isPoolCreated && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-warning" />
                              <a 
                                href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/tx/${poolStatus.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                View transaction
                              </a>
                            </div>
                          )}

                          {/* Create Button */}
                          <div className="flex justify-end">
                            <NeonButton 
                              variant={isPoolCreated ? 'secondary' : 'primary'}
                              className="text-sm px-5 py-2.5"
                              onClick={() => handleCreatePool(pool)}
                              disabled={!deployedContracts.positionManager || isCreating || isPoolCreated || !validatePrice(currentPrice).valid}
                            >
                              {isPoolCreating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                              ) : isPoolCreated ? (
                                <><CheckCircle className="w-4 h-4 mr-2" /> Pool Created</>
                              ) : (
                                <><Rocket className="w-4 h-4 mr-2" /> Create Pool</>
                              )}
                            </NeonButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlowCard>

              {/* Existing Pools Management */}
              {Object.keys(deployedPools).length > 0 && (
                <GlowCard className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-warning" />
                    Existing Pools
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage pools visible in the platform UI. Note: Hiding a pool only removes it from the UI - the pool remains on the blockchain.
                  </p>

                  <div className="space-y-3">
                    {Object.entries(deployedPools).map(([poolName, poolAddress]) => (
                      <div key={poolName} className="bg-background/50 rounded-xl p-4 border border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{poolName}</h4>
                            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Active</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-muted-foreground truncate max-w-[200px] md:max-w-none">
                              {poolAddress}
                            </code>
                            <button onClick={() => copyToClipboard(poolAddress!)} className="text-muted-foreground hover:text-primary">
                              <Copy className="w-3 h-3" />
                            </button>
                            <a 
                              href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${poolAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                        <NeonButton
                          variant="secondary"
                          className="text-xs px-3 py-1.5 text-warning border-warning/30 hover:bg-warning/10"
                          onClick={() => {
                            if (confirm(`Hide "${poolName}" from UI?\n\nThis will NOT delete the pool from the blockchain - it will only hide it from the platform UI. You can re-add it later by creating the pool again (it will find the existing pool).`)) {
                              const success = removeDeployedPool(poolName);
                              if (success) {
                                setDeployedPools(getDeployedPools());
                                toast.success(`${poolName} hidden from UI`, {
                                  description: 'Pool still exists on blockchain',
                                });
                              }
                            }
                          }}
                        >
                          <EyeOff className="w-3 h-3 mr-1" /> Hide from UI
                        </NeonButton>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <span>
                        <strong className="text-warning">Important:</strong> Uniswap V3 pools cannot be deleted from the blockchain. 
                        "Hide from UI" only removes the pool from your platform's interface. The pool will continue to exist on-chain 
                        and can be interacted with directly through the blockchain.
                      </span>
                    </p>
                  </div>
                </GlowCard>
              )}
            </TabsContent>

            {/* Game Management Tab */}
            <TabsContent value="game" className="space-y-6">
              {/* Auto Game Loop - Primary Control */}
              <div className="border-b border-border/30 pb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-success" />
                  Automatic Game Loop
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Start automatic gameplay - rounds cycle continuously (betting → flying → crash → payout)
                </p>
                <AutoGameControl />
              </div>
              
              {/* Smart Contract Deployment */}
              <CrashGameContractSection />
              
              {/* On-Chain Round Control (Manual) */}
              <div className="border-t border-border/30 pt-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Manual On-Chain Round Control
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Manual control for testing - start rounds, control flight phase, and trigger crash
                </p>
                <OnChainRoundManagement />
              </div>
              
              {/* Database Management Section */}
              <div className="border-t border-border/30 pt-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Off-Chain Game Management
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage game data stored in the database (backup system when blockchain is not available)
                </p>
                <GameManagementSection />
              </div>
            </TabsContent>

            {/* Treasury Tab */}
            <TabsContent value="treasury" className="space-y-6">
              <TreasurySection />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              {/* Mobile Sync Warning */}
              {isMobile && (
                <GlowCard className="p-4" glowColor="pink">
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-warning mb-1">Mobile Device Detected</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Contract deployment is best done on desktop. To sync data from desktop:
                      </p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside mb-3">
                        <li>On desktop: Go to Settings → Export Data</li>
                        <li>Transfer the JSON file to your phone</li>
                        <li>Here: Use Import Data below to sync</li>
                      </ol>
                    </div>
                  </div>
                </GlowCard>
              )}

              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Platform Settings
                </h2>
                
                <div className="space-y-4">
                  {/* Data Sync Section */}
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/30">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-primary" />
                      Data Sync
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sync contract addresses between devices. Export from desktop, import on mobile.
                    </p>
                    
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json,application/json"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <NeonButton variant="secondary" className="text-sm px-3 py-2" onClick={handleExportData}>
                        <Download className="w-4 h-4 mr-1" /> Export Data
                      </NeonButton>
                      <NeonButton 
                        variant="primary" 
                        className="text-sm px-3 py-2" 
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-1" /> Import File
                      </NeonButton>
                      <NeonButton 
                        variant="secondary" 
                        className="text-sm px-3 py-2" 
                        onClick={() => setShowImportDialog(!showImportDialog)}
                      >
                        <Clipboard className="w-4 h-4 mr-1" /> Paste JSON
                      </NeonButton>
                    </div>

                    {/* Paste JSON Dialog */}
                    {showImportDialog && (
                      <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border/30">
                        <label className="text-sm font-medium mb-2 block">Paste exported JSON data:</label>
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder='{"contracts": {...}, "pools": {...}}'
                          className="w-full h-32 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono resize-none"
                        />
                        <div className="flex gap-2 mt-3">
                          <NeonButton variant="primary" className="text-sm px-4 py-2" onClick={handleTextImport}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Import
                          </NeonButton>
                          <NeonButton 
                            variant="secondary" 
                            className="text-sm px-4 py-2" 
                            onClick={() => {
                              setShowImportDialog(false);
                              setImportText('');
                            }}
                          >
                            Cancel
                          </NeonButton>
                        </div>
                      </div>
                    )}

                    {/* Device info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30 mt-4">
                      <span className="flex items-center gap-1">
                        {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                        {isMobile ? 'Mobile' : 'Desktop'} Device
                      </span>
                      <span>•</span>
                      <span>Data stored locally in browser</span>
                    </div>
                  </div>

                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <h3 className="font-semibold mb-2">Fee Distribution</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how trading fees are split between LPs and protocol treasury.
                    </p>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">LP Share (%)</label>
                        <input 
                          type="number" 
                          value={PROTOCOL_FEE_CONFIG.lpShare} 
                          disabled
                          className="w-full mt-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Protocol Share (%)</label>
                        <input 
                          type="number" 
                          value={PROTOCOL_FEE_CONFIG.protocolShare} 
                          disabled
                          className="w-full mt-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Data Management */}
                  <div className="bg-background/50 rounded-xl p-4 border border-destructive/20">
                    <h3 className="font-semibold mb-2 text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Clear all locally stored data. This will not affect deployed contracts on blockchain.
                    </p>
                    <NeonButton variant="secondary" className="text-sm px-3 py-2 text-destructive border-destructive/30" onClick={handleClearData}>
                      <Trash2 className="w-4 h-4 mr-1" /> Clear All Local Data
                    </NeonButton>
                  </div>

                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                    <h3 className="font-semibold text-destructive mb-2">Emergency Controls</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Circuit breaker and pause functionality (available after deployment)
                    </p>
                    <NeonButton variant="secondary" className="text-sm px-4 py-2" disabled>
                      Pause Trading
                    </NeonButton>
                  </div>
                </div>
              </GlowCard>
            </TabsContent>

            {/* Pool Verification Tab */}
            <TabsContent value="verify" className="space-y-6">
              <PoolVerification />
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <WalletLinkSection />
              <ProtocolConfigSection />
              <AuditLogSection />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
