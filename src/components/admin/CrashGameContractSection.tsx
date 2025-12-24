import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Rocket, Loader2, CheckCircle, XCircle, ExternalLink, 
  Copy, RefreshCw, Wallet, DollarSign, Shield, Play, Pause,
  TrendingUp, AlertTriangle, Database, Info, Search, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { useOnChainBytecodeAnalysis } from '@/hooks/useOnChainBytecodeAnalysis';
import { getDeployedContracts, clearCrashGameAddress } from '@/contracts/storage';
import { useWallet } from '@/hooks/useWallet';
import { TOKEN_ADDRESSES, NETWORK_CONFIG, TREASURY_WALLET } from '@/config/admin';
import { CRASH_GAME_BYTECODE } from '@/contracts/artifacts/crashGame';
import { analyzeBytecode } from '@/lib/bytecodeAnalyzer';

const FACTORY_DEPLOYER_WALLET = '0x8334966329b7f4b459633696A8CA59118253bC89';

const CrashGameContractSection = () => {
  const { address, getProvider, isConnected } = useWallet();
  const {
    isDeploying,
    isLoading,
    contractState,
    deployCrashGame,
    fetchContractState,
    getContractOwner,
    refillPrizePool,
    distributeWoverRevenue,
    distributeUsdtRevenue,
    setPrizePoolPercentage,
    pauseGame,
    unpauseGame,
  } = useCrashGameContract();

  const [deployedContracts, setDeployedContracts] = useState(getDeployedContracts());
  const [refillAmount, setRefillAmount] = useState('');
  // Prize pool only uses WOVER (per spec)
  const [newPercentage, setNewPercentage] = useState(70);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deployGasLimit, setDeployGasLimit] = useState<string>('12000000');
  const [contractOwner, setContractOwner] = useState<string | null>(null);

  // On-chain bytecode analysis hook
  const { 
    isAnalyzing: isAnalyzingOnChain, 
    analysis: onChainAnalysis, 
    error: analysisError,
    analyzeOnChain,
    clearAnalysis
  } = useOnChainBytecodeAnalysis();

  // Check if current wallet is owner
  const isOwner = useMemo(() => {
    if (!address || !contractOwner) return false;
    return address.toLowerCase() === contractOwner.toLowerCase();
  }, [address, contractOwner]);

  // Analyze bytecode for PUSH0 compatibility
  const bytecodeAnalysis = useMemo(() => {
    return analyzeBytecode(CRASH_GAME_BYTECODE);
  }, []);

  // Get ethers signer from wallet client
  const getSigner = useCallback(async () => {
    const client = await getProvider();
    if (!client) return null;
    
    // Convert viem wallet client to ethers signer
    const provider = new ethers.providers.Web3Provider(client as any);
    return provider.getSigner();
  }, [getProvider]);

  useEffect(() => {
    setDeployedContracts(getDeployedContracts());
    if (deployedContracts.crashGame) {
      fetchContractState();
      // Fetch owner
      getContractOwner().then(owner => {
        if (owner) setContractOwner(owner);
      });
    }
  }, []);

  const isContractDeployed = !!deployedContracts.crashGame;

  const handleDeploy = async () => {
    const signer = await getSigner();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }

    const parsedGas = Number(deployGasLimit);
    const gasLimit = Number.isFinite(parsedGas) && parsedGas > 0 ? Math.floor(parsedGas) : undefined;

    try {
      await deployCrashGame(
        signer,
        TOKEN_ADDRESSES.WOVER,
        TOKEN_ADDRESSES.USDT,
        TREASURY_WALLET,
        FACTORY_DEPLOYER_WALLET,
        {
          gasLimit,
        }
      );
      setDeployedContracts(getDeployedContracts());
      fetchContractState();
    } catch (error: any) {
      console.error('Deployment failed:', error);
    }
  };

  const handleRefill = async () => {
    const signer = await getSigner();
    if (!signer || !refillAmount) {
      toast.error('Please enter amount and connect wallet');
      return;
    }

    setIsUpdating(true);
    try {
      await refillPrizePool(signer, refillAmount, true); // Always WOVER for prize pool
      setRefillAmount('');
      fetchContractState();
    } catch (error: any) {
      toast.error('Refill failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDistributeWover = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setIsUpdating(true);
    try {
      await distributeWoverRevenue(signer);
      fetchContractState();
    } catch (error: any) {
      toast.error('Distribution failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDistributeUsdt = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setIsUpdating(true);
    try {
      await distributeUsdtRevenue(signer);
      fetchContractState();
    } catch (error: any) {
      toast.error('Distribution failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetPercentage = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setIsUpdating(true);
    try {
      await setPrizePoolPercentage(signer, newPercentage);
      fetchContractState();
    } catch (error: any) {
      toast.error('Update failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePauseToggle = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setIsUpdating(true);
    try {
      if (contractState?.isPaused) {
        await unpauseGame(signer);
      } else {
        await pauseGame(signer);
      }
      fetchContractState();
    } catch (error: any) {
      toast.error('Toggle failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAnalyzeOnChain = async () => {
    await analyzeOnChain(TOKEN_ADDRESSES.WOVER, TOKEN_ADDRESSES.USDT);
  };

  const handleClearAddress = () => {
    if (window.confirm('Are you sure you want to clear the stored CrashGame address? This will NOT affect the deployed contract on-chain.')) {
      clearCrashGameAddress();
      clearAnalysis();
      setDeployedContracts(getDeployedContracts());
      toast.success('CrashGame address cleared from local storage');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Contract Deployment Status */}
      <GlowCard className="p-6" glowColor="cyan">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          CrashGame Smart Contract
        </h3>

        {isContractDeployed ? (
          <div className="space-y-4">
            {/* Contract Address */}
            <div className="bg-success/10 border border-success/30 rounded-lg p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="font-medium">Contract Deployed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(deployedContracts.crashGame!)} 
                      className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                      title="Copy address"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>
                
                {/* Full address display */}
                <div className="bg-background/30 rounded p-2 break-all">
                  <code className="text-[10px] font-mono text-success">
                    {deployedContracts.crashGame}
                  </code>
                </div>
                
                {/* Explorer link - proper <a> tag */}
                <a 
                  href={`https://scan.over.network/address/${deployedContracts.crashGame}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View on Over Network Explorer</span>
                </a>
              </div>
            </div>

            {/* Contract State */}
            {contractState && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Round</p>
                  <p className="text-lg font-bold">#{contractState.currentRoundId}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Pool %</p>
                  <p className="text-lg font-bold">{contractState.prizePoolPercentage}%</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Min Bet</p>
                  <p className="text-lg font-bold">{contractState.minBet}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`text-lg font-bold ${contractState.isPaused ? 'text-destructive' : 'text-success'}`}>
                    {contractState.isPaused ? 'Paused' : 'Active'}
                  </p>
                </div>
              </div>
            )}

            {/* On-Chain Diagnostics Panel */}
            <div className="bg-background/50 rounded-lg p-4 border border-border/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">On-Chain Bytecode Diagnostics</span>
                </div>
                <div className="flex items-center gap-2">
                  <NeonButton 
                    variant="secondary" 
                    onClick={handleAnalyzeOnChain}
                    disabled={isAnalyzingOnChain}
                    className="text-xs px-3 py-1"
                  >
                    {isAnalyzingOnChain ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-3 h-3 mr-1" />
                        Analyze
                      </>
                    )}
                  </NeonButton>
                </div>
              </div>

              {analysisError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-xs text-destructive">
                  {analysisError}
                </div>
              )}

              {onChainAnalysis && (
                <div className="space-y-2">
                  {/* PUSH0 Status - Main Indicator */}
                  <div className={`rounded p-3 border ${
                    onChainAnalysis.bytecodeAnalysis.hasPush0 
                      ? 'bg-destructive/10 border-destructive/30' 
                      : 'bg-success/10 border-success/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      {onChainAnalysis.bytecodeAnalysis.hasPush0 ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-success" />
                      )}
                      <span className="font-medium">
                        On-Chain PUSH0: {onChainAnalysis.bytecodeAnalysis.hasPush0 ? 'PRESENT ⚠️' : 'Not Found ✓'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {onChainAnalysis.bytecodeAnalysis.hasPush0 
                        ? 'Contract uses Shanghai opcode - may cause "invalid jump destination" errors'
                        : 'Contract uses Paris-compatible opcodes'
                      }
                    </p>
                  </div>

                  {/* Bytecode Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/30 rounded p-2">
                      <span className="text-muted-foreground">Bytecode Size: </span>
                      <span className="font-mono">{onChainAnalysis.bytecodeLength.toLocaleString()} bytes</span>
                    </div>
                    <div className="bg-background/30 rounded p-2">
                      <span className="text-muted-foreground">EVM Version: </span>
                      <span className={`font-mono ${
                        onChainAnalysis.bytecodeAnalysis.evmVersion === 'shanghai' 
                          ? 'text-destructive' 
                          : 'text-success'
                      }`}>
                        {onChainAnalysis.bytecodeAnalysis.evmVersion.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Bytecode Hash */}
                  <div className="bg-background/30 rounded p-2">
                    <span className="text-xs text-muted-foreground">Hash: </span>
                    <code className="text-[10px] font-mono break-all">{onChainAnalysis.bytecodeHash}</code>
                  </div>

                  {/* Token Balances in Contract */}
                  {onChainAnalysis.tokenBalances && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-warning/10 border border-warning/30 rounded p-2">
                        <span className="text-muted-foreground">Contract WOVER Balance: </span>
                        <span className="font-bold text-warning">{onChainAnalysis.tokenBalances.wover}</span>
                      </div>
                      <div className="bg-success/10 border border-success/30 rounded p-2">
                        <span className="text-muted-foreground">Contract USDT Balance: </span>
                        <span className="font-bold text-success">{onChainAnalysis.tokenBalances.usdt}</span>
                      </div>
                    </div>
                  )}

                  {/* Compare with Internal State */}
                  {onChainAnalysis.tokenBalances && contractState && (
                    <div className="bg-primary/10 border border-primary/30 rounded p-2">
                      <p className="text-xs font-medium mb-1">Balance vs Internal State Comparison:</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-muted-foreground">WOVER Real: </span>
                          <span className="font-mono">{onChainAnalysis.tokenBalances.wover}</span>
                          <span className="text-muted-foreground"> | Internal: </span>
                          <span className="font-mono">{contractState.prizePoolWover}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">USDT Real: </span>
                          <span className="font-mono">{onChainAnalysis.tokenBalances.usdt}</span>
                          <span className="text-muted-foreground"> | Internal: </span>
                          <span className="font-mono">{contractState.prizePoolUsdt}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Analyzed at: {onChainAnalysis.fetchedAt.toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2">
              <NeonButton 
                variant="secondary" 
                onClick={() => fetchContractState()} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh State
              </NeonButton>
              
              <NeonButton 
                variant="secondary" 
                onClick={handleClearAddress}
                className="px-4 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </NeonButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="font-medium">Contract Not Deployed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Deploy the CrashGame contract to enable on-chain game functionality with provably fair mechanics.
              </p>
            </div>

            {/* Deployment Info */}
            <div className="bg-background/50 rounded-lg p-4 border border-border/30 text-sm space-y-2">
              <p><strong>WOVER Token:</strong> {truncateAddress(TOKEN_ADDRESSES.WOVER)}</p>
              <p><strong>USDT Token:</strong> {truncateAddress(TOKEN_ADDRESSES.USDT)}</p>
              <p><strong>Treasury:</strong> {truncateAddress(TREASURY_WALLET)}</p>
              <p><strong>Factory Deployer:</strong> {truncateAddress(FACTORY_DEPLOYER_WALLET)}</p>
            </div>

            {/* PUSH0 Warning */}
            {bytecodeAnalysis.hasPush0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-destructive">EVM Compatibility Issue Detected</p>
                    <p className="text-sm text-muted-foreground">
                      Bytecode contains <code className="bg-background/50 px-1 rounded">PUSH0</code> opcode 
                      (Solidity 0.8.20 Shanghai). Over Protocol may not support this opcode yet.
                    </p>
                    <div className="bg-background/30 rounded p-3 text-sm">
                      <p className="font-medium mb-2">How to fix:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Open Remix IDE (<code>remix.ethereum.org</code>)</li>
                        <li>Load CrashGame.sol</li>
                        <li>In Compiler → Advanced → set <strong>EVM Version: Paris</strong></li>
                        <li>Compile and copy new ABI + Bytecode</li>
                        <li>Update <code>crashGame.ts</code> artifacts</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bytecode Info */}
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Bytecode Status</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">EVM Target: </span>
                  <span className={bytecodeAnalysis.hasPush0 ? 'text-destructive' : 'text-success'}>
                    {bytecodeAnalysis.evmVersion.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">PUSH0: </span>
                  <span className={bytecodeAnalysis.hasPush0 ? 'text-destructive' : 'text-success'}>
                    {bytecodeAnalysis.hasPush0 ? 'Present ⚠️' : 'Not found ✓'}
                  </span>
                </div>
              </div>
            </div>

            {/* Deploy gas controls */}
            <div className="bg-background/30 rounded-lg p-4 border border-border/30 space-y-2">
              <Label htmlFor="deployGasLimit" className="text-sm">Deploy Gas Limit</Label>
              <Input
                id="deployGasLimit"
                inputMode="numeric"
                placeholder="12000000"
                value={deployGasLimit}
                onChange={(e) => setDeployGasLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Default: 12M. If deploy reverts without PUSH0 issue, try increasing to 15-20M.
              </p>
            </div>

            <NeonButton 
              onClick={handleDeploy} 
              disabled={isDeploying}
              className="w-full"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Deploy CrashGame Contract
                </>
              )}
            </NeonButton>
          </div>
        )}
      </GlowCard>

      {/* On-Chain Management - Only show if deployed */}
      {isContractDeployed && contractState && (
        <>
          {/* Prize Pool Management */}
          <GlowCard className="p-6" glowColor="purple">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warning" />
              On-Chain Prize Pool
            </h3>

            {/* Ownership Info */}
            {contractOwner && (
              <div className={`rounded-lg p-3 mb-4 border ${isOwner ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">
                    {isOwner ? 'You are the contract owner' : 'You are NOT the contract owner'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Owner: <code className="text-[10px]">{contractOwner}</code>
                </p>
                {!isOwner && (
                  <p className="text-xs text-destructive mt-1">
                    Only the owner can refill prize pool and distribute revenue
                  </p>
                )}
              </div>
            )}

            {/* WOVER Prize Pool - Only WOVER for payouts per spec */}
            <div className="bg-warning/10 rounded-lg p-4 border border-warning/30 mb-4">
              <p className="text-xs text-muted-foreground mb-1">🎮 Prize Pool (WOVER only)</p>
              <p className="text-2xl font-bold text-warning">{contractState.prizePoolWover} WOVER</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                All player payouts are in WOVER tokens
              </p>
            </div>

            {/* Debug Info - Token Addresses */}
            <div className="bg-background/30 rounded-lg p-3 mb-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Contract Token Config</span>
              </div>
              <div className="grid gap-1 text-[10px] font-mono">
                <p><span className="text-muted-foreground">WOVER: </span>{TOKEN_ADDRESSES.WOVER}</p>
                <p><span className="text-muted-foreground">USDT: </span>{TOKEN_ADDRESSES.USDT}</p>
              </div>
            </div>

            {/* Refill Pool - WOVER only */}
            <div className="space-y-3">
              <Label>Refill Prize Pool (WOVER)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount in WOVER"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                  className="flex-1"
                  disabled={!isOwner}
                />
                <NeonButton onClick={handleRefill} disabled={isUpdating || !refillAmount || !isOwner}>
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                </NeonButton>
              </div>
              {!isOwner && (
                <p className="text-xs text-destructive">Connect with owner wallet to refill</p>
              )}
            </div>
          </GlowCard>

          {/* Revenue Distribution */}
          <GlowCard className="p-6" glowColor="cyan">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              On-Chain Revenue
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-background/50 rounded-lg p-4 border border-warning/30">
                <p className="text-xs text-muted-foreground mb-1">Pending WOVER</p>
                <p className="text-2xl font-bold text-warning">{contractState.pendingRevenueWover}</p>
                <NeonButton 
                  onClick={handleDistributeWover} 
                  disabled={isUpdating || parseFloat(contractState.pendingRevenueWover) <= 0}
                  className="w-full mt-2"
                  variant="secondary"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                  Distribute
                </NeonButton>
              </div>
              <div className="bg-background/50 rounded-lg p-4 border border-success/30">
                <p className="text-xs text-muted-foreground mb-1">Pending USDT</p>
                <p className="text-2xl font-bold text-success">{contractState.pendingRevenueUsdt}</p>
                <NeonButton 
                  onClick={handleDistributeUsdt} 
                  disabled={isUpdating || parseFloat(contractState.pendingRevenueUsdt) <= 0}
                  className="w-full mt-2"
                  variant="secondary"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                  Distribute
                </NeonButton>
              </div>
            </div>

            {/* Prize Pool Percentage */}
            <div className="bg-background/30 rounded-lg p-4 mt-4">
              <Label className="mb-2 block">Prize Pool Distribution %</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gradient-to-r from-primary to-accent rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono font-bold w-16 text-center">{newPercentage}%</span>
                <NeonButton 
                  onClick={handleSetPercentage} 
                  disabled={isUpdating || newPercentage === contractState.prizePoolPercentage}
                  variant="secondary"
                  className="px-3"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </NeonButton>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {newPercentage}% → Prize Pool, {100 - newPercentage}% → Platform
              </p>
            </div>
          </GlowCard>

          {/* Game Controls */}
          <GlowCard className="p-6" glowColor="purple">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Contract Controls
            </h3>

            <div className="flex gap-4">
              <NeonButton 
                onClick={handlePauseToggle} 
                disabled={isUpdating}
                variant={contractState.isPaused ? 'primary' : 'secondary'}
                className="flex-1"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : contractState.isPaused ? (
                  <Play className="w-4 h-4 mr-2" />
                ) : (
                  <Pause className="w-4 h-4 mr-2" />
                )}
                {contractState.isPaused ? 'Unpause Game' : 'Pause Game'}
              </NeonButton>
            </div>

            {contractState.isPaused && (
              <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Game is currently paused</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Players cannot place bets while the game is paused.
                </p>
              </div>
            )}
          </GlowCard>
        </>
      )}
    </div>
  );
};

export default CrashGameContractSection;
