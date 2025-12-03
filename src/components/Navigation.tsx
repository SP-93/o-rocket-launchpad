import { useState } from "react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Rocket, Wallet, Menu, X } from "lucide-react";

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            </div>

            <div className="flex items-center gap-3">
              <Button className="btn-primary text-sm md:text-base">
                <Wallet className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </Button>

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
        </div>
      </div>
    </>
  );
};

export default Navigation;
