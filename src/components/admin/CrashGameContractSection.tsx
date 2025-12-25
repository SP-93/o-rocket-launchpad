import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Rocket, Loader2, CheckCircle, XCircle, ExternalLink, 
  Copy, RefreshCw, Wallet, Shield, AlertTriangle, Trash2,
  Cloud, HardDrive, Download, Upload, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { getDeployedContracts, getDeployedContractsAsync, clearCrashGameAddress, saveDeployedContract } from '@/contracts/storage';
import { useWallet } from '@/hooks/useWallet';
import { TOKEN_ADDRESSES } from '@/config/admin';
import { CRASH_GAME_BYTECODE, CLAIM_SIGNER_ADDRESS, CRASH_GAME_ABI } from '@/contracts/artifacts/crashGame';
import { analyzeBytecode } from '@/lib/bytecodeAnalyzer';
import { 
  fetchCrashGameAddressFromBackend, 
  saveCrashGameAddressToBackend, 
  clearCrashGameAddressFromBackend,
  checkLegacyCrashGameAddress,
  clearLegacyCrashGameAddress
} from '@/lib/contractConfigSync';

interface ContractVerification {
  isValid: boolean;
  hasClaimSigner: boolean;
  hasGetStats: boolean;
  hasWoverToken: boolean;
  error?: string;
}

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
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [legacyAddress, setLegacyAddress] = useState<string | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deployGasLimit, setDeployGasLimit] = useState<string>('5000000');
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verification, setVerification] = useState<ContractVerification | null>(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);

  const localAddress = deployedContracts.crashGame;
  
  const isOwner = useMemo(() => {
    if (!address || !contractOwner) return false;
    return address.toLowerCase() === contractOwner.toLowerCase();
  }, [address, contractOwner]);

  const bytecodeAnalysis = useMemo(() => {
    return analyzeBytecode(CRASH_GAME_BYTECODE);
  }, []);

  const addressMismatch = useMemo(() => {
    if (!localAddress && !backendAddress) return false;
    if (!localAddress || !backendAddress) return true;
    return localAddress.toLowerCase() !== backendAddress.toLowerCase();
  }, [localAddress, backendAddress]);

  const getSigner = useCallback(async () => {
    const client = await getProvider();
    if (!client) return null;
    const provider = new ethers.providers.Web3Provider(client as any);
    return provider.getSigner();
  }, [getProvider]);

  // Fetch backend addresses
  const fetchBackendAddresses = useCallback(async () => {
    const [backend, legacy] = await Promise.all([
      fetchCrashGameAddressFromBackend(),
      checkLegacyCrashGameAddress()
    ]);
    setBackendAddress(backend);
    setLegacyAddress(legacy);
  }, []);

  // Verify contract ABI
  const verifyContract = useCallback(async (addressToVerify: string) => {
    setIsVerifying(true);
    setVerification(null);
    
    try {
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      const contract = new ethers.Contract(addressToVerify, CRASH_GAME_ABI, provider);
      
      const results: ContractVerification = {
        isValid: false,
        hasClaimSigner: false,
        hasGetStats: false,
        hasWoverToken: false,
      };

      // Test claimSigner()
      try {
        await contract.claimSigner();
        results.hasClaimSigner = true;
      } catch {
        results.hasClaimSigner = false;
      }

      // Test getStats()
      try {
        await contract.getStats();
        results.hasGetStats = true;
      } catch {
        results.hasGetStats = false;
      }

      // Test woverToken()
      try {
        await contract.woverToken();
        results.hasWoverToken = true;
      } catch {
        results.hasWoverToken = false;
      }

      results.isValid = results.hasClaimSigner && results.hasGetStats && results.hasWoverToken;
      
      if (!results.isValid) {
        results.error = 'Contract does not match CrashGame v2 ABI';
      }
      
      setVerification(results);
    } catch (error: any) {
      setVerification({
        isValid: false,
        hasClaimSigner: false,
        hasGetStats: false,
        hasWoverToken: false,
        error: error.message || 'Verification failed',
      });
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Effective address: prefer local, fallback to backend
  const effectiveAddress = localAddress || backendAddress;
  const usingBackendOnly = !localAddress && !!backendAddress;

  useEffect(() => {
    const init = async () => {
      const contracts = await getDeployedContractsAsync();
      setDeployedContracts(contracts);
      await fetchBackendAddresses();
    };
    init();
  }, [fetchBackendAddresses]);

  // Auto-pull from backend if local is missing but backend exists
  useEffect(() => {
    if (!localAddress && backendAddress) {
      // Auto-set local from backend for seamless experience
      saveDeployedContract('crashGame', backendAddress);
      setDeployedContracts(getDeployedContracts());
      toast.info('Contract address loaded from backend');
    }
  }, [localAddress, backendAddress]);

  // Fetch contract state when effective address is available
  useEffect(() => {
    if (effectiveAddress) {
      fetchContractState();
      getContractOwner().then(owner => {
        if (owner) setContractOwner(owner);
      });
    }
  }, [effectiveAddress, fetchContractState, getContractOwner]);

  const isContractDeployed = !!effectiveAddress;

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
        CLAIM_SIGNER_ADDRESS,
        { gasLimit }
      );
      const contracts = getDeployedContracts();
      setDeployedContracts(contracts);
      fetchContractState();
      
      // Auto-save to backend after deployment
      if (contracts.crashGame) {
        await saveCrashGameAddressToBackend(contracts.crashGame);
        setBackendAddress(contracts.crashGame);
        toast.success('Contract address synced to backend');
      }
    } catch (error: any) {
      console.error('Deployment failed:', error);
    }
  };

  // Helper to sync DB with contract state
  const syncDbWithContract = async () => {
    try {
      if (!localAddress) return;
      
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      const contract = new ethers.Contract(localAddress, CRASH_GAME_ABI, provider);
      
      const stats = await contract.getStats();
      const contractBalance = parseFloat(ethers.utils.formatEther(stats.prizePool || stats[0] || 0));
      const totalDeposited = parseFloat(ethers.utils.formatEther(stats.totalDeposited || stats[1] || 0));
      const totalClaimed = parseFloat(ethers.utils.formatEther(stats.totalClaimed || stats[2] || 0));

      // Update game_pool in Supabase
      const { error } = await supabase
        .from('game_pool')
        .upsert({
          current_balance: contractBalance,
          total_deposits: totalDeposited,
          total_payouts: totalClaimed,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        console.error('[CrashGame] Failed to sync DB:', error);
      } else {
        console.log('[CrashGame] DB synced with contract:', { contractBalance, totalDeposited, totalClaimed });
      }
    } catch (error) {
      console.error('[CrashGame] Sync error:', error);
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
      
      // Auto-sync DB after successful refill
      await syncDbWithContract();
      toast.success('Prize pool refilled and database synced');
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
      
      // Auto-sync DB after successful withdraw
      await syncDbWithContract();
      toast.success('Withdrawn and database synced');
    } catch (error: any) {
      toast.error('Withdraw failed: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearLocal = () => {
    if (window.confirm('Clear local CrashGame address?')) {
      clearCrashGameAddress();
      setDeployedContracts(getDeployedContracts());
      setVerification(null);
      toast.success('Local address cleared');
    }
  };

  const handleClearBackend = async () => {
    if (window.confirm('Clear CrashGame address from backend? This prevents sync across sessions.')) {
      setIsSyncingBackend(true);
      try {
        await clearCrashGameAddressFromBackend();
        setBackendAddress(null);
        toast.success('Backend address cleared');
      } catch (error) {
        toast.error('Failed to clear backend address');
      } finally {
        setIsSyncingBackend(false);
      }
    }
  };

  const handleClearLegacy = async () => {
    if (window.confirm('Clear legacy (old) CrashGame address from backend?')) {
      setIsSyncingBackend(true);
      try {
        await clearLegacyCrashGameAddress();
        setLegacyAddress(null);
        toast.success('Legacy address cleared');
      } catch (error) {
        toast.error('Failed to clear legacy address');
      } finally {
        setIsSyncingBackend(false);
      }
    }
  };

  const handlePushToBackend = async () => {
    if (!localAddress) return;
    setIsSyncingBackend(true);
    try {
      await saveCrashGameAddressToBackend(localAddress);
      setBackendAddress(localAddress);
      toast.success('Pushed to backend');
    } catch (error) {
      toast.error('Failed to push to backend');
    } finally {
      setIsSyncingBackend(false);
    }
  };

  const handlePullFromBackend = () => {
    if (!backendAddress) return;
    if (window.confirm('Use backend address for local? This will overwrite your local address.')) {
      saveDeployedContract('crashGame', backendAddress);
      setDeployedContracts(getDeployedContracts());
      toast.success('Pulled from backend');
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
          {addressMismatch && (
            <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
              Mismatch
            </span>
          )}
        </h3>

        {/* Address Sync Panel */}
        <div className="mb-4 space-y-2">
          {/* Local Address */}
          <div className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 border border-border/30">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground w-20">Local:</span>
            <code className="flex-1 font-mono truncate">
              {localAddress || <span className="text-muted-foreground">Not set</span>}
            </code>
            {localAddress && (
              <button onClick={handleClearLocal} className="text-destructive hover:text-destructive/80 p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* Backend Address */}
          <div className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 border border-border/30">
            <Cloud className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground w-20">Backend:</span>
            <code className="flex-1 font-mono truncate">
              {backendAddress || <span className="text-muted-foreground">Not set</span>}
            </code>
            {backendAddress && (
              <button onClick={handleClearBackend} disabled={isSyncingBackend} className="text-destructive hover:text-destructive/80 p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sync Buttons */}
          {(localAddress || backendAddress) && (
            <div className="flex gap-2">
              {localAddress && !backendAddress && (
                <NeonButton variant="secondary" size="sm" onClick={handlePushToBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                  <Upload className="w-3 h-3 mr-1" /> Push to Backend
                </NeonButton>
              )}
              {backendAddress && !localAddress && (
                <NeonButton variant="secondary" size="sm" onClick={handlePullFromBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                  <Download className="w-3 h-3 mr-1" /> Pull from Backend
                </NeonButton>
              )}
              {addressMismatch && localAddress && backendAddress && (
                <>
                  <NeonButton variant="secondary" size="sm" onClick={handlePushToBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                    <Upload className="w-3 h-3 mr-1" /> Push Local
                  </NeonButton>
                  <NeonButton variant="secondary" size="sm" onClick={handlePullFromBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                    <Download className="w-3 h-3 mr-1" /> Use Backend
                  </NeonButton>
                </>
              )}
            </div>
          )}

          {/* Legacy Address Warning */}
          {legacyAddress && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-warning">Legacy address found:</span>
                <code className="font-mono text-muted-foreground">{truncateAddress(legacyAddress)}</code>
              </div>
              <button 
                onClick={handleClearLegacy} 
                disabled={isSyncingBackend}
                className="text-xs text-destructive hover:underline"
              >
                Clear Legacy
              </button>
            </div>
          )}
        </div>

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
                      onClick={() => verifyContract(localAddress!)} 
                      disabled={isVerifying}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                      Verify ABI
                    </button>
                    <button 
                      onClick={() => copyToClipboard(localAddress!)} 
                      className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-background/30 rounded p-2 break-all">
                  <code className="text-[10px] font-mono text-success">
                    {localAddress}
                  </code>
                </div>

                {/* Verification Result */}
                {verification && (
                  <div className={`rounded-lg p-2 text-xs ${verification.isValid ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {verification.isValid ? (
                        <><CheckCircle className="w-4 h-4 text-success" /><span className="text-success font-medium">ABI Verified ✓</span></>
                      ) : (
                        <><XCircle className="w-4 h-4 text-destructive" /><span className="text-destructive font-medium">ABI Mismatch</span></>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <span className={verification.hasClaimSigner ? 'text-success' : 'text-destructive'}>
                        claimSigner: {verification.hasClaimSigner ? '✓' : '✗'}
                      </span>
                      <span className={verification.hasGetStats ? 'text-success' : 'text-destructive'}>
                        getStats: {verification.hasGetStats ? '✓' : '✗'}
                      </span>
                      <span className={verification.hasWoverToken ? 'text-success' : 'text-destructive'}>
                        woverToken: {verification.hasWoverToken ? '✓' : '✗'}
                      </span>
                    </div>
                    {verification.error && (
                      <p className="text-destructive mt-1">{verification.error}</p>
                    )}
                  </div>
                )}
                
                <a 
                  href={`https://scan.over.network/address/${localAddress}`}
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