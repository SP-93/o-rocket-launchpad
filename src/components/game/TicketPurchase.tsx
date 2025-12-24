import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, Clock, AlertCircle, Wallet, Sparkles, CheckCircle, ExternalLink } from 'lucide-react';
import { useGameTickets } from '@/hooks/useGameTickets';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { useTokenTransfer, TREASURY_WALLET } from '@/hooks/useTokenTransfer';
import { toast } from '@/hooks/use-toast';

interface TicketPurchaseProps {
  walletAddress: string | undefined;
  isConnected: boolean;
}

const TICKET_VALUES = [1, 2, 3, 4, 5];

type TxStatus = 'idle' | 'confirming' | 'pending' | 'saving' | 'success' | 'manual';

const TicketPurchase = ({ walletAddress, isConnected }: TicketPurchaseProps) => {
  const [selectedValue, setSelectedValue] = useState<number>(1);
  const [selectedCurrency, setSelectedCurrency] = useState<'WOVER' | 'USDT'>('WOVER');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [manualTxHash, setManualTxHash] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  
  const { buyTicket, groupedTickets, refetch } = useGameTickets(walletAddress);
  const { price: woverPrice, loading: isPriceLoading } = useCoinGeckoPrice();
  const { transferToken, getTokenBalance, verifyTransaction, isPending: isTransferPending, pendingTxHash } = useTokenTransfer();

  const usdtAmount = selectedCurrency === 'USDT' && woverPrice 
    ? (selectedValue * woverPrice).toFixed(4)
    : null;

  // Fetch token balance with periodic refresh
  useEffect(() => {
    if (!walletAddress || !isConnected) {
      setTokenBalance(null);
      return;
    }
    
    // Initial fetch
    getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
    
    // Periodic refresh every 10 seconds for live balance
    const interval = setInterval(() => {
      getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [walletAddress, isConnected, selectedCurrency, getTokenBalance]);

  const handlePurchase = async () => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to purchase tickets",
        variant: "destructive",
      });
      return;
    }

    const paymentAmount = selectedCurrency === 'WOVER' 
      ? selectedValue 
      : parseFloat(usdtAmount || '0');

    // Check balance
    if (tokenBalance !== null && tokenBalance < paymentAmount) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${paymentAmount} ${selectedCurrency} but only have ${tokenBalance.toFixed(4)}`,
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(true);
    setTxStatus('confirming');
    setShowManualInput(false);

    try {
      // Step 1: Execute blockchain transfer
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet",
      });

      const result = await transferToken(selectedCurrency, paymentAmount);

      if (!result.success && !result.txHash) {
        throw new Error(result.error || 'Transaction failed');
      }

      setLastTxHash(result.txHash || null);

      // Handle different status outcomes
      if (result.status === 'pending') {
        setTxStatus('pending');
        toast({
          title: "Transaction Pending",
          description: "Your transaction is being processed. You can wait or enter TX hash manually.",
        });
        setShowManualInput(true);
        setIsPurchasing(false);
        return;
      }

      if (result.status === 'confirmed' && result.txHash) {
        setTxStatus('saving');

        // Step 2: Register ticket in database with tx hash
        await buyTicket(selectedValue, selectedCurrency, paymentAmount, result.txHash);
        
        setTxStatus('success');
        toast({
          title: "Ticket Purchased! 🎫",
          description: `${selectedValue} WOVER ticket added to your collection`,
        });
        
        // Refresh data
        await refetch();
        if (walletAddress) {
          getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
        }
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase ticket",
        variant: "destructive",
      });
      setShowManualInput(true);
    } finally {
      setIsPurchasing(false);
      if (txStatus !== 'pending') {
        setTimeout(() => setTxStatus('idle'), 2000);
      }
    }
  };

  // Handle manual TX hash submission
  const handleManualSubmit = async () => {
    const txHash = manualTxHash.trim();
    if (!txHash || !txHash.startsWith('0x')) {
      toast({
        title: "Invalid TX Hash",
        description: "Please enter a valid transaction hash starting with 0x",
        variant: "destructive",
      });
      return;
    }

    if (!walletAddress) return;

    setTxStatus('manual');
    setIsPurchasing(true);

    try {
      // Verify the transaction first
      const verification = await verifyTransaction(txHash);
      
      if (verification.status === 'failed') {
        throw new Error('Transaction failed on-chain');
      }

      // Register ticket (backend will verify the TX)
      const paymentAmount = selectedCurrency === 'WOVER' 
        ? selectedValue 
        : parseFloat(usdtAmount || '0');

      await buyTicket(selectedValue, selectedCurrency, paymentAmount, txHash);
      
      setTxStatus('success');
      toast({
        title: "Ticket Registered! 🎫",
        description: `${selectedValue} WOVER ticket verified and added`,
      });
      
      setManualTxHash('');
      setShowManualInput(false);
      await refetch();
      getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Could not verify transaction",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
      setTimeout(() => setTxStatus('idle'), 2000);
    }
  };

  const isLoading = isPurchasing || isTransferPending;

  const getStatusMessage = () => {
    switch (txStatus) {
      case 'confirming': return 'Confirm in Wallet...';
      case 'pending': return 'Waiting for confirmation...';
      case 'saving': return 'Saving Ticket...';
      case 'manual': return 'Verifying TX...';
      case 'success': return 'Success!';
      default: return 'Processing...';
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header with gradient accent */}
      <div className="relative px-4 py-3 border-b border-border/30">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Ticket className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Game Tickets</span>
          </div>
          {isConnected && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/50 border border-border/30">
              <Wallet className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium">
                <span className="text-muted-foreground">Balance:</span>{' '}
                <span className="text-foreground">{tokenBalance?.toFixed(2) || '...'} {selectedCurrency}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Available Tickets Display - Grouped by Value */}
        {isConnected && (
          <div className="relative">
            <div className="flex flex-wrap gap-2 p-3 bg-card/50 rounded-xl min-h-[70px] items-center justify-center border border-border/20">
              {groupedTickets.length > 0 ? (
                <>
                  {groupedTickets.slice(0, 6).map((group, index) => (
                    <div
                      key={group.value}
                      className="relative group cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="relative w-14 h-14 bg-gradient-to-br from-primary/40 via-primary/25 to-primary/10 rounded-lg border border-primary/40 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:border-primary/60 group-hover:-translate-y-1">
                        {/* Perforated edge */}
                        <div className="absolute left-0.5 top-1.5 bottom-1.5 w-0.5 flex flex-col justify-around">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-background/80" />
                          ))}
                        </div>
                        {/* Value x Count */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <span className="text-base font-bold text-primary">{group.value}</span>
                            <span className="text-xs text-muted-foreground">×</span>
                            <span className="text-sm font-semibold text-primary/80">{group.count}</span>
                          </div>
                          <span className="text-[7px] text-muted-foreground uppercase tracking-wider">WOVER</span>
                        </div>
                        {/* Shine */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {/* Glow on hover */}
                      <div className="absolute inset-0 blur-lg bg-primary/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-2">
                  <Sparkles className="w-5 h-5 text-muted-foreground/50 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No tickets yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Transaction Banner */}
        {(txStatus === 'pending' || lastTxHash) && showManualInput && (
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-warning animate-spin" />
              <span className="text-sm font-medium text-warning">Transaction Pending</span>
            </div>
            {lastTxHash && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{lastTxHash.slice(0, 16)}...{lastTxHash.slice(-8)}</span>
                <a 
                  href={`https://over.network/tx/${lastTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Manual TX Hash Input */}
        {showManualInput && (
          <div className="p-3 rounded-xl bg-card/50 border border-border/20 space-y-3">
            <p className="text-xs text-muted-foreground">
              If your transaction confirmed but wasn't detected, paste the TX hash:
            </p>
            <div className="flex gap-2">
              <Input
                value={manualTxHash}
                onChange={(e) => setManualTxHash(e.target.value)}
                placeholder="0x..."
                className="text-xs font-mono"
              />
              <Button 
                size="sm" 
                onClick={handleManualSubmit}
                disabled={!manualTxHash || isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </div>
        )}

        {/* Success State */}
        {txStatus === 'success' && (
          <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">Ticket purchased successfully!</span>
          </div>
        )}

        {/* Currency Selection */}
        {txStatus !== 'success' && (
          <>
            <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as 'WOVER' | 'USDT')}>
              <TabsList className="grid w-full grid-cols-2 bg-card/50 h-9">
                <TabsTrigger value="WOVER" className="text-xs font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  WOVER
                </TabsTrigger>
                <TabsTrigger value="USDT" className="text-xs font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  USDT
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Ticket Value Selection */}
            <div className="grid grid-cols-5 gap-2">
              {TICKET_VALUES.map((value) => (
                <Button
                  key={value}
                  variant={selectedValue === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedValue(value)}
                  className={`h-10 text-sm font-bold transition-all duration-200 ${
                    selectedValue === value 
                      ? "bg-primary shadow-lg shadow-primary/30 scale-105 border-0" 
                      : "border-border/40 hover:border-primary/40 hover:bg-primary/10"
                  }`}
                >
                  {value}
                </Button>
              ))}
            </div>

            {/* Price Display */}
            <div className="p-3 rounded-xl bg-card/50 border border-border/20 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">You Pay</span>
                <span className="font-bold text-base">
                  {selectedCurrency === 'WOVER' ? (
                    `${selectedValue} WOVER`
                  ) : isPriceLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    `${usdtAmount} USDT`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Valid for 15 days
                </div>
                <span>Ticket value: {selectedValue} WOVER</span>
              </div>
            </div>

            {/* Purchase Button */}
            <Button
              onClick={handlePurchase}
              disabled={!isConnected || isLoading}
              className="w-full btn-primary h-11 text-sm font-semibold"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{getStatusMessage()}</span>
                </div>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : (
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Buy Ticket
                </div>
              )}
            </Button>

            {/* Info */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/10 text-[10px] text-warning">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Tokens sent to treasury ({TREASURY_WALLET.slice(0, 6)}...{TREASURY_WALLET.slice(-4)}). TX verified on-chain.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketPurchase;
