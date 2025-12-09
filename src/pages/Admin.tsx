import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { useContractDeployment } from '@/hooks/useContractDeployment';
import { isAdmin, ADMIN_WALLETS, TOKEN_ADDRESSES, PROTOCOL_FEE_CONFIG, NETWORK_CONFIG } from '@/config/admin';
import { DEPLOYMENT_STEPS, INITIAL_POOLS, FEE_TIER_CONFIG } from '@/contracts/deployment/config';
import { getDeployedContracts, clearAllDeployedData, exportDeploymentData, DeployedContracts } from '@/contracts/storage';
import { ContractId } from '@/contracts/bytecode';
import SpaceBackground from '@/components/backgrounds/SpaceBackground';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Shield, Rocket, Database, Settings, Wallet, AlertTriangle, ExternalLink, 
  Copy, Users, CheckCircle, Clock, XCircle, Loader2, RefreshCw, Download, Trash2 
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Admin = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const isAdminWallet = isAdmin(address);
  const { deployContract, deploymentState, isDeploying, checkDependencies, loadSavedState } = useContractDeployment();

  const [deployedContracts, setDeployedContracts] = useState<DeployedContracts>(getDeployedContracts());

  // Load saved deployment state on mount
  useEffect(() => {
    loadSavedState();
    setDeployedContracts(getDeployedContracts());
  }, [loadSavedState]);

  // Redirect non-admin users
  useEffect(() => {
    if (!isConnected || !isAdminWallet) {
      toast.error('Access denied. Admin wallet required.');
      navigate('/');
    }
  }, [isConnected, isAdminWallet, navigate]);

  if (!isConnected || !isAdminWallet) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const refreshContracts = () => {
    setDeployedContracts(getDeployedContracts());
    loadSavedState();
    toast.success('Refreshed contract data');
  };

  const handleDeploy = async (contractId: string) => {
    try {
      toast.info(`Preparing ${contractId} deployment... Sign the transaction in your wallet.`);
      const deployedAddress = await deployContract(contractId as ContractId);
      if (deployedAddress) {
        toast.success(`${contractId} deployed successfully!`, {
          description: `Address: ${deployedAddress.slice(0, 10)}...${deployedAddress.slice(-8)}`,
        });
        setDeployedContracts(getDeployedContracts());
      }
    } catch (error: any) {
      toast.error(`Deployment failed: ${error.message}`);
    }
  };

  const handleClearData = () => {
    if (confirm('Are you sure? This will clear all saved contract addresses locally.')) {
      clearAllDeployedData();
      setDeployedContracts(getDeployedContracts());
      loadSavedState();
      toast.success('Cleared all deployment data');
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

  // Map DEPLOYMENT_STEPS to ContractIds
  const stepToContractId: Record<string, ContractId> = {
    'UniswapV3Factory': 'factory',
    'SwapRouter': 'router',
    'NFTDescriptor': 'nftDescriptor',
    'NonfungiblePositionManager': 'positionManager',
    'QuoterV2': 'quoter',
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {(['factory', 'router', 'positionManager', 'quoter'] as const).map(key => (
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
            <TabsList className="glass-card p-1 w-full md:w-auto">
              <TabsTrigger value="deploy" className="flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Deploy Contracts
              </TabsTrigger>
              <TabsTrigger value="pools" className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Create Pools
              </TabsTrigger>
              <TabsTrigger value="treasury" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Treasury
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

                {/* Deployment Order Info */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                  <h4 className="font-medium text-sm mb-2">📋 Deployment Order</h4>
                  <p className="text-xs text-muted-foreground">
                    1. Factory → 2. NFTDescriptor → 3. Router, PositionManager, Quoter (parallel)
                  </p>
                </div>

                <div className="space-y-4">
                  {DEPLOYMENT_STEPS.map((step, index) => {
                    const contractId = stepToContractId[step.id] || step.id.toLowerCase();
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

                            {/* Transaction Hash (during deployment) */}
                            {deploymentState[contractId]?.txHash && !savedAddress && (
                              <div className="ml-8 mt-2">
                                <a 
                                  href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/tx/${deploymentState[contractId].txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  View transaction <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                          
                          <NeonButton 
                            onClick={() => handleDeploy(contractId)}
                            variant={savedAddress ? 'secondary' : 'primary'}
                            className="text-sm px-4 py-2"
                            disabled={!canDeploy(contractId) && !savedAddress}
                          >
                            {isDeploying && deploymentState[contractId]?.status === 'deploying' ? (
                              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Deploying...</>
                            ) : savedAddress ? (
                              <><CheckCircle className="w-4 h-4 mr-1" /> Deployed</>
                            ) : (
                              'Deploy'
                            )}
                          </NeonButton>
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

                <div className="space-y-4">
                  {INITIAL_POOLS.map((pool) => (
                    <div key={pool.name} className="bg-background/50 rounded-xl p-4 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{pool.name}</h3>
                          <p className="text-sm text-muted-foreground">{pool.description}</p>
                          <p className="text-xs text-primary mt-1">
                            Fee: {FEE_TIER_CONFIG[pool.fee]?.label || `${pool.fee / 10000}%`}
                          </p>
                        </div>
                        <NeonButton 
                          variant="secondary" 
                          className="text-sm px-4 py-2" 
                          disabled={!deployedContracts.positionManager}
                        >
                          Create Pool
                        </NeonButton>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </TabsContent>

            {/* Treasury Tab */}
            <TabsContent value="treasury" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Protocol Treasury
                </h2>
                <p className="text-muted-foreground mb-6">
                  View and manage protocol fees. Fees are stored in original tokens and never auto-converted.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">LP Share</p>
                    <p className="text-2xl font-bold gradient-text">{PROTOCOL_FEE_CONFIG.lpShare}%</p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Protocol Share</p>
                    <p className="text-2xl font-bold text-warning">{PROTOCOL_FEE_CONFIG.protocolShare}%</p>
                  </div>
                </div>

                <div className="text-center text-muted-foreground py-8">
                  Treasury balances will appear after contracts are deployed and pools have activity
                </div>
              </GlowCard>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Platform Settings
                </h2>
                
                <div className="space-y-4">
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
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <h3 className="font-semibold mb-2">Data Management</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage locally stored contract addresses and deployment data.
                    </p>
                    <div className="flex gap-2">
                      <NeonButton variant="secondary" className="text-sm px-3 py-2" onClick={handleExportData}>
                        <Download className="w-4 h-4 mr-1" /> Export Data
                      </NeonButton>
                      <NeonButton variant="secondary" className="text-sm px-3 py-2 text-destructive border-destructive/30" onClick={handleClearData}>
                        <Trash2 className="w-4 h-4 mr-1" /> Clear All Data
                      </NeonButton>
                    </div>
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
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
