// Swap Confirmation Dialog - za visoko-rizične swapove
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";
import { SwapRiskAssessment } from "@/lib/oracleProtection";

interface SwapConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  risk: SwapRiskAssessment;
  fromAmount: string;
  fromToken: string;
  toAmount: string;
  toToken: string;
}

export const SwapConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  risk,
  fromAmount,
  fromToken,
  toAmount,
  toToken,
}: SwapConfirmationDialogProps) => {
  const isBlocked = risk.level === 'blocked';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-red-500/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-500">
            <ShieldAlert className="h-5 w-5" />
            {isBlocked ? 'Swap Blocked' : 'High Risk Swap'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="text-foreground">
              {risk.message}
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You pay:</span>
                <span className="font-medium">{fromAmount} {fromToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You receive:</span>
                <span className="font-medium">{toAmount} {toToken}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Price Impact:</span>
                <span className="font-medium text-red-500">
                  -{risk.priceImpact.toFixed(2)}%
                </span>
              </div>
            </div>

            {isBlocked ? (
              <p className="text-sm text-muted-foreground">
                This swap has been blocked for your protection. Try splitting into smaller amounts.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Are you sure you want to proceed with this swap? You may lose a significant portion of your funds due to low liquidity.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!isBlocked && (
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              I understand, proceed anyway
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
