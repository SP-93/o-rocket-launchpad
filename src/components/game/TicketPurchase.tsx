import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, Clock, AlertCircle } from 'lucide-react';
import { useGameTickets } from '@/hooks/useGameTickets';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
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
  
  const { buyTicket, availableTickets, refetch } = useGameTickets(walletAddress);
  const { price: woverPrice, loading: isPriceLoading } = useCoinGeckoPrice();

  const usdtAmount = selectedCurrency === 'USDT' && woverPrice 
    ? (selectedValue * woverPrice).toFixed(4)
    : null;

  const handlePurchase = async () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to purchase tickets",
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(true);
    try {
      const paymentAmount = selectedCurrency === 'WOVER' 
        ? selectedValue 
        : parseFloat(usdtAmount || '0');

      await buyTicket(selectedValue, selectedCurrency, paymentAmount);
      
      toast({
        title: "Ticket Purchased!",
        description: `You bought a ${selectedValue} WOVER ticket`,
      });
      
      await refetch();
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase ticket",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="w-5 h-5 text-primary" />
          Buy Tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Currency Selection */}
        <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as 'WOVER' | 'USDT')}>
          <TabsList className="grid w-full grid-cols-4 bg-background/50">
            <TabsTrigger value="WOVER" className="data-[state=active]:bg-primary/20">
              WOVER
            </TabsTrigger>
            <TabsTrigger value="USDT" className="data-[state=active]:bg-primary/20">
              USDT
            </TabsTrigger>
            <TabsTrigger value="USDC" disabled className="opacity-50">
              USDC 🔜
            </TabsTrigger>
            <TabsTrigger value="ROCKET" disabled className="opacity-50">
              ROCKET 🔜
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ticket Value Selection */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Ticket Value (WOVER equivalent)</label>
          <div className="grid grid-cols-5 gap-2">
            {TICKET_VALUES.map((value) => (
              <Button
                key={value}
                variant={selectedValue === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedValue(value)}
                className={selectedValue === value ? "bg-primary" : "border-primary/30"}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {/* Price Display */}
        <div className="p-3 rounded-lg bg-background/50 border border-primary/10">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">You Pay:</span>
            <span className="font-bold text-lg">
              {selectedCurrency === 'WOVER' ? (
                `${selectedValue} WOVER`
              ) : isPriceLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `${usdtAmount} USDT`
              )}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-muted-foreground text-sm">Ticket Value:</span>
            <span className="text-primary">{selectedValue} WOVER</span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Valid for 15 days
          </div>
        </div>

        {/* Purchase Button */}
        <Button
          onClick={handlePurchase}
          disabled={!isConnected || isPurchasing}
          className="w-full btn-primary"
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            `Buy Ticket for ${selectedCurrency === 'WOVER' ? `${selectedValue} WOVER` : `${usdtAmount} USDT`}`
          )}
        </Button>

        {/* Available Tickets */}
        {isConnected && availableTickets.length > 0 && (
          <div className="pt-3 border-t border-primary/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available Tickets:</span>
              <span className="text-primary font-medium">{availableTickets.length}</span>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-2 rounded bg-warning/10 text-warning text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Note: On-chain transfer verification coming soon. Tickets are currently simulated for testing.</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketPurchase;
