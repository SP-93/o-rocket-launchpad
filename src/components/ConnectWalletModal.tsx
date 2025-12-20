import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, AlertTriangle, Check, ExternalLink, Copy, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWeb3Modal } from '@web3modal/wagmi/react';

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConnectWalletModal = ({ open, onOpenChange }: ConnectWalletModalProps) => {
  const { 
    address, 
    balance, 
    isConnected, 
    isCorrectNetwork, 
    isLoadingBalance,
    disconnect, 
    switchNetwork,
  } = useWallet();
  
  const { open: openWeb3Modal } = useWeb3Modal();

  const handleConnect = async () => {
    onOpenChange(false);
    // Small delay to let dialog close first
    setTimeout(() => {
      openWeb3Modal();
    }, 100);
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Wallet disconnected');
    onOpenChange(false);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied');
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Connected state
  if (isConnected && address) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-primary/30 bg-card/95 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold gradient-text flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Connected
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!isCorrectNetwork && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Wrong Network</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Please switch to OverProtocol Mainnet
                </p>
                <Button 
                  onClick={switchNetwork}
                  className="w-full btn-primary"
                  size="sm"
                >
                  Switch to OverProtocol
                </Button>
              </div>
            )}

            {isCorrectNetwork && (
              <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-success" />
                <span className="text-success font-medium">Connected to OverProtocol</span>
              </div>
            )}

            <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔗</span>
                  <span className="font-medium text-foreground">Connected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-foreground bg-background/50 px-2 py-1 rounded">
                    {truncateAddress(address)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/20"
                    onClick={copyAddress}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/20"
                    onClick={() => window.open(`https://scan.over.network/address/${address}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                {isLoadingBalance ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-lg">Loading balance...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold gradient-text">
                    {balance} <span className="text-lg">OVER</span>
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleDisconnect}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Disconnected state - Web3Modal opens directly from Navigation.tsx
  return null;
};
