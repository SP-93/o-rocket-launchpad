import { useState, useEffect } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Rocket, AlertTriangle, Info, RefreshCw, Loader2, Shield, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { getDeployedContracts } from '@/contracts/storage';
import { supabase } from '@/integrations/supabase/client';

/**
 * On-Chain Round Management
 * 
 * With the new CrashGame v2 contract, round management is handled OFF-CHAIN
 * in the database. The contract only manages:
 * - Prize pool (refill/withdraw)
 * - Signature-based claims (players claim winnings with signed messages)
 * 
 * This component now shows info about the architecture change.
 */
const OnChainRoundManagement = () => {
  const { contractState, fetchContractState, isLoading } = useCrashGameContract();
  const [isContractDeployed, setIsContractDeployed] = useState(false);
  const [stuckRounds, setStuckRounds] = useState<number>(0);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    const contracts = getDeployedContracts();
    setIsContractDeployed(!!contracts.crashGame);
    if (contracts.crashGame) {
      fetchContractState();
    }
    checkStuckRounds();
  }, []);

  const checkStuckRounds = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('game_rounds')
        .select('*', { count: 'exact', head: true })
        .in('status', ['betting', 'flying', 'countdown'])
        .lt('created_at', fiveMinutesAgo);
      
      setStuckRounds(count || 0);
    } catch (error) {
      console.error('Error checking stuck rounds:', error);
    }
  };

  const handleRecoverStuckRounds = async () => {
    setIsRecovering(true);
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('game_rounds')
        .update({
          status: 'crashed',
          crash_point: 1.00,
          crashed_at: new Date().toISOString(),
        })
        .in('status', ['betting', 'flying', 'countdown'])
        .lt('created_at', fiveMinutesAgo)
        .select();

      if (error) throw error;

      toast.success(`Recovered ${data?.length || 0} stuck rounds`);
      setStuckRounds(0);
    } catch (error: any) {
      toast.error('Failed to recover rounds: ' + error.message);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture Info */}
      <GlowCard className="p-6" glowColor="cyan">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold mb-2">CrashGame v2 Architecture</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The new contract uses a <strong>signature-based claims</strong> model. 
              Round management happens off-chain in the database, while the contract 
              handles prize pool and verified claim payouts.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Off-Chain (Database)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Round creation & management</li>
                  <li>• Betting & cashout logic</li>
                  <li>• Provably fair seed generation</li>
                  <li>• Leaderboards & statistics</li>
                </ul>
              </div>
              
              <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">On-Chain (Contract)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• WOVER prize pool custody</li>
                  <li>• Signature-verified claims</li>
                  <li>• Double-claim prevention</li>
                  <li>• Emergency withdrawals</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Contract Status */}
      <GlowCard className="p-6" glowColor="purple">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          Contract Status
        </h3>

        {isContractDeployed ? (
          <div className="space-y-4">
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
                    {contractState.isPoolLow ? '⚠️ Low' : '✓ Healthy'}
                  </p>
                </div>
              </div>
            )}

            <NeonButton
              variant="ghost"
              onClick={() => fetchContractState()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Contract State
            </NeonButton>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h4 className="font-semibold mb-2">Contract Not Deployed</h4>
            <p className="text-sm text-muted-foreground">
              Deploy the CrashGame contract from the section above.
            </p>
          </div>
        )}
      </GlowCard>

      {/* Stuck Rounds Recovery */}
      {stuckRounds > 0 && (
        <GlowCard className="p-6" glowColor="purple">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {stuckRounds} stuck round(s) detected
                </p>
                <p className="text-xs text-muted-foreground">
                  Rounds older than 5 minutes that never completed
                </p>
              </div>
            </div>
            <NeonButton
              variant="secondary"
              onClick={handleRecoverStuckRounds}
              disabled={isRecovering}
              className="text-destructive"
            >
              {isRecovering ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Recover All
            </NeonButton>
          </div>
        </GlowCard>
      )}
    </div>
  );
};

export default OnChainRoundManagement;
