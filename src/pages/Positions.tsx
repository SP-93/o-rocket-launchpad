import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Plus, Loader2, Wallet, RefreshCw, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { PositionCard } from "@/components/PositionCard";
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

const Positions = () => {
  const navigate = useNavigate();
  const { isConnected, isCorrectNetwork, address, switchNetwork } = useWallet();
  const { positions, status, error, fetchPositions, removeLiquidity, collectFees, txHash } = useLiquidity();
  
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
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
                  onCollect={handleCollectFees}
                  onRemove={handleRemoveClick}
                  isCollecting={status === 'collecting'}
                  isRemoving={status === 'removing' && selectedPosition?.tokenId === position.tokenId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Liquidity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all liquidity from this position? 
              This will also collect any unclaimed fees and burn the NFT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveLiquidity}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
