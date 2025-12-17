import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Plus, Loader2, Trash2, Wallet, RefreshCw, ExternalLink, CirclePlus, Bug, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { TokenIcon } from "@/components/TokenIcon";
import { useWallet } from "@/hooks/useWallet";
import { useLiquidity, Position } from "@/hooks/useLiquidity";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Convert tick to human-readable price
// Formula: price = 1.0001^tick * decimalAdjustment
const tickToPrice = (tick: number, token0Symbol: string, token1Symbol: string): string => {
  // Get decimals for tokens
  const getDecimals = (symbol: string): number => {
    if (symbol === 'USDT' || symbol === 'USDC') return 6;
    return 18;
  };
  
  const decimals0 = getDecimals(token0Symbol);
  const decimals1 = getDecimals(token1Symbol);
  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  
  const rawPrice = Math.pow(1.0001, tick);
  const adjustedPrice = rawPrice * decimalAdjustment;
  
  // Format based on size
  if (adjustedPrice < 0.0001) {
    return adjustedPrice.toExponential(2);
  } else if (adjustedPrice < 1) {
    return adjustedPrice.toFixed(6);
  } else if (adjustedPrice > 1000000) {
    return adjustedPrice.toExponential(2);
  }
  return adjustedPrice.toFixed(4);
};

