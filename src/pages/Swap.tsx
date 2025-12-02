import { useState } from "react";
import { ArrowDownUp, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const Swap = () => {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Swap Tokens</h1>
          <p className="text-muted-foreground">Trade tokens instantly on OverProtocol</p>
        </div>

        <Card className="glass-card p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Swap</h2>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* From Token */}
          <div className="mb-2">
            <div className="bg-muted/20 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="text-sm text-muted-foreground">Balance: 0.00</span>
              </div>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                />
                <Button className="btn-secondary shrink-0 px-4">
                  USDT
                </Button>
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-3 relative z-10">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-card border-2 border-primary/20 hover:bg-card hover:border-primary/40 transition-all"
            >
              <ArrowDownUp className="w-5 h-5 text-primary" />
            </Button>
          </div>

          {/* To Token */}
          <div className="mb-6">
            <div className="bg-muted/20 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm text-muted-foreground">Balance: 0.00</span>
              </div>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0"
                />
                <Button className="btn-secondary shrink-0 px-4">
                  USDC
                </Button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-2 mb-6 text-sm">
            <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">1 USDT = 0.9998 USDC</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
              <span className="text-muted-foreground">Price Impact</span>
              <span className="font-medium text-success">{'<0.01%'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
              <span className="text-muted-foreground">Liquidity Provider Fee</span>
              <span className="font-medium">0.3%</span>
            </div>
          </div>

          <Button className="w-full btn-primary text-lg">
            Connect Wallet
          </Button>
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
  );
};

export default Swap;
