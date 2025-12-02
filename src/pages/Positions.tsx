import { Button } from "@/components/ui/button";
import { TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Positions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">My Positions</h1>
            <p className="text-muted-foreground">Manage your liquidity positions</p>
          </div>
          <Button className="btn-primary" onClick={() => navigate("/add-liquidity")}>
            <Plus className="w-4 h-4 mr-2" />
            New Position
          </Button>
        </div>

        {/* Empty State */}
        <div className="glass-card p-12 text-center">
          <div className="inline-block p-6 rounded-full bg-primary/10 mb-6">
            <TrendingUp className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">No Active Positions</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Connect your wallet to view your liquidity positions or create a new position to start earning fees.
          </p>
          <div className="flex gap-4 justify-center">
            <Button className="btn-primary">
              Connect Wallet
            </Button>
            <Button className="btn-secondary" onClick={() => navigate("/add-liquidity")}>
              Create Position
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Positions;