const Positions = () => {
  const navigate = useNavigate();
  const { isConnected, isCorrectNetwork, address, switchNetwork } = useWallet();
  const { positions, status, error, fetchPositions, removeLiquidity, collectFees, txHash, debugInfo } = useLiquidity();
  
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Fetch positions on mount and when wallet connects
  useEffect(() => {
    const loadPositions = async () => {
      if (isConnected && isCorrectNetwork) {
        setIsLoading(true);
        await fetchPositions();
        setIsLoading(false);
      }
    };
    loadPositions();
  }, [isConnected, isCorrectNetwork, fetchPositions]);

  const handleRemoveClick = (position: Position) => {
    setSelectedPosition(position);
    setRemoveDialogOpen(true);
  };

  const handleRemoveLiquidity = async () => {
    if (!selectedPosition) return;
    
    setRemoveDialogOpen(false);
    const success = await removeLiquidity(selectedPosition.tokenId);
    
    if (success) {
      toast.success("Liquidity removed successfully!");
      await fetchPositions();
    } else if (error) {
      toast.error("Failed to remove liquidity", { description: error });
    }
    setSelectedPosition(null);
  };

  const handleCollectFees = async (tokenId: string) => {
    const success = await collectFees(tokenId);
    
    if (success) {
      toast.success("Fees collected successfully!");
      await fetchPositions();
    } else if (error) {
      toast.error("Failed to collect fees", { description: error });
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchPositions();
    setIsLoading(false);
  };

  const handleAddMore = (position: Position) => {
    // Navigate to add liquidity with pre-filled token info
    const params = new URLSearchParams({
      token0: position.token0,
      token1: position.token1,
      fee: position.fee.toString(),
    });
    navigate(`/add-liquidity?${params.toString()}`);
  };

  const getFeeLabel = (fee: number): string => {
    const feeMap: Record<number, string> = {
      500: "0.05%",
      3000: "0.3%",
      10000: "1%",
    };
    return feeMap[fee] || `${fee / 10000}%`;
  };

  // Not connected state
  if (!isConnected) {
    return (
      <SpaceBackground>
        <div className="min-h-screen pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">My Positions</h1>
                <p className="text-muted-foreground text-sm md:text-base">Manage your liquidity positions</p>
              </div>
              <Button className="btn-primary w-full md:w-auto" onClick={() => navigate("/add-liquidity")}>
                <Plus className="w-4 h-4 mr-2" />
                New Position
              </Button>
            </div>

            <GlowCard className="p-8 md:p-12 text-center">
              <div className="inline-block p-6 rounded-full bg-primary/10 mb-6 border border-primary/20">
                <Wallet className="w-10 h-10 md:w-12 md:h-12 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">Connect Your Wallet</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm md:text-base">
                Connect your wallet to view and manage your liquidity positions.
              </p>
              <Button className="btn-primary" onClick={() => setShowWalletModal(true)}>
                Connect Wallet
              </Button>
            </GlowCard>
          </div>
        </div>
        <ConnectWalletModal open={showWalletModal} onOpenChange={setShowWalletModal} />
      </SpaceBackground>
    );
  }

  // Wrong network state
  if (!isCorrectNetwork) {
    return (
      <SpaceBackground>
        <div className="min-h-screen pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">My Positions</h1>
                <p className="text-muted-foreground text-sm md:text-base">Manage your liquidity positions</p>
              </div>
            </div>

            <GlowCard className="p-8 md:p-12 text-center">
              <div className="inline-block p-6 rounded-full bg-warning/10 mb-6 border border-warning/20">
                <TrendingUp className="w-10 h-10 md:w-12 md:h-12 text-warning" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">Wrong Network</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm md:text-base">
                Please switch to OverProtocol Mainnet to view your positions.
              </p>
              <Button className="btn-primary" onClick={switchNetwork}>
                Switch Network
              </Button>
            </GlowCard>
          </div>
        </div>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">My Positions</h1>
              <p className="text-muted-foreground text-sm md:text-base">Manage your liquidity positions</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-1 md:flex-none"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button className="btn-primary flex-1 md:flex-none" onClick={() => navigate("/add-liquidity")}>
                <Plus className="w-4 h-4 mr-2" />
                New Position
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <GlowCard className="p-8 md:p-12 text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your positions...</p>
            </GlowCard>
          )}

          {/* Debug Info Section */}
          {debugInfo && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="mb-2"
              >
                <Bug className="w-4 h-4 mr-2" />
                {showDebug ? 'Hide' : 'Show'} Debug Info
              </Button>
              
              {showDebug && (
                <Card className="glass-card p-4 text-xs font-mono">
                  <h3 className="text-sm font-bold mb-3 text-primary">PositionManager Diagnostics</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-32">Connected:</span>
                      <span className="text-foreground break-all">{address}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-32">PM Address:</span>
                      <span className="text-foreground break-all">{debugInfo.positionManagerAddress}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {debugInfo.factoryMatch ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-muted-foreground">PM.factory():</span>
                      <span className={debugInfo.factoryMatch ? 'text-success' : 'text-destructive'}>
                        {debugInfo.factoryFromPM || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {debugInfo.weth9Match ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-muted-foreground">PM.WETH9():</span>
                      <span className={debugInfo.weth9Match ? 'text-success' : 'text-destructive'}>
                        {debugInfo.weth9FromPM || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-32">balanceOf:</span>
                      <span className="text-foreground font-bold text-lg">{debugInfo.balanceOf}</span>
                      <span className="text-muted-foreground">NFT positions</span>
                    </div>
                    
                    {debugInfo.error && (
                      <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                        <span className="text-destructive">{debugInfo.error}</span>
                      </div>
                    )}
                    
                    {!debugInfo.factoryMatch && (
                      <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded">
                        <span className="text-warning">⚠️ Factory mismatch! NFTs may be from different DEX.</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && positions.length === 0 && (
            <GlowCard className="p-8 md:p-12 text-center">
              <div className="inline-block p-6 rounded-full bg-primary/10 mb-6 border border-primary/20">
                <TrendingUp className="w-10 h-10 md:w-12 md:h-12 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">No Active Positions</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm md:text-base">
                You don't have any active liquidity positions. Create a new position to start earning fees.
              </p>
              <Button className="btn-primary" onClick={() => navigate("/add-liquidity")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Position
              </Button>
            </GlowCard>
          )}

          {/* Positions List */}
          {!isLoading && positions.length > 0 && (
            <div className="space-y-4">
              {positions.map((position) => (
                <Card key={position.tokenId} className="glass-card p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Pool Info */}
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        <TokenIcon symbol={position.token0} size="md" />
                        <TokenIcon symbol={position.token1} size="md" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          {position.token0}/{position.token1}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Fee: {getFeeLabel(position.fee)} • ID: #{position.tokenId}
                        </p>
                      </div>
                    </div>

                    {/* Position Details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-success/20 text-success border border-success/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          Active
                        </span>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unclaimed Fees</p>
                        <p className="font-semibold text-success">
                          {parseFloat(position.tokensOwed0).toFixed(6)} {position.token0}
                          <br />
                          {parseFloat(position.tokensOwed1).toFixed(6)} {position.token1}
                        </p>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <p className="text-muted-foreground">Price Range</p>
                        <p className="font-semibold text-xs">
                          {tickToPrice(position.tickLower, position.token0, position.token1)} ↔ {tickToPrice(position.tickUpper, position.token0, position.token1)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {position.token1} per {position.token0}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddMore(position)}
                        className="flex-1 md:flex-none"
                      >
                        <CirclePlus className="w-4 h-4 mr-1" />
                        Add More
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCollectFees(position.tokenId)}
                        disabled={status === 'collecting'}
                        className="flex-1 md:flex-none"
                      >
                        {status === 'collecting' ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Wallet className="w-4 h-4 mr-1" />
                        )}
                        Collect
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveClick(position)}
                        disabled={status === 'removing'}
                        className="text-destructive hover:text-destructive flex-1 md:flex-none"
                      >
                        {status === 'removing' && selectedPosition?.tokenId === position.tokenId ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Remove
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="flex-1 md:flex-none"
                      >
                        <a 
                          href={`https://scan.over.network/token/${position.tokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </a>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remove Liquidity Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Liquidity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all liquidity from this position? 
              This will withdraw your tokens and collect any unclaimed fees.
              {selectedPosition && (
                <span className="block mt-2 font-semibold text-foreground">
                  Position: {selectedPosition.token0}/{selectedPosition.token1} #{selectedPosition.tokenId}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveLiquidity} className="bg-destructive hover:bg-destructive/90">
              Remove Liquidity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConnectWalletModal open={showWalletModal} onOpenChange={setShowWalletModal} />
    </SpaceBackground>
  );
};

export default Positions;
