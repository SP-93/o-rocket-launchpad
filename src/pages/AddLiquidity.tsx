import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AddLiquidity = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  return (
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
          <h1 className="text-4xl font-bold mb-2 gradient-text">Add Liquidity</h1>
          <p className="text-muted-foreground">Create a new liquidity position</p>
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
                {num}
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
                    <Button className="btn-secondary h-14 text-lg">USDT</Button>
                    <Button className="btn-secondary h-14 text-lg">USDC</Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fee Tier</label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" className="h-20 flex flex-col border-primary/30">
                      <span className="text-xl font-bold mb-1">0.05%</span>
                      <span className="text-xs text-muted-foreground">Stable pairs</span>
                    </Button>
                    <Button className="h-20 flex flex-col bg-gradient-to-r from-primary to-accent">
                      <span className="text-xl font-bold mb-1">0.3%</span>
                      <span className="text-xs">Standard (Best)</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col border-primary/30">
                      <span className="text-xl font-bold mb-1">1%</span>
                      <span className="text-xs text-muted-foreground">Volatile pairs</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-muted/20 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">TVL</p>
                    <p className="font-semibold">$1.2M</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">24h Volume</p>
                    <p className="font-semibold">$280K</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Current Price</p>
                    <p className="font-semibold">1.0002</p>
                  </div>
                </div>
              </div>

              <Button className="w-full btn-primary" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Set Price Range</h2>

              <div className="mb-6">
                <Button className="w-full btn-secondary mb-4">
                  Full Range (Recommended)
                </Button>

                <div className="bg-muted/20 rounded-lg p-6 mb-4">
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground mb-2">Current Price</p>
                    <p className="text-3xl font-bold">1.0002 USDC per USDT</p>
                  </div>

                  <div className="h-32 bg-gradient-to-r from-primary/20 via-accent/30 to-primary/20 rounded-lg flex items-center justify-center mb-4">
                    <p className="text-muted-foreground">Price Range Visualization</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Min Price</label>
                    <Input placeholder="0.0000" className="glass-card border-primary/20" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Price</label>
                    <Input placeholder="∞" className="glass-card border-primary/20" />
                  </div>
                </div>
              </div>

              <Card className="glass-card p-4 mb-6 border-primary/20">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Your liquidity will only earn fees when the price is within your selected range.
                    Full range positions earn fees at all prices but with lower capital efficiency.
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
                    <span className="text-sm text-muted-foreground">USDT</span>
                    <span className="text-sm text-muted-foreground">Balance: 0.00</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      placeholder="0.0"
                      className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                    />
                    <Button className="btn-secondary shrink-0">MAX</Button>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">USDC</span>
                    <span className="text-sm text-muted-foreground">Balance: 0.00</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      placeholder="0.0"
                      className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                    />
                    <Button className="btn-secondary shrink-0">MAX</Button>
                  </div>
                </div>
              </div>

              <Card className="glass-card p-4 mb-6 border-warning/20 bg-warning/5">
                <p className="text-sm text-warning">
                  ⚠️ Amounts are auto-calculated based on your selected price range and current pool ratio.
                </p>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button className="flex-1 btn-primary" onClick={() => setStep(4)}>
                  Continue
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
                  <p className="text-lg font-semibold">USDT/USDC (0.3% Fee)</p>
                </div>

                <div className="bg-muted/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Price Range</p>
                  <p className="text-lg font-semibold">Full Range</p>
                </div>

                <div className="bg-muted/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Depositing</p>
                  <div className="space-y-1">
                    <p className="font-semibold">1,000 USDT</p>
                    <p className="font-semibold">1,000 USDC</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated APR</span>
                    <span className="text-2xl font-bold text-success">12.5%</span>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">You will receive</p>
                  <p className="text-lg font-semibold">Position NFT #12345</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button className="flex-1 btn-primary">
                  Add Liquidity
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AddLiquidity;
