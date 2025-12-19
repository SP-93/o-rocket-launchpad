import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Info, ChevronDown, Loader2, AlertTriangle, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TokenIcon } from "@/components/TokenIcon";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { useWallet } from "@/hooks/useWallet";
import { useLiquidity } from "@/hooks/useLiquidity";
import { toast } from "sonner";

const AVAILABLE_TOKENS = [
  { symbol: "OVER", name: "Native OVER", isNative: true },
  { symbol: "WOVER", name: "Wrapped OVER" },
  { symbol: "USDT", name: "Tether USD" },
  { symbol: "USDC", name: "USD Coin" },
];

const FEE_TIERS = [
  { value: 500, label: "0.05%", description: "Stable pairs", tickSpacing: 10 },
  { value: 3000, label: "0.3%", description: "Standard (Best)", tickSpacing: 60 },
  { value: 10000, label: "1%", description: "Volatile pairs", tickSpacing: 200 },
];

// Tick bounds for full range - must be aligned to tickSpacing
const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

const AddLiquidity = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected, isCorrectNetwork, address, switchNetwork } = useWallet();
  const { status, error, txHash, addLiquidity, increaseLiquidity, getTokenBalance, getPoolPrice, reset } = useLiquidity();
  
  const [step, setStep] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Get tokens from URL params or default
  const [token0, setToken0] = useState(searchParams.get("token0") || "USDT");
  const [token1, setToken1] = useState(searchParams.get("token1") || "USDC");
  const [selectedFee, setSelectedFee] = useState(
    parseInt(searchParams.get("fee") || "3000")
  );
  
  // Check if we're adding to existing position
  const existingTokenId = searchParams.get("tokenId");
  // Token selector state
  const [selectingToken, setSelectingToken] = useState<"token0" | "token1" | null>(null);
  
  // Price range state
  const [isFullRange, setIsFullRange] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  // Deposit amounts
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  // Slippage and deadline
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);

  // Pool availability per fee tier
  const [availableFees, setAvailableFees] = useState<Record<number, boolean>>({});
  const [checkingPools, setCheckingPools] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Auto-calculate other token amount based on pool price
  const handleAmount0Change = (value: string) => {
    setAmount0(value);
    if (currentPrice && value && parseFloat(value) > 0 && !isAutoCalculating) {
      setIsAutoCalculating(true);
      const calculatedAmount1 = parseFloat(value) * currentPrice;
      setAmount1(calculatedAmount1.toFixed(6));
      setTimeout(() => setIsAutoCalculating(false), 100);
    }
  };

  const handleAmount1Change = (value: string) => {
    setAmount1(value);
    if (currentPrice && value && parseFloat(value) > 0 && !isAutoCalculating) {
      setIsAutoCalculating(true);
      const calculatedAmount0 = parseFloat(value) / currentPrice;
      setAmount0(calculatedAmount0.toFixed(6));
      setTimeout(() => setIsAutoCalculating(false), 100);
    }
  };

  useEffect(() => {
    // Update from URL params if they change
    const urlToken0 = searchParams.get("token0");
    const urlToken1 = searchParams.get("token1");
    const urlFee = searchParams.get("fee");
    
    if (urlToken0) setToken0(urlToken0);
    if (urlToken1) setToken1(urlToken1);
    if (urlFee) setSelectedFee(parseInt(urlFee));
  }, [searchParams]);

  // Check pool availability for all fee tiers - PARALLELIZED
  useEffect(() => {
    const checkPoolsForAllFees = async () => {
      if (!token0 || !token1) return;
      setCheckingPools(true);
      
      // Parallel fetch all pool prices instead of sequential
      const pricePromises = FEE_TIERS.map(tier => 
        getPoolPrice(token0, token1, tier.value).then(price => ({ fee: tier.value, exists: price !== null }))
      );
      
      const priceResults = await Promise.all(pricePromises);
      const results: Record<number, boolean> = {};
      priceResults.forEach(r => { results[r.fee] = r.exists; });
      
      setAvailableFees(results);
      
      // Auto-select available fee if current is not available
      if (!results[selectedFee]) {
        const availableTier = FEE_TIERS.find(t => results[t.value]);
        if (availableTier) setSelectedFee(availableTier.value);
      }
      setCheckingPools(false);
      setInitialLoadComplete(true);
    };
    
    checkPoolsForAllFees();
  }, [token0, token1, getPoolPrice]);

  // Fetch balances and pool price
  useEffect(() => {
    const fetchData = async () => {
      if (isConnected && address) {
        setLoadingBalances(true);
        try {
          console.log(`Fetching balances for ${token0} and ${token1}...`);
          const [b0, b1] = await Promise.all([
            getTokenBalance(token0),
            getTokenBalance(token1),
          ]);
          console.log(`Balances received: ${token0}=${b0}, ${token1}=${b1}`);
          setBalance0(parseFloat(b0).toFixed(4));
          setBalance1(parseFloat(b1).toFixed(4));
          
          // Get pool price
          const price = await getPoolPrice(token0, token1, selectedFee);
          setCurrentPrice(price);
        } catch (err) {
          console.error('Error fetching balances:', err);
        } finally {
          setLoadingBalances(false);
        }
      }
    };
    fetchData();
  }, [isConnected, address, token0, token1, selectedFee, getTokenBalance, getPoolPrice]);

  const handleTokenSelect = (symbol: string) => {
    if (selectingToken === "token0") {
      if (symbol === token1) {
        setToken1(token0);
      }
      setToken0(symbol);
    } else if (selectingToken === "token1") {
      if (symbol === token0) {
        setToken0(token1);
      }
      setToken1(symbol);
    }
    setSelectingToken(null);
  };

  const handleAddLiquidity = async () => {
    if (!isConnected) {
      setShowWalletModal(true);
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!amount0 || !amount1 || parseFloat(amount0) === 0 || parseFloat(amount1) === 0) {
      toast.error("Please enter deposit amounts");
      return;
    }

    // If we have an existing tokenId, use increaseLiquidity
    if (existingTokenId) {
      const success = await increaseLiquidity({
        tokenId: existingTokenId,
        amount0,
        amount1,
        slippageTolerance: slippage,
        deadline,
      });

      if (success) {
        toast.success("Liquidity added to existing position!", {
          description: `Position NFT #${existingTokenId} updated`,
        });
        navigate("/positions");
      } else if (error) {
        toast.error("Failed to add liquidity", { description: error });
      }
      return;
    }

    // Otherwise, create new position with mint
    // Get tick spacing for selected fee
    const feeTier = FEE_TIERS.find(f => f.value === selectedFee);
    const tickSpacing = feeTier?.tickSpacing || 60;

    // Calculate ticks - use aligned min/max for full range
    let tickLower = getMinTick(tickSpacing);
    let tickUpper = getMaxTick(tickSpacing);

    if (!isFullRange && minPrice && maxPrice) {
      // Convert prices to ticks (simplified)
      const minPriceNum = parseFloat(minPrice);
      const maxPriceNum = parseFloat(maxPrice);
      
      if (minPriceNum > 0 && maxPriceNum > 0 && maxPriceNum > minPriceNum) {
        tickLower = Math.floor(Math.log(minPriceNum) / Math.log(1.0001));
        tickUpper = Math.ceil(Math.log(maxPriceNum) / Math.log(1.0001));
      }
    }

    // Round to tick spacing
    tickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
    tickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

    const tokenId = await addLiquidity({
      token0Symbol: token0,
      token1Symbol: token1,
      fee: selectedFee,
      amount0,
      amount1,
      tickLower,
      tickUpper,
      slippageTolerance: slippage,
      deadline,
    });

    if (tokenId) {
      toast.success("Liquidity added successfully!", {
        description: `Position NFT #${tokenId} created`,
      });
      navigate("/positions");
    } else if (error) {
      toast.error("Failed to add liquidity", { description: error });
    }
  };

  const selectedFeeLabel = FEE_TIERS.find(f => f.value === selectedFee)?.label || "0.3%";

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (!isCorrectNetwork) return "Switch to OverProtocol";
    if (currentPrice === null && !existingTokenId) return "Pool Doesn't Exist";
    if (status === "wrapping") return "Wrapping OVER...";
    if (status === "approving") return "Approving Tokens...";
    if (status === "adding" || status === "increasing") return existingTokenId ? "Adding to Position..." : "Adding Liquidity...";
    if (!amount0 || !amount1) return "Enter Amounts";
    if (parseFloat(amount0) > parseFloat(balance0)) return `Insufficient ${token0}`;
    if (parseFloat(amount1) > parseFloat(balance1)) return `Insufficient ${token1}`;
    return existingTokenId ? "Add to Position" : "Add Liquidity";
  };

  const isButtonDisabled = () => {
    if (!isConnected) return false;
    if (!isCorrectNetwork) return false;
    if (currentPrice === null && !existingTokenId) return true; // Pool doesn't exist (but allow for existing positions)
    if (status === "wrapping" || status === "approving" || status === "adding" || status === "increasing") return true;
    if (!amount0 || !amount1) return true;
    if (parseFloat(amount0) > parseFloat(balance0)) return true;
    if (parseFloat(amount1) > parseFloat(balance1)) return true;
    return false;
  };

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/pools")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pools
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 gradient-text">
              {existingTokenId ? "Add More Liquidity" : "Add Liquidity"}
            </h1>
            <p className="text-muted-foreground">
              {existingTokenId 
                ? `Adding to Position #${existingTokenId}` 
                : "Create a new liquidity position"
              }
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= num
                      ? "bg-gradient-to-r from-primary to-accent text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > num ? <Check className="w-5 h-5" /> : num}
                </div>
                {num < 4 && (
                  <div className={`w-12 h-1 ${step > num ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <Card className="glass-card p-6 mb-4">
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Select Pool & Fee Tier</h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Token Pair</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Token 0 Selector */}
                      <button
                        onClick={() => setSelectingToken("token0")}
                        className="h-14 flex items-center justify-center gap-2 rounded-xl bg-muted/50 border border-primary/30 hover:border-primary/50 transition-colors"
                      >
                        <TokenIcon symbol={token0} size="md" />
                        <span className="text-lg font-semibold">{token0}</span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </button>
                      
                      {/* Token 1 Selector */}
                      <button
                        onClick={() => setSelectingToken("token1")}
                        className="h-14 flex items-center justify-center gap-2 rounded-xl bg-muted/50 border border-primary/30 hover:border-primary/50 transition-colors"
                      >
                        <TokenIcon symbol={token1} size="md" />
                        <span className="text-lg font-semibold">{token1}</span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Token Selection Dropdown */}
                    {selectingToken && (
                      <div className="mt-2 p-2 rounded-xl bg-card border border-primary/30">
                        <p className="text-xs text-muted-foreground mb-2 px-2">Select token</p>
                        {AVAILABLE_TOKENS.map((t) => (
                          <button
                            key={t.symbol}
                            onClick={() => handleTokenSelect(t.symbol)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <TokenIcon symbol={t.symbol === "OVER" ? "WOVER" : t.symbol} size="md" />
                            <div className="text-left flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{t.symbol}</p>
                                {t.isNative && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                    Native
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t.name}
                                {t.isNative && " (auto-wraps to WOVER)"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Fee Tier</label>
                    <div className="grid grid-cols-3 gap-3">
                      {FEE_TIERS.map((tier) => {
                        const isAvailable = availableFees[tier.value];
                        const isSelected = selectedFee === tier.value;
                        
                        return (
                          <Button 
                            key={tier.value}
                            variant={isSelected ? "default" : "outline"}
                            className={`h-20 flex flex-col relative ${
                              isSelected 
                                ? "bg-gradient-to-r from-primary to-accent" 
                                : "border-primary/30"
                            } ${!isAvailable && "opacity-50 cursor-not-allowed"}`}
                            onClick={() => isAvailable && setSelectedFee(tier.value)}
                            disabled={!isAvailable && !checkingPools}
                          >
                            <span className="text-xl font-bold mb-1">{tier.label}</span>
                            <span className="text-xs">{tier.description}</span>
                            {!checkingPools && !isAvailable && (
                              <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5">
                                No pool
                              </Badge>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    
                    {(!initialLoadComplete || checkingPools) && (
                      <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking available pools...
                      </p>
                    )}
                    
                    {initialLoadComplete && !checkingPools && Object.values(availableFees).filter(Boolean).length === 0 && Object.keys(availableFees).length > 0 && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">No pools exist for this token pair. Contact admin to create one first.</span>
                      </div>
                    )}
                    
                    {!checkingPools && Object.values(availableFees).filter(Boolean).length === 1 && (
                      <p className="text-yellow-500 text-sm mt-2">
                        Only {FEE_TIERS.find(t => availableFees[t.value])?.label} fee tier available for this pair
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">TVL</p>
                      <p className="font-semibold">--</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">24h Volume</p>
                      <p className="font-semibold">--</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Current Price</p>
                      <p className="font-semibold">
                        {currentPrice ? `${currentPrice.toFixed(6)} ${token1}/${token0}` : '--'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pool existence warning on Step 1 */}
                {initialLoadComplete && currentPrice === null && (
                  <Card className="glass-card p-4 mb-4 border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                      <p className="text-sm text-yellow-500">
                        Pool doesn't exist for {token0}/{token1} with {selectedFeeLabel} fee. Contact admin to create it first.
                      </p>
                    </div>
                  </Card>
                )}

                <Button 
                  className="w-full btn-primary" 
                  onClick={() => setStep(2)}
                  disabled={!initialLoadComplete || currentPrice === null}
                >
                  {!initialLoadComplete ? "Checking Pools..." : currentPrice === null ? "Pool Doesn't Exist" : "Continue"}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Set Price Range</h2>

                <div className="mb-6">
                  <Button 
                    className={`w-full mb-4 ${isFullRange ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setIsFullRange(!isFullRange)}
                  >
                    {isFullRange ? '✓ Full Range (Recommended)' : 'Full Range'}
                  </Button>

                  <div className="bg-muted/20 rounded-lg p-6 mb-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Current Price</p>
                      <p className="text-3xl font-bold">
                        {currentPrice ? `${currentPrice.toFixed(6)}` : '--'} {token1} per {token0}
                      </p>
                    </div>

                    <div className="h-32 bg-gradient-to-r from-primary/20 via-accent/30 to-primary/20 rounded-lg flex items-center justify-center mb-4">
                      <p className="text-muted-foreground">
                        {isFullRange ? 'Full Range Position' : 'Custom Range Position'}
                      </p>
                    </div>
                  </div>

                  {!isFullRange && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Min Price</label>
                        <Input 
                          placeholder="0.0000" 
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          className="glass-card border-primary/20" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Max Price</label>
                        <Input 
                          placeholder="∞" 
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          className="glass-card border-primary/20" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Card className="glass-card p-4 mb-6 border-primary/20">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {isFullRange 
                        ? "Full range positions earn fees at all prices but with lower capital efficiency."
                        : "Your liquidity will only earn fees when the price is within your selected range."
                      }
                    </p>
                  </div>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button className="flex-1 btn-primary" onClick={() => setStep(3)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Deposit Amounts</h2>

                <div className="space-y-4 mb-6">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={token0} size="sm" />
                        <span className="text-sm text-muted-foreground">{token0}</span>
                      </div>
                      <button 
                        onClick={() => handleAmount0Change(balance0)}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        Balance: {loadingBalances ? '...' : balance0} <span className="text-primary">MAX</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={amount0}
                        onChange={(e) => handleAmount0Change(e.target.value)}
                        className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                      />
                      <Button 
                        className="btn-secondary shrink-0"
                        onClick={() => handleAmount0Change(balance0)}
                      >
                        MAX
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={token1} size="sm" />
                        <span className="text-sm text-muted-foreground">{token1}</span>
                      </div>
                      <button 
                        onClick={() => handleAmount1Change(balance1)}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        Balance: {loadingBalances ? '...' : balance1} <span className="text-primary">MAX</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={amount1}
                        onChange={(e) => handleAmount1Change(e.target.value)}
                        className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                      />
                      <Button 
                        className="btn-secondary shrink-0"
                        onClick={() => handleAmount1Change(balance1)}
                      >
                        MAX
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Pool existence warning */}
                {currentPrice === null && (
                  <Card className="glass-card p-4 mb-4 border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                      <p className="text-sm text-yellow-500">
                        Pool doesn't exist for {token0}/{token1} with {selectedFeeLabel} fee. Contact admin to create it first.
                      </p>
                    </div>
                  </Card>
                )}

                <Card className="glass-card p-4 mb-6 border-warning/20 bg-warning/5">
                  <p className="text-sm text-warning">
                    ⚠️ For full range positions, you can deposit any ratio. For custom ranges, amounts are auto-calculated based on the price range.
                  </p>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button 
                    className="flex-1 btn-primary" 
                    onClick={() => setStep(4)}
                    disabled={currentPrice === null}
                  >
                    {currentPrice === null ? "Pool Doesn't Exist" : "Continue"}
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Preview & Confirm</h2>

                <div className="space-y-4 mb-6">
                  <div className="bg-muted/20 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Pool</p>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={token0} size="sm" />
                      <TokenIcon symbol={token1} size="sm" className="-ml-2" />
                      <p className="text-lg font-semibold">{token0}/{token1} ({selectedFeeLabel} Fee)</p>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Price Range</p>
                    <p className="text-lg font-semibold">
                      {isFullRange ? 'Full Range' : `${minPrice || '0'} - ${maxPrice || '∞'}`}
                    </p>
                  </div>

                  <div className="bg-muted/20 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">Depositing</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={token0} size="sm" />
                        <p className="font-semibold">{amount0 || '0.00'} {token0}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={token1} size="sm" />
                        <p className="font-semibold">{amount1 || '0.00'} {token1}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
                      <span className="font-bold">{slippage}%</span>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">You will receive</p>
                    <p className="text-lg font-semibold">Position NFT (ERC-721)</p>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                )}

                {/* Transaction Status */}
                {status === 'approving' && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Please approve token spending in your wallet...
                    </p>
                  </div>
                )}

                {status === 'adding' && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Confirm the transaction to add liquidity...
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button 
                    className="flex-1 btn-primary"
                    onClick={handleAddLiquidity}
                    disabled={isButtonDisabled()}
                  >
                    {(status === 'approving' || status === 'adding') && (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    )}
                    {getButtonText()}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConnectWalletModal open={showWalletModal} onOpenChange={setShowWalletModal} />
    </SpaceBackground>
  );
};

export default AddLiquidity;
