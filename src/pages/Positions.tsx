import { Button } from "@/components/ui/button";
import { TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";

const Positions = () => {
  const navigate = useNavigate();

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">My Positions</h1>
              <p className="text-muted-foreground text-sm md:text-base">Manage your liquidity positions</p>
            </div>
            <Button className="btn-primary w-full md:w-auto" onClick={() => navigate("/add-liquidity")}>
              <Plus className="w-4 h-4 mr-2" />
              New Position
            </Button>
          </div>

          {/* Empty State */}
          <GlowCard className="p-8 md:p-12 text-center">
            <div className="inline-block p-6 rounded-full bg-primary/10 mb-6 border border-primary/20">
              <TrendingUp className="w-10 h-10 md:w-12 md:h-12 text-primary" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-4">No Active Positions</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm md:text-base">
              Connect your wallet to view your liquidity positions or create a new position to start earning fees.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="btn-primary">
                Connect Wallet
              </Button>
              <Button className="btn-secondary" onClick={() => navigate("/add-liquidity")}>
                Create Position
              </Button>
            </div>
          </GlowCard>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Positions;
