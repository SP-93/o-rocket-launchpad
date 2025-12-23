import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Rocket, Loader2, CheckCircle, XCircle, ExternalLink, 
  Copy, RefreshCw, Wallet, DollarSign, Shield, Play, Pause,
  TrendingUp, AlertTriangle, Database, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { getDeployedContracts } from '@/contracts/storage';
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
    refillPrizePool,
    distributeWoverRevenue,
    distributeUsdtRevenue,
    setPrizePoolPercentage,
    pauseGame,
    unpauseGame,
  } = useCrashGameContract();

  const [deployedContracts, setDeployedContracts] = useState(getDeployedContracts());
  const [refillAmount, setRefillAmount] = useState('');
  const [refillCurrency, setRefillCurrency] = useState<'wover' | 'usdt'>('wover');
  const [newPercentage, setNewPercentage] = useState(70);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deployGasLimit, setDeployGasLimit] = useState<string>('12000000');

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
      await refillPrizePool(signer, refillAmount, refillCurrency === 'wover');
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="font-medium">Contract Deployed</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-success">
                    {truncateAddress(deployedContracts.crashGame!)}
                  </code>
                  <button onClick={() => copyToClipboard(deployedContracts.crashGame!)} className="text-muted-foreground hover:text-primary">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a 
                    href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${deployedContracts.crashGame}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
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

            {/* Refresh Button */}
            <NeonButton 
              variant="secondary" 
              onClick={() => fetchContractState()} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh State
            </NeonButton>
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

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-background/50 rounded-lg p-4 border border-warning/30">
                <p className="text-xs text-muted-foreground mb-1">WOVER Pool</p>
                <p className="text-2xl font-bold text-warning">{contractState.prizePoolWover}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-4 border border-success/30">
                <p className="text-xs text-muted-foreground mb-1">USDT Pool</p>
                <p className="text-2xl font-bold text-success">{contractState.prizePoolUsdt}</p>
              </div>
            </div>

            {/* Refill Pool */}
            <div className="space-y-3">
              <Label>Refill Prize Pool</Label>
              <div className="flex gap-2">
                <select 
                  value={refillCurrency}
                  onChange={(e) => setRefillCurrency(e.target.value as 'wover' | 'usdt')}
                  className="bg-background border border-border rounded-lg px-3 py-2"
                >
                  <option value="wover">WOVER</option>
                  <option value="usdt">USDT</option>
                </select>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                  className="flex-1"
                />
                <NeonButton onClick={handleRefill} disabled={isUpdating || !refillAmount}>
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                </NeonButton>
              </div>
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
