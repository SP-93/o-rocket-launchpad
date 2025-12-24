import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Rocket, Play, Square, Zap, RefreshCw, Clock, 
  AlertTriangle, CheckCircle, Loader2, Copy, Shield,
  Hash, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { useWallet } from '@/hooks/useWallet';
import { getDeployedContracts } from '@/contracts/storage';

interface RoundInfo {
  roundNumber: number;
  seedHash: string;
  serverSeed: string;
  crashPoint: number;
  totalWagered: string;
  totalPayout: string;
  startTime: number;
  endTime: number;
  status: number; // 0=Betting, 1=Flying, 2=Crashed, 3=Payout
}

const STATUS_LABELS = ['Betting', 'Flying', 'Crashed', 'Payout'];
const STATUS_COLORS = ['text-primary', 'text-success', 'text-destructive', 'text-warning'];

const OnChainRoundManagement = () => {
  const { getProvider } = useWallet();
  const { 
    getContract, 
    startRound, 
    startFlying, 
    crashRound,
    fetchContractState,
    contractState,
    isLoading 
  } = useCrashGameContract();
  
  const [currentRound, setCurrentRound] = useState<RoundInfo | null>(null);
  const [serverSeed, setServerSeed] = useState('');
  const [crashPointInput, setCrashPointInput] = useState('2.00');
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [isStartingFlight, setIsStartingFlight] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false);
  const [seedHistory, setSeedHistory] = useState<{ seed: string; hash: string; roundId: number }[]>([]);
  const [isContractDeployed, setIsContractDeployed] = useState(false);

  useEffect(() => {
    const contracts = getDeployedContracts();
    setIsContractDeployed(!!contracts.crashGame);
    if (contracts.crashGame) {
      fetchRoundInfo();
      fetchContractState();
    }
  }, []);

  const getSigner = async () => {
    const provider = await getProvider();
    if (!provider) throw new Error('Provider not available');
    const ethersProvider = new ethers.providers.Web3Provider(provider as any);
    return ethersProvider.getSigner();
  };

  const fetchRoundInfo = async () => {
    try {
      const contract = await getContract();
      if (!contract) return;

      const round = await contract.getCurrentRound();
      setCurrentRound({
        roundNumber: round.roundNumber.toNumber(),
        seedHash: round.seedHash,
        serverSeed: round.serverSeed,
        crashPoint: round.crashPoint.toNumber(),
        totalWagered: ethers.utils.formatEther(round.totalWagered),
        totalPayout: ethers.utils.formatEther(round.totalPayout),
        startTime: round.startTime.toNumber(),
        endTime: round.endTime.toNumber(),
        status: round.status,
      });
    } catch (error) {
      console.error('Failed to fetch round info:', error);
    }
  };

  const generateServerSeed = () => {
    // Generate a random 31-character string (max for bytes32)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let seed = '';
    for (let i = 0; i < 31; i++) {
      seed += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setServerSeed(seed);
    toast.success('New server seed generated - SAVE THIS BEFORE STARTING ROUND!');
  };

  const handleStartRound = async () => {
    if (!serverSeed) {
      toast.error('Generate or enter a server seed first');
      return;
    }

    setIsStartingRound(true);
    try {
      const signer = await getSigner();
      const result = await startRound(signer, serverSeed);
      
      // Save seed to history for later use
      const currentRoundId = (contractState?.currentRoundId || 0) + 1;
      setSeedHistory(prev => [...prev, { 
        seed: serverSeed, 
        hash: result.seedHash, 
        roundId: currentRoundId 
      }]);
      
      toast.success(`Round started! Seed hash: ${result.seedHash.slice(0, 10)}...`);
      setServerSeed(''); // Clear for next round
      fetchRoundInfo();
      fetchContractState();
    } catch (error: any) {
      console.error('Start round failed:', error);
      toast.error('Failed to start round: ' + (error.reason || error.message));
    } finally {
      setIsStartingRound(false);
    }
  };

  const handleStartFlying = async () => {
    setIsStartingFlight(true);
    try {
      const signer = await getSigner();
      await startFlying(signer);
      toast.success('Round is now FLYING! 🚀');
      fetchRoundInfo();
    } catch (error: any) {
      console.error('Start flying failed:', error);
      toast.error('Failed to start flying: ' + (error.reason || error.message));
    } finally {
      setIsStartingFlight(false);
    }
  };

  const handleCrashRound = async () => {
    // Find the seed for current round from history
    const savedSeed = seedHistory.find(s => s.roundId === currentRound?.roundNumber);
    const seedToUse = savedSeed?.seed || serverSeed;
    
    if (!seedToUse) {
      toast.error('Server seed not found for this round!');
      return;
    }

    const crashPoint = Math.round(parseFloat(crashPointInput) * 100);
    if (isNaN(crashPoint) || crashPoint < 100) {
      toast.error('Invalid crash point (minimum 1.00x)');
      return;
    }

    setIsCrashing(true);
    try {
      const signer = await getSigner();
      await crashRound(signer, seedToUse, crashPoint);
      toast.success(`Round crashed at ${(crashPoint / 100).toFixed(2)}x! 💥`);
      fetchRoundInfo();
      fetchContractState();
    } catch (error: any) {
      console.error('Crash round failed:', error);
      toast.error('Failed to crash round: ' + (error.reason || error.message));
    } finally {
      setIsCrashing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '---';
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  if (!isContractDeployed) {
    return (
      <GlowCard className="p-6" glowColor="purple">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Contract Not Deployed</h3>
          <p className="text-muted-foreground text-sm">
            Deploy the CrashGame contract first using the section above.
          </p>
        </div>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner - Detailed Explanation */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">🧪 Manual Round Control (Testing Mode)</p>
            <p className="text-muted-foreground text-xs mb-2">
              Ova sekcija je za <strong>ručno testiranje</strong> Provably Fair sistema pre automatizacije.
            </p>
          </div>
        </div>
        
        <div className="bg-background/50 rounded-lg p-3 text-xs space-y-2">
          <div>
            <span className="font-medium text-primary">🎯 Crash Point (Multiplier):</span>
            <span className="text-muted-foreground ml-1">
              Tačka pada - množilac pri kojem raketa eksplodira. Npr. 2.50x znači da igrači koji cashout-uju pre toga dobijaju 2.5x ulog.
            </span>
          </div>
          <div>
            <span className="font-medium text-primary">🔐 Zašto 3 koraka?</span>
            <span className="text-muted-foreground ml-1">
              Provably Fair zahteva: (1) Seed hash commit pre opklada, (2) Faza leta, (3) Reveal seed + crash point. Ovo dokazuje da ishod nije manipulisan.
            </span>
          </div>
          <div>
            <span className="font-medium text-success">⚡ Produkcija:</span>
            <span className="text-muted-foreground ml-1">
              U produkciji će backend automatski: generisati seed, pokrenuti rundu, čekati betting period, aktivirati let, i crash-ovati na random tačku.
            </span>
          </div>
        </div>
      </div>

      {/* Current Round Status */}
      <GlowCard className="p-6" glowColor="cyan">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            On-Chain Round Control
          </h3>
          <NeonButton variant="ghost" size="sm" onClick={() => { fetchRoundInfo(); fetchContractState(); }}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </NeonButton>
        </div>

        {currentRound ? (
          <div className="space-y-4">
            {/* Round Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Round #</p>
                <p className="text-xl font-bold">{currentRound.roundNumber}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className={`text-xl font-bold ${STATUS_COLORS[currentRound.status]}`}>
                  {STATUS_LABELS[currentRound.status]}
                </p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Total Wagered</p>
                <p className="text-lg font-bold">{parseFloat(currentRound.totalWagered).toFixed(2)}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Total Payout</p>
                <p className="text-lg font-bold">{parseFloat(currentRound.totalPayout).toFixed(2)}</p>
              </div>
            </div>

            {/* Seed Info */}
            <div className="bg-background/30 rounded-lg p-4 border border-border/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Provably Fair Data</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Seed Hash:</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono">{currentRound.seedHash.slice(0, 16)}...{currentRound.seedHash.slice(-8)}</code>
                    <button onClick={() => copyToClipboard(currentRound.seedHash, 'Seed Hash')}>
                      <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
                {currentRound.serverSeed !== ethers.constants.HashZero && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Server Seed (revealed):</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono">{currentRound.serverSeed.slice(0, 16)}...</code>
                      <button onClick={() => copyToClipboard(currentRound.serverSeed, 'Server Seed')}>
                        <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                )}
                {currentRound.crashPoint > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Crash Point:</span>
                    <span className="font-bold text-destructive">{(currentRound.crashPoint / 100).toFixed(2)}x</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timing Info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Started: {formatTimestamp(currentRound.startTime)}
              </div>
              {currentRound.endTime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Ended: {formatTimestamp(currentRound.endTime)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            No round data available. Start a new round.
          </div>
        )}
      </GlowCard>

      {/* Round Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Step 1: Start Round */}
        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <h4 className="font-semibold">Start New Round</h4>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Server Seed (keep secret!)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={serverSeed}
                  onChange={(e) => setServerSeed(e.target.value.slice(0, 31))}
                  placeholder="Generate or enter seed..."
                  className="text-xs font-mono"
                  maxLength={31}
                />
                <NeonButton variant="ghost" size="sm" onClick={generateServerSeed}>
                  <Hash className="w-4 h-4" />
                </NeonButton>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Max 31 chars. This will be hashed and committed on-chain.
              </p>
            </div>
            
            <NeonButton 
              onClick={handleStartRound}
              disabled={isStartingRound || !serverSeed || currentRound?.status === 0 || currentRound?.status === 1}
              className="w-full"
            >
              {isStartingRound ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Round
            </NeonButton>
            
            {currentRound?.status === 0 && (
              <p className="text-[10px] text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Current round is in betting phase
              </p>
            )}
          </div>
        </GlowCard>

        {/* Step 2: Start Flying */}
        <GlowCard className="p-4" glowColor="purple">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">2</div>
            <h4 className="font-semibold">Start Flying</h4>
          </div>
          
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              End betting phase and start the rocket flight. Players can no longer place bets.
            </p>
            
            <div className="bg-background/30 rounded p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Betting Duration:</span>
                <span className="font-medium">{contractState?.bettingDuration || 15}s</span>
              </div>
            </div>
            
            <NeonButton 
              onClick={handleStartFlying}
              disabled={isStartingFlight || currentRound?.status !== 0}
              className="w-full"
            >
              {isStartingFlight ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              Start Flying 🚀
            </NeonButton>
            
            {currentRound?.status !== 0 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-success" />
                {currentRound?.status === 1 ? 'Already flying' : 'Round must be in betting phase'}
              </p>
            )}
          </div>
        </GlowCard>

        {/* Step 3: Crash Round */}
        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-xs font-bold text-destructive">3</div>
            <h4 className="font-semibold">Crash Round</h4>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Crash Point (multiplier)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  value={crashPointInput}
                  onChange={(e) => setCrashPointInput(e.target.value)}
                  placeholder="2.00"
                  step="0.01"
                  min="1.00"
                  className="text-xs font-mono"
                />
                <div className="flex items-center gap-1 px-2 bg-background/30 rounded text-xs">
                  <Target className="w-3 h-3" />
                  <span>x</span>
                </div>
              </div>
            </div>
            
            <NeonButton 
              onClick={handleCrashRound}
              disabled={isCrashing || currentRound?.status !== 1}
              variant="destructive"
              className="w-full"
            >
              {isCrashing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              Crash! 💥
            </NeonButton>
            
            {currentRound?.status !== 1 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                {currentRound?.status === 0 ? (
                  <>
                    <Clock className="w-3 h-3" />
                    Start flying first
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3 text-success" />
                    Round already crashed
                  </>
                )}
              </p>
            )}
          </div>
        </GlowCard>
      </div>

      {/* Saved Seeds History */}
      {seedHistory.length > 0 && (
        <GlowCard className="p-4" glowColor="purple">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Saved Seeds (This Session)
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {seedHistory.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-background/30 rounded p-2">
                <span className="font-medium">Round #{item.roundId}</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-muted-foreground">{item.seed.slice(0, 10)}...</code>
                  <button onClick={() => copyToClipboard(item.seed, 'Seed')}>
                    <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            ⚠️ Seeds are only stored in browser memory. Save them externally for verification!
          </p>
        </GlowCard>
      )}
    </div>
  );
};

export default OnChainRoundManagement;
