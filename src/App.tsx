import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./hooks/useWallet";
import Navigation from "./components/Navigation";
import Index from "./pages/Index";
import Swap from "./pages/Swap";
import Pools from "./pages/Pools";
import AddLiquidity from "./pages/AddLiquidity";
import Positions from "./pages/Positions";
import Game from "./pages/Game";
import Games from "./pages/Games";
import Info from "./pages/Info";
import Docs from "./pages/Docs";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { initializeSecurity } from "./lib/securityInit";

// Initialize security checks on app load
if (typeof window !== 'undefined') {
  const securityStatus = initializeSecurity();
  if (!securityStatus.isSecure && import.meta.env.DEV) {
    console.warn('Security issues detected:', securityStatus.issues);
  }
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Navigation />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/swap" element={<Swap />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/add-liquidity" element={<AddLiquidity />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/games" element={<Games />} />
            <Route path="/game" element={<Game />} />
            <Route path="/info" element={<Info />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
