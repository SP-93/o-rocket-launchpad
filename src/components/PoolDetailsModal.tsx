import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TokenPairIcon } from "@/components/TokenIcon";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Contract addresses for OverProtocol Mainnet
const TOKEN_ADDRESSES: Record<string, string> = {
  WOVER: "0x0000000000000000000000000000000000000001",
  USDT: "0x46B2Eb58d382267D70DfFaBF51D6Ec68510a6Ca8",
  USDC: "0x46B2Eb58d382267D70DfFaBF51D6Ec68510a6Ca7", // Placeholder
};

interface PoolDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: {
    pair: string;
    token0: string;
    token1: string;
    fee: string;
    feeValue: number;
    type: string;
    description: string;
  } | null;
  tvlData: {
    token0Balance: string;
    token1Balance: string;
    tvlUSD: number;
  } | null;
  poolAddress?: string;
  currentPrice?: number;
}

export const PoolDetailsModal = ({
  open,
  onOpenChange,
  pool,
  tvlData,
  poolAddress,
  currentPrice,
}: PoolDetailsModalProps) => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  if (!pool) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatTVL = (tvl: number): string => {
    if (tvl >= 1000000) return `$${(tvl / 1000000).toFixed(2)}M`;
    if (tvl >= 1000) return `$${(tvl / 1000).toFixed(2)}K`;
    if (tvl > 0) return `$${tvl.toFixed(2)}`;
    return "$0.00";
  };

  const token0Address = TOKEN_ADDRESSES[pool.token0] || "Unknown";
  const token1Address = TOKEN_ADDRESSES[pool.token1] || "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <TokenPairIcon token0={pool.token0} token1={pool.token1} size="md" />
            <span>{pool.pair} Pool</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pool Type & Fee */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {pool.type}
            </span>
            <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {pool.fee} Fee
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{pool.description}</p>

          {/* Pool Address */}
          {poolAddress && (
            <div className="glass-card rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Pool Address</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-foreground">
                  {formatAddress(poolAddress)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(poolAddress, "Pool")}
                  >
                    {copiedAddress === "Pool" ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    asChild
                  >
                    <a
                      href={`https://scan.over.network/address/${poolAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Token Addresses */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Token Addresses</p>
            
            <div className="glass-card rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{pool.token0}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatAddress(token0Address)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(token0Address, pool.token0)}
                  >
                    {copiedAddress === pool.token0 ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{pool.token1}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatAddress(token1Address)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(token1Address, pool.token1)}
                  >
                    {copiedAddress === pool.token1 ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* TVL & Reserves */}
          {tvlData && (
            <div className="glass-card rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Total Value Locked</p>
              <p className="text-2xl font-bold text-primary mb-2">
                {formatTVL(tvlData.tvlUSD)}
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{tvlData.token0Balance} {pool.token0}</p>
                <p>{tvlData.token1Balance} {pool.token1}</p>
              </div>
            </div>
          )}

          {/* Current Price */}
          {currentPrice !== undefined && currentPrice > 0 && (
            <div className="glass-card rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Price</p>
              <p className="text-lg font-semibold text-foreground">
                1 {pool.token0} = {currentPrice.toFixed(6)} {pool.token1}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
