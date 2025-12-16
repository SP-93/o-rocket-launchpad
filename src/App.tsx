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
import Info from "./pages/Info";
import Admin from "./pages/Admin";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

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
            <Route path="/info" element={<Info />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
