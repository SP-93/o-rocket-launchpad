import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Rocket, Loader2, CheckCircle, XCircle, ExternalLink, 
  Copy, RefreshCw, Wallet, Shield, AlertTriangle, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { getDeployedContracts, getDeployedContractsAsync, clearCrashGameAddress } from '@/contracts/storage';
import { useWallet } from '@/hooks/useWallet';
import { TOKEN_ADDRESSES } from '@/config/admin';
import { CRASH_GAME_BYTECODE, CLAIM_SIGNER_ADDRESS } from '@/contracts/artifacts/crashGame';
import { analyzeBytecode } from '@/lib/bytecodeAnalyzer';

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
    emergencyWithdraw,
  } = useCrashGameContract();

  const [deployedContracts, setDeployedContracts] = useState(getDeployedContracts());
  const [refillAmount, setRefillAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deployGasLimit, setDeployGasLimit] = useState<string>('5000000');
  const [contractOwner, setContractOwner] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!address || !contractOwner) return false;
    return address.toLowerCase() === contractOwner.toLowerCase();
  }, [address, contractOwner]);

  const bytecodeAnalysis = useMemo(() => {
    return analyzeBytecode(CRASH_GAME_BYTECODE);
  }, []);

  const getSigner = useCallback(async () => {
    const client = await getProvider();
    if (!client) return null;
    const provider = new ethers.providers.Web3Provider(client as any);
    return provider.getSigner();
  }, [getProvider]);

  useEffect(() => {
    const init = async () => {
      const contracts = await getDeployedContractsAsync();
      setDeployedContracts(contracts);
      
      if (contracts.crashGame) {
        fetchContractState();
        const owner = await getContractOwner();
        if (owner) setContractOwner(owner);
      }
    };
    init();
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
      // New contract only needs WOVER token and claim signer
      await deployCrashGame(
        signer,
        TOKEN_ADDRESSES.WOVER,
        CLAIM_SIGNER_ADDRESS,
        { gasLimit }
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
      await refillPrizePool(signer, refillAmount);
      setRefillAmount('');
      fetchContractState();
    } catch (error: any) {
      toast.error('Refill failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    const signer = await getSigner();
    if (!signer || !withdrawAmount) {
      toast.error('Please enter amount and connect wallet');
      return;
    }

    if (!window.confirm('Are you sure you want to withdraw from the prize pool?')) {
      return;
    }

    setIsUpdating(true);
    try {
      await emergencyWithdraw(signer, withdrawAmount);
      setWithdrawAmount('');
      fetchContractState();
    } catch (error: any) {
      toast.error('Withdraw failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearAddress = () => {
    if (window.confirm('Are you sure you want to clear the stored CrashGame address?')) {
      clearCrashGameAddress();
      setDeployedContracts(getDeployedContracts());
      toast.success('CrashGame address cleared');
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
          CrashGame Smart Contract (v2 - Signature Claims)
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
                  <button 
                    onClick={() => copyToClipboard(deployedContracts.crashGame!)} 
                    className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                
                <div className="bg-background/30 rounded p-2 break-all">
                  <code className="text-[10px] font-mono text-success">
                    {deployedContracts.crashGame}
                  </code>
                </div>
                
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
                  <p className="text-xs text-muted-foreground">Prize Pool</p>
                  <p className="text-lg font-bold text-primary">
                    {parseFloat(contractState.prizePool).toFixed(2)} WOVER
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Total Deposited</p>
                  <p className="text-lg font-bold">
                    {parseFloat(contractState.totalDeposited).toFixed(2)}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Total Claimed</p>
                  <p className="text-lg font-bold">
                    {parseFloat(contractState.totalClaimed).toFixed(2)}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Pool Status</p>
                  <p className={`text-lg font-bold ${contractState.isPoolLow ? 'text-destructive' : 'text-success'}`}>
                    {contractState.isPoolLow ? '⚠️ Low' : '✓ OK'}
                  </p>
                </div>
              </div>
            )}

            {/* Claim Signer Info */}
            {contractState && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Claim Signer</span>
                </div>
                <code className="text-xs font-mono text-muted-foreground">
                  {contractState.claimSigner}
                </code>
              </div>
            )}

            {/* Owner Info */}
            {contractOwner && (
              <div className={`rounded-lg p-3 ${isOwner ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'}`}>
                <p className="text-xs text-muted-foreground mb-1">Contract Owner</p>
                <code className="text-xs font-mono">{truncateAddress(contractOwner)}</code>
                <p className="text-xs mt-1">
                  {isOwner ? (
                    <span className="text-success">✓ You are the owner</span>
                  ) : (
                    <span className="text-warning">⚠️ You are NOT the owner</span>
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <NeonButton 
                variant="secondary" 
                onClick={() => fetchContractState()} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
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
            {/* Not Deployed Warning */}
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="font-medium">Contract Not Deployed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Deploy the CrashGame v2 contract to enable on-chain claims.
              </p>
            </div>

            {/* Config Display */}
            <div className="bg-background/50 rounded-lg p-4 border border-border/30">
              <h4 className="text-sm font-semibold mb-3">Contract Configuration</h4>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WOVER Token:</span>
                  <code className="font-mono">{truncateAddress(TOKEN_ADDRESSES.WOVER)}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim Signer:</span>
                  <code className="font-mono">{truncateAddress(CLAIM_SIGNER_ADDRESS)}</code>
                </div>
              </div>
            </div>

            {/* Bytecode Check */}
            {bytecodeAnalysis.hasPush0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="font-medium text-destructive">PUSH0 Detected</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bytecode uses Shanghai opcodes. Recompile with EVM Paris target.
                </p>
              </div>
            )}

            {/* Gas Limit */}
            <div>
              <Label className="text-xs">Deploy Gas Limit</Label>
              <Input
                type="number"
                value={deployGasLimit}
                onChange={(e) => setDeployGasLimit(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Deploy Button */}
            <NeonButton
              onClick={handleDeploy}
              disabled={isDeploying || !isConnected || bytecodeAnalysis.hasPush0}
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

      {/* Prize Pool Management - Only show if deployed and owner */}
      {isContractDeployed && isOwner && (
        <GlowCard className="p-6" glowColor="purple">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Prize Pool Management
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Refill */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Refill Prize Pool</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount (WOVER)"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                />
                <NeonButton
                  onClick={handleRefill}
                  disabled={isUpdating || !refillAmount}
                  className="shrink-0"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refill'}
                </NeonButton>
              </div>
            </div>

            {/* Emergency Withdraw */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-destructive">Emergency Withdraw</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount (WOVER)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <NeonButton
                  variant="secondary"
                  onClick={handleEmergencyWithdraw}
                  disabled={isUpdating || !withdrawAmount}
                  className="shrink-0 text-destructive"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}
                </NeonButton>
              </div>
            </div>
          </div>
        </GlowCard>
      )}
    </div>
  );
};

export default CrashGameContractSection;
