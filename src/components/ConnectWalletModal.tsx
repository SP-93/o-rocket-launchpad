import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, AlertTriangle, Check, ExternalLink, Copy, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const wallets = [
  {
    id: 'metamask' as const,
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect using MetaMask browser extension',
  },
  {
    id: 'overwallet' as const,
    name: 'OverWallet',
    icon: '🌐',
    description: 'Native wallet for OverProtocol',
  },
];

export const ConnectWalletModal = ({ open, onOpenChange }: ConnectWalletModalProps) => {
  const { 
    address, 
    balance, 
    isConnected, 
    isCorrectNetwork, 
    isConnecting,
    walletType,
    connect, 
    disconnect, 
    switchNetwork,
    error 
  } = useWallet();
  
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const handleConnect = async (walletId: 'metamask' | 'overwallet') => {
    setConnectingWallet(walletId);
    try {
      await connect(walletId);
      toast.success('Wallet connected successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Wallet disconnected');
    onOpenChange(false);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Connected state view
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
            {/* Network Status */}
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
                <span className="text-success font-medium">Connected to OverProtocol Mainnet</span>
              </div>
            )}

            {/* Wallet Info Card */}
            <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {walletType === 'metamask' ? '🦊' : '🌐'}
                  </span>
                  <span className="font-medium text-foreground">
                    {walletType === 'metamask' ? 'MetaMask' : 'OverWallet'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-muted-foreground">Connected</span>
                </div>
              </div>

              {/* Address */}
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
                    onClick={() => window.open(`https://www.overscan.net/address/${address}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Balance */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                <p className="text-2xl font-bold gradient-text">
                  {balance} <span className="text-lg">OVER</span>
                </p>
              </div>
            </div>

            {/* Disconnect Button */}
            <Button
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleDisconnect}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Connect wallet view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-primary/30 bg-card/95 backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold gradient-text flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose your preferred wallet to connect to O'Rocket on OverProtocol Mainnet
          </p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet.id)}
              disabled={isConnecting}
              className="w-full p-4 rounded-xl border border-primary/20 bg-background/50 
                         hover:bg-primary/10 hover:border-primary/40 transition-all duration-300
                         flex items-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">
                {wallet.icon}
              </span>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {wallet.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {wallet.description}
                </p>
              </div>
              {connectingWallet === wallet.id && (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          ))}

          <p className="text-xs text-muted-foreground text-center pt-4">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
