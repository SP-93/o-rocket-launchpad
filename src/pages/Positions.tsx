import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Plus, Loader2, Wallet, RefreshCw, AlertTriangle, Flame, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { PositionCard } from "@/components/PositionCard";
import { useWallet } from "@/hooks/useWallet";
import { useLiquidity, Position } from "@/hooks/useLiquidity";
import { useCoinGeckoPrice } from "@/hooks/useCoinGeckoPrice";
import { useDexPrice } from "@/hooks/useDexPrice";
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
import { Slider } from "@/components/ui/slider";

const Positions = () => {
  const navigate = useNavigate();
  const { isConnected, isCorrectNetwork, address, switchNetwork } = useWallet();
  const { positions, status, error, fetchPositions, removeLiquidity, collectFees, txHash } = useLiquidity();
  const { dexPrice } = useDexPrice();
  const { price: cexPrice } = useCoinGeckoPrice();
  // Use DEX price as primary, fallback to CEX price
  const overPriceUSD = dexPrice > 0 ? dexPrice : cexPrice;
  
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false);
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [positionToReduce, setPositionToReduce] = useState<Position | null>(null);
  const [positionToBurn, setPositionToBurn] = useState<Position | null>(null);
  const [positionToCollect, setPositionToCollect] = useState<Position | null>(null);
  const [reducePercentage, setReducePercentage] = useState(50);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

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

  const handleReduceClick = (position: Position) => {
    setPositionToReduce(position);
    setReducePercentage(50);
    setReduceDialogOpen(true);
  };

  const handleReduceLiquidity = async () => {
    if (!positionToReduce) return;
    
    setReduceDialogOpen(false);
    const success = await removeLiquidity(positionToReduce.tokenId, reducePercentage);
    
    if (success) {
      toast.success(`Removed ${reducePercentage}% liquidity successfully!`);
      await fetchPositions();
    } else if (error) {
      toast.error("Failed to reduce liquidity", { description: error });
    }
    setPositionToReduce(null);
  };

  const handleBurnClick = (position: Position) => {
    setPositionToBurn(position);
    setBurnDialogOpen(true);
  };

  const handleBurnPosition = async () => {
    if (!positionToBurn) return;
    
    setBurnDialogOpen(false);
    const success = await removeLiquidity(positionToBurn.tokenId, 100);
    
    if (success) {
      toast.success("Position burned successfully!");
      await fetchPositions();
    } else if (error) {
      toast.error("Failed to burn position", { description: error });
    }
    setPositionToBurn(null);
  };

  const handleCollectClick = (position: Position) => {
    setPositionToCollect(position);
    setCollectDialogOpen(true);
  };

  const handleConfirmCollect = async () => {
    if (!positionToCollect) return;
    
    setCollectDialogOpen(false);
    const success = await collectFees(positionToCollect.tokenId);
    
    if (success) {
      toast.success("Fees collected successfully!");
      await fetchPositions();
    } else if (error) {
      toast.error("Failed to collect fees", { description: error });
    }
    setPositionToCollect(null);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchPositions();
    setIsLoading(false);
  };

  const handleAddMore = (position: Position) => {
    const params = new URLSearchParams({
      token0: position.token0,
      token1: position.token1,
      fee: position.fee.toString(),
      tokenId: position.tokenId, // Pass tokenId to increase existing position
    });
    navigate(`/add-liquidity?${params.toString()}`);
  };

  const handleSwitchNetwork = async () => {
    setIsSwitchingNetwork(true);
    try {
      await switchNetwork();
    } catch (err) {
      toast.error("Failed to switch network", {
        description: "Please switch to OverProtocol Mainnet manually in your wallet."
      });
    } finally {
      setIsSwitchingNetwork(false);
    }
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

  // Wrong network state - improved for mobile
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
                <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-warning" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">Switch to OverProtocol</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm md:text-base">
                Please switch to OverProtocol Mainnet to view your positions.
              </p>
              
              {/* Network details for manual adding */}
              <div className="glass-card rounded-xl p-4 mb-6 max-w-sm mx-auto text-left text-sm">
                <p className="font-medium mb-2 text-foreground">Network Details:</p>
                <div className="space-y-1 text-muted-foreground font-mono text-xs">
                  <p>Name: <span className="text-foreground">OverProtocol Mainnet</span></p>
                  <p>Chain ID: <span className="text-foreground">54176</span></p>
                  <p>RPC: <span className="text-foreground">https://rpc.overprotocol.com</span></p>
                  <p>Currency: <span className="text-foreground">OVER</span></p>
                </div>
              </div>
              
              <Button 
                className="btn-primary" 
                onClick={handleSwitchNetwork}
                disabled={isSwitchingNetwork}
              >
                {isSwitchingNetwork ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Switching...
                  </>
                ) : (
                  'Switch Network'
                )}
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
              <p className="text-muted-foreground text-sm md:text-base">
                {positions.length > 0 
                  ? `${positions.length} active position${positions.length !== 1 ? 's' : ''}`
                  : 'Manage your liquidity positions'
                }
              </p>
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

          {/* Empty State */}
          {!isLoading && positions.length === 0 && (
            <GlowCard className="p-8 md:p-12 text-center">
              <div className="inline-block p-6 rounded-full bg-primary/10 mb-6 border border-primary/20">
                <TrendingUp className="w-10 h-10 md:w-12 md:h-12 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">No Active Positions</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm md:text-base">
                You don't have any liquidity positions yet. Create one to start earning trading fees.
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
                <PositionCard
                  key={position.tokenId}
                  position={position}
                  onAddMore={handleAddMore}
                  onCollect={handleCollectClick}
                  onReduce={handleReduceClick}
                  onBurn={handleBurnClick}
                  isCollecting={status === 'collecting'}
                  isReducing={status === 'removing' && positionToReduce?.tokenId === position.tokenId}
                  isBurning={status === 'removing' && positionToBurn?.tokenId === position.tokenId}
                  overPriceUSD={overPriceUSD}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reduce Liquidity Dialog */}
      <AlertDialog open={reduceDialogOpen} onOpenChange={setReduceDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Reduce Liquidity</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Remove a portion of your liquidity while keeping the position active.
                </p>
                
                {/* Preset buttons */}
                <div className="flex gap-2">
                  {[25, 50, 75].map((pct) => (
                    <Button
                      key={pct}
                      variant={reducePercentage === pct ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReducePercentage(pct)}
                      className="flex-1"
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount to remove</span>
                    <span className="font-semibold text-primary">{reducePercentage}%</span>
                  </div>
                  <Slider
                    value={[reducePercentage]}
                    onValueChange={(v) => setReducePercentage(v[0])}
                    min={1}
                    max={99}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Preview */}
                {positionToReduce && (
                  <div className="glass-card rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Estimated tokens to receive:</p>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground">{positionToReduce.token0}</span>
                      <span className="font-mono font-semibold text-primary">
                        ~{(parseFloat(positionToReduce.token0Amount) * reducePercentage / 100).toFixed(6)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground">{positionToReduce.token1}</span>
                      <span className="font-mono font-semibold text-primary">
                        ~{(parseFloat(positionToReduce.token1Amount) * reducePercentage / 100).toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-success flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Position stays active after reducing
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReduceLiquidity}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Reduce {reducePercentage}%
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Burn Position Dialog */}
      <AlertDialog open={burnDialogOpen} onOpenChange={setBurnDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-destructive" />
              Burn Position
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">This action is PERMANENT!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You cannot undo this operation.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">This will:</p>
                  <ul className="space-y-1 ml-4">
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Remove 100% of liquidity</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Collect all unclaimed tokens</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-destructive">✗</span>
                      <span>Permanently burn NFT #{positionToBurn?.tokenId}</span>
                    </li>
                  </ul>
                </div>

                {/* What you'll receive */}
                {positionToBurn && (
                  <div className="glass-card rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">You will receive:</p>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground">{positionToBurn.token0}</span>
                      <span className="font-mono font-semibold text-primary">
                        {(parseFloat(positionToBurn.token0Amount) + parseFloat(positionToBurn.tokensOwed0)).toFixed(6)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground">{positionToBurn.token1}</span>
                      <span className="font-mono font-semibold text-primary">
                        {(parseFloat(positionToBurn.token1Amount) + parseFloat(positionToBurn.tokensOwed1)).toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBurnPosition}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Flame className="w-4 h-4 mr-1.5" />
              Burn Position
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Collect Confirmation Dialog */}
      <AlertDialog open={collectDialogOpen} onOpenChange={setCollectDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Collect Tokens</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {positionToCollect && (
                  <>
                    {/* Warning for empty liquidity */}
                    {positionToCollect.liquidity === '0' && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-destructive">Warning: Position has no liquidity!</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            This will withdraw your deposited tokens, not just fees. Make sure this is what you want.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Amounts to collect */}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">You will receive:</p>
                      <div className="glass-card rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-foreground">{positionToCollect.token0}</span>
                          <span className="font-mono font-semibold text-primary">
                            {parseFloat(positionToCollect.tokensOwed0).toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-foreground">{positionToCollect.token1}</span>
                          <span className="font-mono font-semibold text-primary">
                            {parseFloat(positionToCollect.tokensOwed1).toFixed(6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCollect}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Collect Tokens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConnectWalletModal open={showWalletModal} onOpenChange={setShowWalletModal} />
    </SpaceBackground>
  );
};

export default Positions;
