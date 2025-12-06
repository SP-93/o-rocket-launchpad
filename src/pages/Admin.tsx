import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { isAdmin, ADMIN_WALLET, TOKEN_ADDRESSES, PROTOCOL_FEE_CONFIG } from '@/config/admin';
import { DEPLOYMENT_STEPS, INITIAL_POOLS, FEE_TIER_CONFIG } from '@/contracts/deployment/config';
import SpaceBackground from '@/components/backgrounds/SpaceBackground';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Shield, Rocket, Database, Settings, BarChart3, Wallet, AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Admin = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const isAdminWallet = isAdmin(address);

  // Redirect non-admin users
  useEffect(() => {
    if (!isConnected || !isAdminWallet) {
      toast.error('Access denied. Admin wallet required.');
      navigate('/');
    }
  }, [isConnected, isAdminWallet, navigate]);

  if (!isConnected || !isAdminWallet) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleDeploy = (contractId: string) => {
    toast.info(`Preparing ${contractId} deployment... (Manual signing required)`);
    // TODO: Implement actual deployment logic
  };

  return (
    <div className="min-h-screen relative">
      <SpaceBackground>
        <div /></SpaceBackground>
      
      <main className="relative z-10 pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-10 h-10 text-warning" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">Admin Panel</h1>
              <p className="text-muted-foreground">Contract deployment & protocol management</p>
            </div>
          </div>

          {/* Admin Wallet Info */}
          <GlowCard className="p-4 mb-8" glowColor="purple">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-warning" />
                <span className="text-sm text-muted-foreground">Admin Wallet:</span>
                <code className="text-sm font-mono text-foreground">{ADMIN_WALLET}</code>
                <button onClick={() => copyToClipboard(ADMIN_WALLET)} className="text-muted-foreground hover:text-primary">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <a 
                href={`https://www.overscan.net/address/${ADMIN_WALLET}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-sm"
              >
                View on Explorer <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </GlowCard>

          <Tabs defaultValue="deploy" className="space-y-6">
            <TabsList className="glass-card p-1 w-full md:w-auto">
              <TabsTrigger value="deploy" className="flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Deploy Contracts
              </TabsTrigger>
              <TabsTrigger value="pools" className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Create Pools
              </TabsTrigger>
              <TabsTrigger value="treasury" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Treasury
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </TabsTrigger>
            </TabsList>

            {/* Deploy Contracts Tab */}
            <TabsContent value="deploy" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Contract Deployment
                </h2>
                <p className="text-muted-foreground mb-6">
                  Deploy Uniswap V3 contracts to OverProtocol Mainnet. Each step requires manual transaction signing.
                </p>

                <div className="space-y-4">
                  {DEPLOYMENT_STEPS.map((step, index) => (
                    <div key={step.id} className="bg-background/50 rounded-xl p-4 border border-primary/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center">
                              {index + 1}
                            </span>
                            <h3 className="font-semibold text-foreground">{step.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground ml-8">{step.description}</p>
                          {step.dependencies.length > 0 && (
                            <p className="text-xs text-warning ml-8 mt-1">
                              Requires: {step.dependencies.join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground ml-8 mt-1">
                            Est. Gas: {parseInt(step.estimatedGas).toLocaleString()}
                          </p>
                        </div>
                        <NeonButton 
                          onClick={() => handleDeploy(step.id)}
                          variant="primary"
                          className="text-sm px-4 py-2"
                        >
                          Deploy
                        </NeonButton>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>

              {/* Token Addresses Reference */}
              <GlowCard className="p-6">
                <h3 className="font-semibold mb-4">Token Addresses (OverProtocol Mainnet)</h3>
                <div className="space-y-2">
                  {Object.entries(TOKEN_ADDRESSES).map(([symbol, address]) => (
                    <div key={symbol} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                      <span className="font-medium">{symbol}</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground">{address}</code>
                        <button onClick={() => copyToClipboard(address)} className="text-muted-foreground hover:text-primary">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </TabsContent>

            {/* Create Pools Tab */}
            <TabsContent value="pools" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Initial Pool Creation
                </h2>
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Pools can only be created after Factory contract is deployed.
                  </p>
                </div>

                <div className="space-y-4">
                  {INITIAL_POOLS.map((pool) => (
                    <div key={pool.name} className="bg-background/50 rounded-xl p-4 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{pool.name}</h3>
                          <p className="text-sm text-muted-foreground">{pool.description}</p>
                          <p className="text-xs text-primary mt-1">
                            Fee: {FEE_TIER_CONFIG[pool.fee]?.label || `${pool.fee / 10000}%`}
                          </p>
                        </div>
                        <NeonButton variant="secondary" className="text-sm px-4 py-2" disabled>
                          Create Pool
                        </NeonButton>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </TabsContent>

            {/* Treasury Tab */}
            <TabsContent value="treasury" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Protocol Treasury
                </h2>
                <p className="text-muted-foreground mb-6">
                  View and manage protocol fees. Fees are stored in original tokens and never auto-converted.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">LP Share</p>
                    <p className="text-2xl font-bold gradient-text">{PROTOCOL_FEE_CONFIG.lpShare}%</p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Protocol Share</p>
                    <p className="text-2xl font-bold text-warning">{PROTOCOL_FEE_CONFIG.protocolShare}%</p>
                  </div>
                </div>

                <div className="text-center text-muted-foreground py-8">
                  Treasury balances will appear after contracts are deployed
                </div>
              </GlowCard>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <GlowCard className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Platform Settings
                </h2>
                
                <div className="space-y-4">
                  <div className="bg-background/50 rounded-xl p-4 border border-primary/20">
                    <h3 className="font-semibold mb-2">Fee Distribution</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how trading fees are split between LPs and protocol treasury.
                    </p>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">LP Share (%)</label>
                        <input 
                          type="number" 
                          value={PROTOCOL_FEE_CONFIG.lpShare} 
                          disabled
                          className="w-full mt-1 input-modern"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Protocol Share (%)</label>
                        <input 
                          type="number" 
                          value={PROTOCOL_FEE_CONFIG.protocolShare} 
                          disabled
                          className="w-full mt-1 input-modern"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                    <h3 className="font-semibold text-destructive mb-2">Emergency Controls</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Circuit breaker and pause functionality (available after deployment)
                    </p>
                    <NeonButton variant="secondary" className="text-sm px-4 py-2" disabled>
                      Pause Trading
                    </NeonButton>
                  </div>
                </div>
              </GlowCard>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
