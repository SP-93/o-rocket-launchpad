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
    <Card className="bg-[#0d0d18]/80 backdrop-blur border-primary/10 overflow-hidden">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          Game Tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* Available Tickets Display with Animation */}
        {isConnected && (
          <div className="flex flex-wrap gap-2 p-2 bg-primary/5 rounded-lg min-h-[60px] items-center justify-center">
            {availableTickets.length > 0 ? (
              availableTickets.slice(0, 6).map((ticket, index) => (
                <div
                  key={ticket.id}
                  className="relative group cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Ticket card */}
                  <div className="relative w-12 h-16 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 rounded-lg border border-primary/30 shadow-lg shadow-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/40 group-hover:-translate-y-1">
                    {/* Ticket perforated edge */}
                    <div className="absolute left-0 top-2 bottom-2 w-1 flex flex-col justify-between">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-[#0d0d18]" />
                      ))}
                    </div>
                    {/* Value */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-primary">{ticket.ticket_value}</span>
                      <span className="text-[8px] text-muted-foreground uppercase tracking-wider">WOVER</span>
                    </div>
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Glow */}
                  <div className="absolute inset-0 blur-md bg-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center">No tickets yet - buy some below!</p>
            )}
            {availableTickets.length > 6 && (
              <div className="text-xs text-muted-foreground">+{availableTickets.length - 6} more</div>
            )}
          </div>
        )}

        {/* Currency Selection */}
        <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as 'WOVER' | 'USDT')}>
          <TabsList className="grid w-full grid-cols-2 bg-background/50 h-8">
            <TabsTrigger value="WOVER" className="text-xs data-[state=active]:bg-primary/20">
              WOVER
            </TabsTrigger>
            <TabsTrigger value="USDT" className="text-xs data-[state=active]:bg-primary/20">
              USDT
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ticket Value Selection */}
        <div className="grid grid-cols-5 gap-1.5">
          {TICKET_VALUES.map((value, index) => (
            <Button
              key={value}
              variant={selectedValue === value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedValue(value)}
              className={`h-9 text-sm font-bold transition-all duration-200 ${
                selectedValue === value 
                  ? "bg-primary shadow-lg shadow-primary/30 scale-105" 
                  : "border-primary/20 hover:border-primary/40 hover:bg-primary/10"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {value}
            </Button>
          ))}
        </div>

        {/* Price Display */}
        <div className="p-2.5 rounded-lg bg-background/30 border border-primary/10 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs">You Pay</span>
            <span className="font-bold">
              {selectedCurrency === 'WOVER' ? (
                `${selectedValue} WOVER`
              ) : isPriceLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                `${usdtAmount} USDT`
              )}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-2.5 h-2.5" />
            Valid for 15 days
          </div>
        </div>

        {/* Purchase Button */}
        <Button
          onClick={handlePurchase}
          disabled={!isConnected || isPurchasing}
          className="w-full btn-primary h-9 text-sm"
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Buying...
            </>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            "Buy Ticket"
          )}
        </Button>

        {/* Info */}
        <div className="flex items-start gap-1.5 p-1.5 rounded bg-warning/10 text-warning text-[10px]">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>On-chain verification coming soon</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketPurchase;
