import { useState } from "react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Rocket, Wallet, Menu, X, ChevronDown, Shield } from "lucide-react";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { useWallet } from "@/hooks/useWallet";
import { isAdmin } from "@/config/admin";

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { address, balance, isConnected, isCorrectNetwork } = useWallet();

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const isAdminWallet = isAdmin(address);

  const navLinks = [
    { to: "/swap", label: "Swap" },
    { to: "/pools", label: "Pools" },
    { to: "/positions", label: "Positions" },
    { to: "/info", label: "Info" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-primary/20 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold hover:scale-105 transition-transform">
              <Rocket className="w-6 h-6 md:w-8 md:h-8 text-primary glow-effect animate-float" />
              <span className="gradient-text">O'ROCKET</span>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="text-muted-foreground hover:text-primary transition-colors font-medium"
                  activeClassName="text-primary font-semibold"
                >
                  {link.label}
                </NavLink>
              ))}
              {/* Admin Link - only visible to admin wallet */}
              {isAdminWallet && (
                <NavLink
                  to="/admin"
                  className="text-warning hover:text-warning/80 transition-colors font-medium flex items-center gap-1"
                  activeClassName="text-warning font-semibold"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </NavLink>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isConnected && address ? (
                <Button 
                  onClick={() => setWalletModalOpen(true)}
                  className={`text-sm md:text-base ${isCorrectNetwork ? 'btn-primary' : 'bg-warning/20 border-warning/50 text-warning hover:bg-warning/30'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-success' : 'bg-warning'} animate-pulse`} />
                    <span className="hidden sm:inline">{truncateAddress(address)}</span>
                    <span className="sm:hidden">{address.slice(0, 4)}...</span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </Button>
              ) : (
                <Button 
                  onClick={() => setWalletModalOpen(true)}
                  className="btn-primary text-sm md:text-base"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Connect Wallet</span>
                  <span className="sm:hidden">Connect</span>
                </Button>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Slide-in */}
      <div 
        className={`fixed top-[73px] right-0 h-[calc(100vh-73px)] w-64 bg-card/95 backdrop-blur-xl border-l border-primary/20 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col p-6 gap-4">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="text-lg text-muted-foreground hover:text-primary transition-colors font-medium py-3 px-4 rounded-lg hover:bg-primary/10"
              activeClassName="text-primary font-semibold bg-primary/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          {/* Admin Link for mobile - only visible to admin wallet */}
          {isAdminWallet && (
            <NavLink
              to="/admin"
              className="text-lg text-warning hover:text-warning/80 transition-colors font-medium py-3 px-4 rounded-lg hover:bg-warning/10 flex items-center gap-2"
              activeClassName="text-warning font-semibold bg-warning/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Shield className="w-5 h-5" />
              Admin Panel
            </NavLink>
          )}
        </div>
      </div>

      <ConnectWalletModal 
        open={walletModalOpen} 
        onOpenChange={setWalletModalOpen} 
      />
    </>
  );
};

export default Navigation;
