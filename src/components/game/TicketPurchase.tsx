import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, Clock, AlertCircle, Wallet, Sparkles } from 'lucide-react';
import { useGameTickets } from '@/hooks/useGameTickets';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { useTokenTransfer } from '@/hooks/useTokenTransfer';
import { toast } from '@/hooks/use-toast';

interface TicketPurchaseProps {
  walletAddress: string | undefined;
  isConnected: boolean;
}

const TICKET_VALUES = [1, 2, 3, 4, 5];

const TicketPurchase = ({ walletAddress, isConnected }: TicketPurchaseProps) => {
  const [selectedValue, setSelectedValue] = useState<number>(1);
  const [selectedCurrency, setSelectedCurrency] = useState<'WOVER' | 'USDT'>('WOVER');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'confirming' | 'saving'>('idle');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  
  const { buyTicket, availableTickets, refetch } = useGameTickets(walletAddress);
  const { price: woverPrice, loading: isPriceLoading } = useCoinGeckoPrice();
  const { transferToken, getTokenBalance, isPending: isTransferPending } = useTokenTransfer();

  const usdtAmount = selectedCurrency === 'USDT' && woverPrice 
    ? (selectedValue * woverPrice).toFixed(4)
    : null;

  // Fetch token balance
  useEffect(() => {
    if (walletAddress && isConnected) {
      getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
    }
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

    try {
      // Step 1: Execute blockchain transfer
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet",
      });

      const result = await transferToken(selectedCurrency, paymentAmount);

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      setTxStatus('saving');

      // Step 2: Register ticket in database with tx hash
      await buyTicket(selectedValue, selectedCurrency, paymentAmount, result.txHash);
      
      toast({
        title: "Ticket Purchased! 🎫",
        description: `${selectedValue} WOVER ticket added to your collection`,
      });
      
      // Refresh data
      await refetch();
      if (walletAddress) {
        getTokenBalance(selectedCurrency, walletAddress).then(setTokenBalance);
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase ticket",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
      setTxStatus('idle');
    }
  };

  const isLoading = isPurchasing || isTransferPending;

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
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="w-3 h-3" />
              <span>{tokenBalance?.toFixed(2) || '...'} {selectedCurrency}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Available Tickets Display */}
        {isConnected && (
          <div className="relative">
            <div className="flex flex-wrap gap-2 p-3 bg-card/50 rounded-xl min-h-[70px] items-center justify-center border border-border/20">
              {availableTickets.length > 0 ? (
                <>
                  {availableTickets.slice(0, 6).map((ticket, index) => (
                    <div
                      key={ticket.id}
                      className="relative group cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="relative w-11 h-14 bg-gradient-to-br from-primary/40 via-primary/25 to-primary/10 rounded-lg border border-primary/40 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:border-primary/60 group-hover:-translate-y-1">
                        {/* Perforated edge */}
                        <div className="absolute left-0.5 top-1.5 bottom-1.5 w-0.5 flex flex-col justify-around">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-background/80" />
                          ))}
                        </div>
                        {/* Value */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-base font-bold text-primary">{ticket.ticket_value}</span>
                          <span className="text-[7px] text-muted-foreground uppercase tracking-wider">WOVER</span>
                        </div>
                        {/* Shine */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {/* Glow on hover */}
                      <div className="absolute inset-0 blur-lg bg-primary/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                    </div>
                  ))}
                  {availableTickets.length > 6 && (
                    <div className="flex items-center justify-center w-11 h-14 rounded-lg border border-dashed border-primary/30 text-xs text-muted-foreground">
                      +{availableTickets.length - 6}
                    </div>
                  )}
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

        {/* Currency Selection */}
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
              <span>
                {txStatus === 'confirming' && 'Confirm in Wallet...'}
                {txStatus === 'saving' && 'Saving Ticket...'}
                {txStatus === 'idle' && 'Processing...'}
              </span>
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
          <span>Tokens are transferred to the game treasury. Transaction required.</span>
        </div>
      </div>
    </div>
  );
};

export default TicketPurchase;
