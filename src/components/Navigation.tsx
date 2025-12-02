import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Rocket, Wallet } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-primary/20 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-2xl font-bold hover:scale-105 transition-transform">
            <Rocket className="w-8 h-8 text-primary glow-effect animate-float" />
            <span className="gradient-text">O'ROCKET</span>
          </NavLink>

          <div className="hidden md:flex items-center gap-8">
            <NavLink
              to="/swap"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
              activeClassName="text-primary font-semibold"
            >
              Swap
            </NavLink>
            <NavLink
              to="/pools"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
              activeClassName="text-primary font-semibold"
            >
              Pools
            </NavLink>
            <NavLink
              to="/positions"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
              activeClassName="text-primary font-semibold"
            >
              Positions
            </NavLink>
            <NavLink
              to="/info"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
              activeClassName="text-primary font-semibold"
            >
              Info
            </NavLink>
          </div>

          <Button className="btn-primary">
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
