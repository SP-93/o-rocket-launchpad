import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import { useWalletLink } from '@/hooks/useWalletLink';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Shield, Wallet, Link2, Unlink, CheckCircle, AlertTriangle, 
  Loader2, Mail, Lock, Eye, EyeOff, LogOut, User
} from 'lucide-react';
import { toast } from 'sonner';

const WalletLinkSection = () => {
  const { address, isConnected } = useWallet();
  const { 
    linkedWallets, 
    isLoading, 
    isLinking, 
    error, 
    isCurrentWalletLinked, 
    linkCurrentWallet, 
    unlinkWallet 
  } = useWalletLink();

  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully');
        setShowAuth(false);
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        toast.success('Account created! Check email for confirmation.');
        setShowAuth(false);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
  };

  const handleLinkWallet = async () => {
    const success = await linkCurrentWallet();
    if (success) {
      toast.success('Wallet linked successfully!');
    } else if (error) {
      toast.error(error);
    }
  };

  const handleUnlinkWallet = async (walletAddress: string) => {
    if (confirm('Are you sure you want to unlink this wallet?')) {
      const success = await unlinkWallet(walletAddress);
      if (success) {
        toast.success('Wallet unlinked');
      }
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isAuthLoading) {
    return (
      <GlowCard className="p-6" glowColor="purple">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auth Section */}
      <GlowCard className="p-6" glowColor="purple">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-warning" />
          <h3 className="text-lg font-semibold">Enhanced Security</h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Link your wallet to a Supabase account for additional security verification.
          This creates a cryptographic proof that you own this wallet.
        </p>

        {!user ? (
          <div className="space-y-4">
            {!showAuth ? (
              <div className="flex gap-3">
                <NeonButton onClick={() => { setShowAuth(true); setIsLogin(true); }}>
                  <User className="w-4 h-4 mr-2" />
                  Login
                </NeonButton>
                <NeonButton variant="secondary" onClick={() => { setShowAuth(true); setIsLogin(false); }}>
                  Create Account
                </NeonButton>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4 max-w-sm">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="admin@example.com"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {isLogin ? 'Login' : 'Sign Up'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowAuth(false)}>
                    Cancel
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-primary hover:underline"
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-medium">Logged in as</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </GlowCard>

      {/* Wallet Linking Section - Only show if logged in */}
      {user && (
        <GlowCard className="p-6" glowColor="cyan">
          <div className="flex items-center gap-3 mb-4">
            <Link2 className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-semibold">Wallet Linking</h3>
          </div>

          {/* Current Wallet */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">Current Connected Wallet</p>
            {isConnected && address ? (
              <div className="flex items-center justify-between bg-background/50 border border-border/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <code className="text-sm font-mono">{truncateAddress(address)}</code>
                  {isCurrentWalletLinked && (
                    <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                      Linked
                    </span>
                  )}
                </div>
                {!isCurrentWalletLinked ? (
                  <NeonButton 
                    onClick={handleLinkWallet}
                    disabled={isLinking}
                    className="text-xs px-3 py-1.5"
                  >
                    {isLinking ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4 mr-1" />
                    )}
                    Link Wallet
                  </NeonButton>
                ) : (
                  <span className="text-xs text-success flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Connect your wallet first</span>
              </div>
            )}
          </div>

          {/* Linked Wallets List */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Linked Wallets ({linkedWallets.length})
            </p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : linkedWallets.length > 0 ? (
              <div className="space-y-2">
                {linkedWallets.map((wallet) => (
                  <div 
                    key={wallet.id}
                    className="flex items-center justify-between bg-background/30 border border-border/20 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <code className="text-sm font-mono">{truncateAddress(wallet.wallet_address)}</code>
                        <p className="text-xs text-muted-foreground">
                          Linked: {new Date(wallet.verified_at || wallet.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkWallet(wallet.wallet_address)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No wallets linked yet
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </GlowCard>
      )}

      {/* Info Box */}
      <GlowCard className="p-4 bg-primary/5" glowColor="cyan">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Why link your wallet?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adds cryptographic proof of wallet ownership</li>
              <li>Extra security layer beyond hardcoded addresses</li>
              <li>Enables future role-based permissions</li>
              <li>Required for sensitive operations</li>
            </ul>
          </div>
        </div>
      </GlowCard>
    </div>
  );
};

export default WalletLinkSection;