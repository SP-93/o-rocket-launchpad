import { useState, useEffect, useCallback } from 'react';
import { useProtocolFees, PoolFeeStatus, AccumulatedFees } from '@/hooks/useProtocolFees';
import { PROTOCOL_FEE_CONFIG, FEE_PROTOCOL_OPTIONS, MAINNET_POOLS, TREASURY_WALLET, NETWORK_CONFIG } from '@/config/admin';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Wallet, AlertTriangle, CheckCircle, XCircle, Loader2, 
  RefreshCw, ExternalLink, Copy, DollarSign, Coins
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TreasurySection = () => {
  const {
    getPoolFeeStatus,
    getAccumulatedFees,
    activateProtocolFee,
    collectProtocolFees,
    getFeeOptionLabel,
    isActivating,
    isCollecting,
  } = useProtocolFees();

  const [poolStatuses, setPoolStatuses] = useState<Record<string, PoolFeeStatus | null>>({});
  const [accumulatedFees, setAccumulatedFees] = useState<Record<string, AccumulatedFees | null>>({});
  const [selectedFeeOption, setSelectedFeeOption] = useState<Record<string, number>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingFees, setIsLoadingFees] = useState(true);

  // Load pool statuses on mount
  const loadPoolStatuses = useCallback(async () => {
    setIsLoadingStatus(true);
    const statuses: Record<string, PoolFeeStatus | null> = {};
    const defaultOptions: Record<string, number> = {};

    for (const [poolName, poolAddress] of Object.entries(MAINNET_POOLS)) {
      const status = await getPoolFeeStatus(poolAddress, poolName);
      statuses[poolName] = status;
      // Set default to current fee or 80/20 default
      defaultOptions[poolName] = status?.feeProtocol0 || PROTOCOL_FEE_CONFIG.feeProtocol;
    }

    setPoolStatuses(statuses);
    setSelectedFeeOption(defaultOptions);
    setIsLoadingStatus(false);
  }, [getPoolFeeStatus]);

  // Load accumulated fees
  const loadAccumulatedFees = useCallback(async () => {
    setIsLoadingFees(true);
    const fees: Record<string, AccumulatedFees | null> = {};

    for (const [poolName, poolAddress] of Object.entries(MAINNET_POOLS)) {
      const poolFees = await getAccumulatedFees(poolAddress);
      fees[poolName] = poolFees;
    }

    setAccumulatedFees(fees);
    setIsLoadingFees(false);
  }, [getAccumulatedFees]);

  useEffect(() => {
    loadPoolStatuses();
    loadAccumulatedFees();
  }, [loadPoolStatuses, loadAccumulatedFees]);

  const handleActivateFee = async (poolName: string, poolAddress: string) => {
    const feeProtocol = selectedFeeOption[poolName] || PROTOCOL_FEE_CONFIG.feeProtocol;
    const option = FEE_PROTOCOL_OPTIONS.find(opt => opt.feeProtocol === feeProtocol);
    
    const confirmMessage = feeProtocol === 0 
      ? 'Deactivate protocol fee? 100% will go to LPs.'
      : `Activate ${option?.label || `${Math.round(100/feeProtocol)}%`} protocol fee?`;
    
    if (!confirm(confirmMessage)) return;

    const result = await activateProtocolFee(poolAddress, feeProtocol);
    
    if (result.success) {
      toast.success(`Protocol fee ${feeProtocol === 0 ? 'deactivated' : 'activated'}!`);
      loadPoolStatuses();
    } else {
      toast.error(result.error || 'Failed to set protocol fee');
    }
  };

  const handleCollectFees = async (poolName: string, poolAddress: string) => {
    const fees = accumulatedFees[poolName];
    if (!fees) return;

    const confirmMessage = `Collect ${fees.token0Amount} ${fees.token0Symbol} and ${fees.token1Amount} ${fees.token1Symbol} to treasury?`;
    if (!confirm(confirmMessage)) return;

    const result = await collectProtocolFees(poolAddress, TREASURY_WALLET);
    
    if (result.success) {
      toast.success(`Collected ${result.amount0} ${fees.token0Symbol} + ${result.amount1} ${fees.token1Symbol}!`);
      loadAccumulatedFees();
    } else {
      toast.error(result.error || 'Failed to collect fees');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const hasAnyFees = Object.values(accumulatedFees).some(
    fees => fees && (parseFloat(fees.token0Amount) > 0 || parseFloat(fees.token1Amount) > 0)
  );

  return (
    <>
      {/* Fee Configuration Overview */}
      <GlowCard className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Protocol Treasury
        </h2>
        <p className="text-muted-foreground mb-6">
          Manage protocol fees for each pool. Fees are stored in original tokens and collected to treasury wallet.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Default LP Share</p>
            <p className="text-2xl font-bold gradient-text">{PROTOCOL_FEE_CONFIG.lpShare}%</p>
          </div>
          <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Default Protocol Share</p>
            <p className="text-2xl font-bold text-warning">{PROTOCOL_FEE_CONFIG.protocolShare}%</p>
          </div>
        </div>

        {/* Treasury Wallet */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/30 mb-4">
          <p className="text-sm text-muted-foreground mb-2">Treasury Wallet</p>
          <div className="flex items-center gap-2">
            <code className="text-xs md:text-sm font-mono text-primary break-all">{TREASURY_WALLET}</code>
            <button 
              onClick={() => copyToClipboard(TREASURY_WALLET)} 
              className="p-1 hover:bg-primary/20 rounded"
            >
              <Copy className="w-4 h-4" />
            </button>
            <a 
              href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${TREASURY_WALLET}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-primary/20 rounded"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </GlowCard>

      {/* Pool Fee Management */}
      {Object.entries(MAINNET_POOLS).map(([poolName, poolAddress]) => {
        const status = poolStatuses[poolName];
        const fees = accumulatedFees[poolName];
        const currentFeeOption = selectedFeeOption[poolName] || PROTOCOL_FEE_CONFIG.feeProtocol;

        return (
          <GlowCard key={poolName} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Pool: {poolName}
              </h3>
              <button 
                onClick={() => { loadPoolStatuses(); loadAccumulatedFees(); }}
                className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Pool Address */}
            <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
              <span>Address:</span>
              <code className="font-mono">{poolAddress.slice(0, 10)}...{poolAddress.slice(-8)}</code>
              <a 
                href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Fee Status */}
            <div className="bg-background/50 rounded-xl p-4 border border-primary/20 mb-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fee Status
              </h4>

              {isLoadingStatus ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading status...
                </div>
              ) : status ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {status.isActive ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-500 font-semibold">ACTIVE</span>
                        <span className="text-muted-foreground">
                          ({getFeeOptionLabel(status.feeProtocol0)})
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="text-red-500 font-semibold">NOT ACTIVE</span>
                        <span className="text-muted-foreground">(100% to LPs)</span>
                      </>
                    )}
                  </div>

                  {/* Fee Selection */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select 
                      value={String(currentFeeOption)} 
                      onValueChange={(val) => setSelectedFeeOption(prev => ({ ...prev, [poolName]: parseInt(val) }))}
                    >
                      <SelectTrigger className="w-full sm:w-[200px] bg-background border-primary/30">
                        <SelectValue placeholder="Select fee split" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-primary/30">
                        {FEE_PROTOCOL_OPTIONS.map((option) => (
                          <SelectItem key={option.feeProtocol} value={String(option.feeProtocol)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <NeonButton
                      onClick={() => handleActivateFee(poolName, poolAddress)}
                      disabled={isActivating || (status.isActive && status.feeProtocol0 === currentFeeOption)}
                      className="flex-1 sm:flex-none"
                    >
                      {isActivating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : status.isActive ? (
                        status.feeProtocol0 === currentFeeOption ? 'Already Set' : 'Update Fee'
                      ) : (
                        'Activate Fee'
                      )}
                    </NeonButton>
                  </div>

                  {/* Warning */}
                  {!status.isActive && (
                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                      <p className="text-xs text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                        <span>
                          <strong className="text-warning">Important:</strong> Swaps before activation give 100% to LPs. 
                          After activation, the selected split applies. This is NOT retroactive.
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-red-500">Failed to load pool status</p>
              )}
            </div>

            {/* Accumulated Fees */}
            <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Accumulated Protocol Fees
              </h4>

              {isLoadingFees ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading fees...
                </div>
              ) : fees ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{fees.token0Symbol}</p>
                      <p className="text-xl font-bold gradient-text">
                        {parseFloat(fees.token0Amount).toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{fees.token1Symbol}</p>
                      <p className="text-xl font-bold text-warning">
                        {parseFloat(fees.token1Amount).toFixed(6)}
                      </p>
                    </div>
                  </div>

                  <NeonButton
                    onClick={() => handleCollectFees(poolName, poolAddress)}
                    disabled={isCollecting || (parseFloat(fees.token0Amount) === 0 && parseFloat(fees.token1Amount) === 0)}
                    variant="secondary"
                    className="w-full"
                  >
                    {isCollecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Collecting...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Collect to Treasury
                      </>
                    )}
                  </NeonButton>

                  {parseFloat(fees.token0Amount) === 0 && parseFloat(fees.token1Amount) === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      No fees accumulated yet. Fees appear after swaps occur with protocol fee active.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-red-500">Failed to load accumulated fees</p>
              )}
            </div>
          </GlowCard>
        );
      })}

      {/* No Pools Message */}
      {Object.keys(MAINNET_POOLS).length === 0 && (
        <GlowCard className="p-6 text-center">
          <p className="text-muted-foreground">
            No pools deployed yet. Deploy pools first to manage protocol fees.
          </p>
        </GlowCard>
      )}
    </>
  );
};

export default TreasurySection;
