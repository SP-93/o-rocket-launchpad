import { useState } from 'react';
import { ethers } from 'ethers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Check, X, Copy, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';

interface RoundData {
  roundNumber: number;
  seedHash: string;
  serverSeed?: string;
  crashPoint?: number;
  status: string;
}

interface ProvablyFairModalProps {
  currentRound?: RoundData | null;
  roundHistory?: RoundData[];
}

const ProvablyFairModal = ({ currentRound, roundHistory = [] }: ProvablyFairModalProps) => {
  const [selectedRound, setSelectedRound] = useState<RoundData | null>(null);
  const [manualSeed, setManualSeed] = useState('');
  const [verificationResult, setVerificationResult] = useState<'success' | 'failed' | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const verifySeed = (seedHash: string, serverSeed: string): boolean => {
    try {
      // Convert serverSeed to bytes32 format (matching contract logic)
      const seedBytes32 = ethers.utils.formatBytes32String(serverSeed.slice(0, 31));
      
      // Hash using abi.encodePacked like contract: keccak256(abi.encodePacked(_serverSeed))
      const computedHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['bytes32'], [seedBytes32])
      );
      
      return computedHash.toLowerCase() === seedHash.toLowerCase();
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  };

  const handleVerify = () => {
    if (!selectedRound || !manualSeed) {
      toast.error('Please select a round and enter the server seed');
      return;
    }

    const isValid = verifySeed(selectedRound.seedHash, manualSeed);
    setVerificationResult(isValid ? 'success' : 'failed');
    
    if (isValid) {
      toast.success('Verification successful! The round was provably fair.');
    } else {
      toast.error('Verification failed! The seeds do not match.');
    }
  };

  const handleAutoVerify = (round: RoundData) => {
    if (!round.serverSeed) {
      toast.error('Server seed not revealed yet');
      return;
    }

    setSelectedRound(round);
    setManualSeed(round.serverSeed);
    
    const isValid = verifySeed(round.seedHash, round.serverSeed);
    setVerificationResult(isValid ? 'success' : 'failed');
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '---';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Shield className="w-4 h-4" />
          Provably Fair
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Provably Fair Verification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-primary" />
              How It Works
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Before each round, a <strong>Seed Hash</strong> is published (pre-commitment)</li>
              <li>• After crash, the <strong>Server Seed</strong> is revealed</li>
              <li>• Anyone can verify: <code className="bg-muted px-1 rounded">keccak256(serverSeed) = seedHash</code></li>
              <li>• This proves the crash point was determined BEFORE bets were placed</li>
            </ul>
          </div>

          {/* Current Round */}
          {currentRound && (
            <div className="border border-border/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Current Round #{currentRound.roundNumber}</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Seed Hash (Pre-committed)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted/50 px-3 py-2 rounded text-xs font-mono break-all">
                      {currentRound.seedHash || 'Not available'}
                    </code>
                    {currentRound.seedHash && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentRound.seedHash, 'Seed Hash')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {currentRound.serverSeed ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Server Seed (Revealed)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-muted/50 px-3 py-2 rounded text-xs font-mono break-all">
                        {currentRound.serverSeed}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentRound.serverSeed!, 'Server Seed')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Server seed will be revealed after the round crashes
                  </div>
                )}

                {currentRound.crashPoint && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-sm text-muted-foreground">Crash Point:</span>
                    <span className="font-mono font-bold text-destructive">
                      {(currentRound.crashPoint / 100).toFixed(2)}x
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Verification */}
          <div className="border border-border/50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Manual Verification</h4>
            <div className="space-y-3">
              <div>
                <Label>Select Round to Verify</Label>
                <select
                  className="w-full mt-1 bg-muted/50 border border-border rounded-md px-3 py-2 text-sm"
                  value={selectedRound?.roundNumber || ''}
                  onChange={(e) => {
                    const round = roundHistory.find(r => r.roundNumber === Number(e.target.value));
                    setSelectedRound(round || null);
                    setVerificationResult(null);
                    setManualSeed(round?.serverSeed || '');
                  }}
                >
                  <option value="">Select a round...</option>
                  {roundHistory
                    .filter(r => r.status === 'crashed' || r.status === 'payout')
                    .map(round => (
                      <option key={round.roundNumber} value={round.roundNumber}>
                        Round #{round.roundNumber} - {round.crashPoint ? `${(round.crashPoint / 100).toFixed(2)}x` : 'N/A'}
                      </option>
                    ))}
                </select>
              </div>

              {selectedRound && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Seed Hash</Label>
                    <code className="block bg-muted/50 px-3 py-2 rounded text-xs font-mono break-all mt-1">
                      {selectedRound.seedHash}
                    </code>
                  </div>

                  <div>
                    <Label>Server Seed</Label>
                    <Input
                      value={manualSeed}
                      onChange={(e) => {
                        setManualSeed(e.target.value);
                        setVerificationResult(null);
                      }}
                      placeholder="Enter the revealed server seed"
                      className="mt-1 font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleVerify} className="flex-1">
                      <Shield className="w-4 h-4 mr-2" />
                      Verify
                    </Button>
                    {selectedRound.serverSeed && (
                      <Button
                        variant="outline"
                        onClick={() => handleAutoVerify(selectedRound)}
                      >
                        Auto-fill & Verify
                      </Button>
                    )}
                  </div>

                  {verificationResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      verificationResult === 'success' 
                        ? 'bg-success/10 border border-success/30 text-success' 
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                    }`}>
                      {verificationResult === 'success' ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span className="font-medium">Verified! Round was provably fair.</span>
                        </>
                      ) : (
                        <>
                          <X className="w-5 h-5" />
                          <span className="font-medium">Verification failed. Seeds don't match.</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Recent Rounds History */}
          <div className="border border-border/50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Recent Rounds</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roundHistory.slice(0, 10).map(round => (
                <div
                  key={round.roundNumber}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">#{round.roundNumber}</span>
                    <span className={`font-mono font-bold ${
                      round.crashPoint && round.crashPoint < 200 ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {round.crashPoint ? `${(round.crashPoint / 100).toFixed(2)}x` : '---'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">
                      {truncateHash(round.seedHash)}
                    </code>
                    {round.serverSeed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleAutoVerify(round)}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {roundHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No round history available
                </p>
              )}
            </div>
          </div>

          {/* Smart Contract Link */}
          <div className="text-center text-sm text-muted-foreground">
            {(() => {
              const crashGameAddress = typeof window !== 'undefined' 
                ? localStorage.getItem('crashGameAddress') 
                : null;
              const explorerUrl = crashGameAddress 
                ? `https://scan.over.network/address/${crashGameAddress}` 
                : 'https://scan.over.network';
              return (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  View contract on OverScan
                  <ExternalLink className="w-3 h-3" />
                </a>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProvablyFairModal;
