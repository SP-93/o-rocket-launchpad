import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, Clock, AlertCircle, Wallet, Sparkles, CheckCircle, ExternalLink, Zap } from 'lucide-react';
import { useGameTicketsContext } from '@/contexts/GameTicketsContext';
import { useDexPrice } from '@/hooks/useDexPrice';
import { useTokenTransfer, TREASURY_WALLET } from '@/hooks/useTokenTransfer';
import { useTicketNFT } from '@/hooks/useTicketNFT';
import { useWalletBalance, triggerBalanceRefresh } from '@/hooks/useWalletBalance';
import { toast } from '@/hooks/use-toast';
import PlayerTicketList from './PlayerTicketList';
import { ethers } from 'ethers';
import { getDeployedContracts } from '@/contracts/storage';
import { getReadProvider } from '@/lib/walletProvider';

interface TicketPurchaseProps {
  walletAddress: string | undefined;
  isConnected: boolean;
}

const TICKET_VALUES = [1, 2, 3, 4, 5];

type TxStatus = 'idle' | 'confirming' | 'pending' | 'saving' | 'success' | 'manual' | 'recovering';

// Pending purchase storage key
const PENDING_PURCHASE_KEY = 'pending_ticket_purchase';
const RECOVERY_CHECK_INTERVAL = 5000;

interface PendingPurchase {
  txHash: string;
  walletAddress: string;
  ticketValue: number;
  currency: 'WOVER' | 'USDT';
  paymentAmount: number;
  timestamp: number;
}

// LocalStorage helpers
const savePendingPurchase = (data: PendingPurchase) => {
  try {
    localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(data));
    console.log('[TicketPurchase] Saved pending purchase:', data.txHash);
  } catch (e) {
    console.warn('[TicketPurchase] Failed to save pending purchase:', e);
  }
};

