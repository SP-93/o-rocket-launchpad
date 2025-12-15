import { useState, useEffect, useCallback } from "react";
import { ArrowDownUp, Settings, Info, ChevronDown, Check, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import { TokenIcon } from "@/components/TokenIcon";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { useWallet } from "@/hooks/useWallet";
import { useSwap } from "@/hooks/useSwap";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOKENS = [
  { symbol: "USDT", name: "Tether USD" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "WOVER", name: "Wrapped OVER" },
  { symbol: "OVER", name: "OVER (Native)" },
];

const Swap = () => {
  const { isConnected, isCorrectNetwork, switchNetwork, address } = useWallet();
  const { status, quote, error, txHash, getQuote, executeSwap, getTokenBalance, wrapOver, unwrapWover, reset } = useSwap();
  
  const [activeTab, setActiveTab] = useState<"swap" | "wrap">("swap");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [fromBalance, setFromBalance] = useState("0.00");
  const [toBalance, setToBalance] = useState("0.00");
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Wrap/Unwrap state
  const [wrapAmount, setWrapAmount] = useState("");
  const [wrapDirection, setWrapDirection] = useState<"wrap" | "unwrap">("wrap");
  const [overBalance, setOverBalance] = useState("0.00");
  const [woverBalance, setWoverBalance] = useState("0.00");

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (isConnected && address) {
        const [from, to, over, wover] = await Promise.all([
          getTokenBalance(fromToken.symbol),
          getTokenBalance(toToken.symbol),
          getTokenBalance("OVER"),
          getTokenBalance("WOVER"),
        ]);
        setFromBalance(parseFloat(from).toFixed(4));
        setToBalance(parseFloat(to).toFixed(4));
        setOverBalance(parseFloat(over).toFixed(4));
        setWoverBalance(parseFloat(wover).toFixed(4));
      }
    };
    fetchBalances();
  }, [isConnected, address, fromToken.symbol, toToken.symbol, getTokenBalance, status]);

  // Get quote when amount changes
  useEffect(() => {
    if (activeTab !== "swap") return;
    
    const timer = setTimeout(async () => {
      if (fromAmount && parseFloat(fromAmount) > 0 && fromToken.symbol !== "OVER" && toToken.symbol !== "OVER") {
        const newQuote = await getQuote(fromToken.symbol, toToken.symbol, fromAmount);
        if (newQuote) {
          setToAmount(parseFloat(newQuote.amountOut).toFixed(6));
        }
      } else {
        setToAmount("");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken.symbol, toToken.symbol, getQuote, activeTab]);

  const handleSwitch = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    const tempBalance = fromBalance;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setFromBalance(toBalance);
    setToBalance(tempBalance);
  };

  const handleSwap = async () => {
    if (!isConnected) {
      setShowWalletModal(true);
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) === 0) {
      toast.error("Enter an amount to swap");
      return;
    }

    const success = await executeSwap({
      tokenIn: fromToken.symbol,
      tokenOut: toToken.symbol,
      amountIn: fromAmount,
      slippageTolerance: slippage,
      deadline,
    });

    if (success) {
      toast.success("Swap successful!", {
        description: `Swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
      });
      setFromAmount("");
      setToAmount("");
      reset();
    } else if (error) {
      toast.error("Swap failed", { description: error });
    }
  };

  const handleWrapUnwrap = async () => {
    if (!isConnected) {
      setShowWalletModal(true);
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!wrapAmount || parseFloat(wrapAmount) === 0) {
      toast.error("Enter an amount");
      return;
    }

    let success = false;
    if (wrapDirection === "wrap") {
      success = await wrapOver(wrapAmount);
      if (success) {
        toast.success("Wrap successful!", {
          description: `Wrapped ${wrapAmount} OVER to WOVER`,
        });
      }
    } else {
      success = await unwrapWover(wrapAmount);
      if (success) {
        toast.success("Unwrap successful!", {
          description: `Unwrapped ${wrapAmount} WOVER to OVER`,
        });
      }
    }

    if (success) {
      setWrapAmount("");
      reset();
    } else if (error) {
      toast.error(wrapDirection === "wrap" ? "Wrap failed" : "Unwrap failed", { description: error });
    }
  };

  const handleMaxClick = () => {
    setFromAmount(fromBalance);
  };

  const handleWrapMaxClick = () => {
    if (wrapDirection === "wrap") {
      // Leave some OVER for gas
      const maxOver = Math.max(0, parseFloat(overBalance) - 0.01);
      setWrapAmount(maxOver.toFixed(4));
    } else {
      setWrapAmount(woverBalance);
    }
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (!isCorrectNetwork) return "Switch to OverProtocol";
    if (status === "quoting") return "Getting Quote...";
    if (status === "approving") return "Approving Token...";
    if (status === "swapping") return "Swapping...";
    if (!fromAmount || parseFloat(fromAmount) === 0) return "Enter Amount";
    if (parseFloat(fromAmount) > parseFloat(fromBalance)) return "Insufficient Balance";
    return "Swap";
  };

  const getWrapButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (!isCorrectNetwork) return "Switch to OverProtocol";
    if (status === "wrapping") return "Wrapping...";
    if (status === "unwrapping") return "Unwrapping...";
    if (!wrapAmount || parseFloat(wrapAmount) === 0) return "Enter Amount";
    
    const balance = wrapDirection === "wrap" ? overBalance : woverBalance;
    if (parseFloat(wrapAmount) > parseFloat(balance)) return "Insufficient Balance";
    
    return wrapDirection === "wrap" ? "Wrap OVER → WOVER" : "Unwrap WOVER → OVER";
  };

  const isButtonDisabled = () => {
    if (!isConnected) return false;
    if (!isCorrectNetwork) return false;
    if (status === "quoting" || status === "approving" || status === "swapping") return true;
    if (!fromAmount || parseFloat(fromAmount) === 0) return true;
    if (parseFloat(fromAmount) > parseFloat(fromBalance)) return true;
    return false;
  };

  const isWrapButtonDisabled = () => {
    if (!isConnected) return false;
    if (!isCorrectNetwork) return false;
    if (status === "wrapping" || status === "unwrapping") return true;
    if (!wrapAmount || parseFloat(wrapAmount) === 0) return true;
    
    const balance = wrapDirection === "wrap" ? overBalance : woverBalance;
    if (parseFloat(wrapAmount) > parseFloat(balance)) return true;
    
    return false;
  };

  const TokenSelector = ({ 
    selected, 
    onSelect, 
    excludeToken,
    excludeNative = false,
  }: { 
    selected: typeof TOKENS[0]; 
    onSelect: (token: typeof TOKENS[0]) => void;
    excludeToken: string;
    excludeNative?: boolean;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="btn-secondary shrink-0 px-4 gap-2 min-w-[140px]">
          <TokenIcon symbol={selected.symbol} size="sm" />
          <span className="font-semibold">{selected.symbol}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 bg-card/95 backdrop-blur-xl border-primary/20">
        {TOKENS.filter(t => t.symbol !== excludeToken && (!excludeNative || t.symbol !== "OVER")).map((token) => (
          <DropdownMenuItem
            key={token.symbol}
            onClick={() => onSelect(token)}
            className="flex items-center gap-3 cursor-pointer hover:bg-primary/10 py-3"
          >
            <TokenIcon symbol={token.symbol} size="md" />
            <div className="flex-1">
              <p className="font-semibold">{token.symbol}</p>
              <p className="text-xs text-muted-foreground">{token.name}</p>
            </div>
            {selected.symbol === token.symbol && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">Swap Tokens</h1>
            <p className="text-muted-foreground text-sm md:text-base">Trade tokens instantly on OverProtocol</p>
          </div>

          <Card className="glass-card p-4 md:p-6 mb-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "swap" | "wrap")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="swap">Swap</TabsTrigger>
                <TabsTrigger value="wrap">Wrap/Unwrap</TabsTrigger>
              </TabsList>

              <TabsContent value="swap" className="mt-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg md:text-xl font-semibold">Swap</h2>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Settings className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-card/95 backdrop-blur-xl border-primary/20">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Slippage Tolerance</label>
                          <div className="flex gap-2">
                            {[0.1, 0.5, 1].map((val) => (
                              <Button
                                key={val}
                                variant={slippage === val ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSlippage(val)}
                                className={slippage === val ? "bg-primary" : ""}
                              >
                                {val}%
                              </Button>
                            ))}
                            <Input
                              type="number"
                              value={slippage}
                              onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                              className="w-20 text-center"
                              placeholder="0.5"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Transaction Deadline</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={deadline}
                              onChange={(e) => setDeadline(parseInt(e.target.value) || 20)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">minutes</span>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* From Token */}
                <div className="mb-2">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">From</span>
                      <button 
                        onClick={handleMaxClick}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        Balance: {fromBalance} <span className="text-primary ml-1">MAX</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        className="border-0 bg-transparent text-xl md:text-2xl font-semibold p-0 h-auto focus-visible:ring-0 flex-1 min-w-0"
                      />
                      <TokenSelector 
                        selected={fromToken} 
                        onSelect={setFromToken}
                        excludeToken={toToken.symbol}
                        excludeNative={true}
                      />
                    </div>
                  </div>
                </div>

                {/* Switch Button */}
                <div className="flex justify-center -my-3 relative z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSwitch}
                    className="rounded-full bg-card border-2 border-primary/20 hover:bg-card hover:border-primary/40 transition-all hover:rotate-180 duration-300"
                  >
                    <ArrowDownUp className="w-5 h-5 text-primary" />
                  </Button>
                </div>

                {/* To Token */}
                <div className="mb-6">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">To</span>
                      <span className="text-sm text-muted-foreground">Balance: {toBalance}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={toAmount}
                        readOnly
                        className="border-0 bg-transparent text-xl md:text-2xl font-semibold p-0 h-auto focus-visible:ring-0 flex-1 min-w-0"
                      />
                      <TokenSelector 
                        selected={toToken} 
                        onSelect={setToToken}
                        excludeToken={fromToken.symbol}
                        excludeNative={true}
                      />
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                {quote && fromAmount && (
                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">
                        1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                      <span className="text-muted-foreground">Price Impact</span>
                      <span className={`font-medium ${
                        quote.priceImpact < 1 ? 'text-success' : 
                        quote.priceImpact < 5 ? 'text-warning' : 'text-destructive'
                      }`}>
                        {quote.priceImpact < 0.01 ? '<0.01' : quote.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                      <span className="text-muted-foreground">Liquidity Provider Fee</span>
                      <span className="font-medium">0.3%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                      <span className="text-muted-foreground">Minimum Received</span>
                      <span className="font-medium">
                        {(parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6)} {toToken.symbol}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && activeTab === "swap" && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                )}

                <Button 
                  className="w-full btn-primary text-lg"
                  onClick={handleSwap}
                  disabled={isButtonDisabled()}
                >
                  {(status === "approving" || status === "swapping" || status === "quoting") && (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  )}
                  {getButtonText()}
                </Button>
              </TabsContent>

              <TabsContent value="wrap" className="mt-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg md:text-xl font-semibold">
                    {wrapDirection === "wrap" ? "Wrap OVER" : "Unwrap WOVER"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWrapDirection(wrapDirection === "wrap" ? "unwrap" : "wrap")}
                    className="text-primary"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Switch
                  </Button>
                </div>

                {/* Balance Display */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <TokenIcon symbol="OVER" size="sm" />
                      <span className="text-sm font-medium">OVER</span>
                    </div>
                    <p className="text-lg font-semibold">{overBalance}</p>
                    <p className="text-xs text-muted-foreground">Native Token</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <TokenIcon symbol="WOVER" size="sm" />
                      <span className="text-sm font-medium">WOVER</span>
                    </div>
                    <p className="text-lg font-semibold">{woverBalance}</p>
                    <p className="text-xs text-muted-foreground">Wrapped Token</p>
                  </div>
                </div>

                {/* Wrap/Unwrap Input */}
                <div className="mb-6">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {wrapDirection === "wrap" ? "OVER to wrap" : "WOVER to unwrap"}
                      </span>
                      <button 
                        onClick={handleWrapMaxClick}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        Balance: {wrapDirection === "wrap" ? overBalance : woverBalance}{" "}
                        <span className="text-primary ml-1">MAX</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={wrapAmount}
                        onChange={(e) => setWrapAmount(e.target.value)}
                        className="border-0 bg-transparent text-xl md:text-2xl font-semibold p-0 h-auto focus-visible:ring-0 flex-1 min-w-0"
                      />
                      <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-lg">
                        <TokenIcon symbol={wrapDirection === "wrap" ? "OVER" : "WOVER"} size="sm" />
                        <span className="font-semibold">{wrapDirection === "wrap" ? "OVER" : "WOVER"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center mb-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <TokenIcon symbol={wrapDirection === "wrap" ? "OVER" : "WOVER"} size="sm" />
                    <span>→</span>
                    <TokenIcon symbol={wrapDirection === "wrap" ? "WOVER" : "OVER"} size="sm" />
                    <span className="text-sm">
                      {wrapAmount || "0"} {wrapDirection === "wrap" ? "WOVER" : "OVER"}
                    </span>
                  </div>
                </div>

                {/* Error Display */}
                {error && activeTab === "wrap" && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                )}

                <Button 
                  className="w-full btn-primary text-lg"
                  onClick={handleWrapUnwrap}
                  disabled={isWrapButtonDisabled()}
                >
                  {(status === "wrapping" || status === "unwrapping") && (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  )}
                  {getWrapButtonText()}
                </Button>

                {/* Info Card for Wrap */}
                <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Why wrap?</strong> WOVER is an ERC-20 token that represents OVER 1:1. 
                    It's needed for liquidity pools and some DEX operations. You can unwrap back to OVER anytime.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Info Card */}
          <Card className="glass-card p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Concentrated Liquidity DEX</p>
                <p>O'Rocket uses Uniswap V3 architecture for optimal capital efficiency and better pricing.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      <ConnectWalletModal 
        open={showWalletModal} 
        onOpenChange={setShowWalletModal} 
      />
    </SpaceBackground>
  );
};

export default Swap;