const getPendingPurchase = (): PendingPurchase | null => {
  try {
    const data = localStorage.getItem(PENDING_PURCHASE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const clearPendingPurchase = () => {
  localStorage.removeItem(PENDING_PURCHASE_KEY);
  console.log('[TicketPurchase] Cleared pending purchase');
};

const TicketPurchase = ({ walletAddress, isConnected }: TicketPurchaseProps) => {
  const [selectedValue, setSelectedValue] = useState<number>(1);
  const [selectedCurrency, setSelectedCurrency] = useState<'WOVER' | 'USDT'>('WOVER');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [manualTxHash, setManualTxHash] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const recoveryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecoveryInFlight = useRef(false);
  
  const { buyTicket, availableTickets, refetch } = useGameTicketsContext();
  const { dexPrice: woverPrice, isLoading: isPriceLoading } = useDexPrice();
  const { transferToken, verifyTransaction, isPending: isTransferPending, pendingTxHash } = useTokenTransfer();
  const { buyWithWover, buyWithUsdt, getContract, fetchContractState, contractState } = useTicketNFT();
  
  // Check if NFT contract is deployed AND has valid woverPrice
  const [nftContractReady, setNftContractReady] = useState(false);
  const [nftWoverPrice, setNftWoverPrice] = useState<string>('0');
  
  useEffect(() => {
    const checkNFTContract = async () => {
      const contracts = getDeployedContracts();
      const ticketNFTAddress = (contracts as any).ticketNFT;
      
      if (!ticketNFTAddress) {
        setNftContractReady(false);
        return;
      }
      
      // Check woverPrice on contract
      try {
        const provider = getReadProvider();
        const contract = new ethers.Contract(
          ticketNFTAddress,
          ['function woverPrice() view returns (uint256)'],
          provider
        );
        const price = await contract.woverPrice();
        const priceFormatted = ethers.utils.formatEther(price);
        setNftWoverPrice(priceFormatted);
        setNftContractReady(!price.isZero());
        console.log('[TicketPurchase] NFT contract check - price:', priceFormatted, 'ready:', !price.isZero());
      } catch (e) {
        console.warn('[TicketPurchase] Failed to check NFT contract:', e);
        setNftContractReady(false);
      }
    };
    
    checkNFTContract();
  }, []);
  
  // Use real-time balance hook
  const { balance: tokenBalance, refreshBalance } = useWalletBalance(
    isConnected ? walletAddress : undefined,
    { currency: selectedCurrency, refreshInterval: 3000 }
  );

  const usdtAmount = selectedCurrency === 'USDT' && woverPrice 
    ? (selectedValue * woverPrice).toFixed(4)
    : null;

  // Attempt to register ticket with backend (used for recovery)
  const attemptTicketRegistration = useCallback(async (pending: PendingPurchase): Promise<boolean> => {
    try {
      console.log('[TicketPurchase] Attempting ticket registration for tx:', pending.txHash);
      await buyTicket(pending.ticketValue, pending.currency, pending.paymentAmount, pending.txHash);
      return true;
    } catch (error: any) {
      if (error?.message?.includes('already') || error?.message?.includes('existing')) {
        console.log('[TicketPurchase] Ticket already registered for this tx');
        return true;
      }
      console.warn('[TicketPurchase] Registration failed:', error);
      return false;
    }
  }, [buyTicket]);

  // Recovery loop
  useEffect(() => {
    if (!walletAddress) return;

    const checkPendingPurchase = async () => {
      if (isRecoveryInFlight.current) {
        return;
      }
      
      const pending = getPendingPurchase();
      if (!pending) return;
      
      if (pending.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return;
      }

      const age = Date.now() - pending.timestamp;
      if (age > 15 * 60 * 1000) {
        console.log('[TicketPurchase] Pending purchase too old, clearing');
        clearPendingPurchase();
        return;
      }

      isRecoveryInFlight.current = true;

      try {
        const provider = getReadProvider();
        const receipt = await provider.getTransactionReceipt(pending.txHash);
        
        if (receipt) {
          if (receipt.status === 1) {
            console.log('[TicketPurchase] Pending tx confirmed, registering ticket...');
            setTxStatus('recovering');
            
            const success = await attemptTicketRegistration(pending);
            if (success) {
              clearPendingPurchase();
              toast({
                title: 'Ticket Recovered! 🎫',
                description: `${pending.ticketValue} WOVER ticket registered successfully`,
              });
              await refetch();
              triggerBalanceRefresh();
            }
            setTxStatus('idle');
          } else {
            console.log('[TicketPurchase] Pending tx failed on-chain');
            clearPendingPurchase();
            toast({
              title: 'Transaction Failed',
              description: 'The pending transaction failed on-chain',
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.warn('[TicketPurchase] Error checking pending tx:', error);
      } finally {
        isRecoveryInFlight.current = false;
      }
    };

    const initialTimeout = setTimeout(checkPendingPurchase, 1000);
    recoveryIntervalRef.current = setInterval(checkPendingPurchase, RECOVERY_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
      }
    };
  }, [walletAddress, attemptTicketRegistration, refetch]);

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
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet",
      });

      let txHash: string | undefined;

      // Use NFT Contract if deployed AND configured (woverPrice > 0)
      if (nftContractReady) {
        try {
          console.log('[TicketPurchase] Using NFT contract for purchase');
          
          let result: { tokenId: number; txHash: string };
          if (selectedCurrency === 'WOVER') {
            // buyWithWover now uses getUniversalSigner internally
            result = await buyWithWover(selectedValue);
          } else {
            result = await buyWithUsdt(selectedValue, usdtAmount || '0');
          }
          
          const { tokenId, txHash: nftTxHash } = result;
          
          console.log('[TicketPurchase] NFT minted successfully:', { tokenId, txHash: nftTxHash });
          
          // Register in Supabase for tracking
          await buyTicket(selectedValue, selectedCurrency, paymentAmount, nftTxHash);
          
          setTxStatus('success');
          toast({
            title: "NFT Ticket Minted! 🎫",
            description: `Ticket #${tokenId} (${selectedValue} WOVER) minted on-chain`,
          });
          
          await refetch();
          triggerBalanceRefresh();
          return;
        } catch (nftError: any) {
          console.error('[TicketPurchase] NFT contract failed:', nftError);
          toast({
            title: "NFT Mint Failed",
            description: nftError.message || "Failed to mint NFT ticket",
            variant: "destructive",
          });
          setIsPurchasing(false);
          setTxStatus('idle');
          return;
        }
      }

      // Legacy method: Direct token transfer (default when NFT not ready)
      console.log('[TicketPurchase] Using legacy transfer method');
      const result = await transferToken(selectedCurrency, paymentAmount);

      if (!result.success && !result.txHash) {
        throw new Error(result.error || 'Transaction failed');
      }

      txHash = result.txHash;
      setLastTxHash(txHash || null);

      if (txHash) {
        savePendingPurchase({
          txHash,
          walletAddress: walletAddress.toLowerCase(),
          ticketValue: selectedValue,
          currency: selectedCurrency,
          paymentAmount,
          timestamp: Date.now(),
        });
      }

      if (result.status === 'pending') {
        setTxStatus('pending');
        toast({
          title: "Transaction Pending",
          description: "Your transaction is being processed. Ticket will be registered automatically when confirmed.",
        });
        setIsPurchasing(false);
        return;
      }

      if (result.status === 'confirmed' && txHash) {
        setTxStatus('saving');

        await buyTicket(selectedValue, selectedCurrency, paymentAmount, txHash);
        
        clearPendingPurchase();
        
        setTxStatus('success');
        toast({
          title: "Ticket Purchased! 🎫",
          description: `${selectedValue} WOVER ticket added to your collection`,
        });
        
        await refetch();
        triggerBalanceRefresh();
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
      const verification = await verifyTransaction(txHash);
      
      if (verification.status === 'failed') {
        throw new Error('Transaction failed on-chain');
      }

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
      triggerBalanceRefresh();
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
            {nftContractReady && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> NFT
              </span>
            )}
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
        {/* Available Tickets Display */}
        {isConnected && (
          <div className="relative">
            <div className="p-3 bg-card/50 rounded-xl min-h-[90px] border border-border/20">
              {availableTickets.length > 0 ? (
                <PlayerTicketList tickets={availableTickets} />
              ) : (
                <div className="text-center py-3">
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
              <span>
                {nftContractReady 
                  ? 'Ticket minted as NFT on-chain. Provably fair.'
                  : `Tokens sent to treasury (${TREASURY_WALLET.slice(0, 6)}...${TREASURY_WALLET.slice(-4)}). TX verified on-chain.`
                }
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketPurchase;
