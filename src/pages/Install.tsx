import { useState, useEffect } from 'react';
import { Rocket, Download, Smartphone, Monitor, Apple, QrCode, Share, Plus, MoreVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlowCard from '@/components/ui/GlowCard';
import SpaceBackground from '@/components/backgrounds/SpaceBackground';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const isMobileDevice = isIOSDevice || isAndroidDevice;
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsMobile(isMobileDevice);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capture install prompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
  };

  return (
    <SpaceBackground>
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 mb-6">
              <Rocket className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-4">
              Install O'Rocket
            </h1>
            <p className="text-muted-foreground text-lg">
              Add O'Rocket to your home screen for the best experience
            </p>
          </div>

          {/* Already Installed */}
          {isInstalled && (
            <GlowCard glowColor="cyan" className="mb-8">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">App Installed!</h2>
                <p className="text-muted-foreground">
                  O'Rocket is installed on your device. Open it from your home screen.
                </p>
              </div>
            </GlowCard>
          )}

          {/* Install Button (Android/Chrome) */}
          {deferredPrompt && !isInstalled && (
            <GlowCard glowColor="cyan" className="mb-8">
              <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-foreground mb-4">Quick Install</h2>
                <Button onClick={handleInstall} size="lg" className="btn-primary">
                  <Download className="w-5 h-5 mr-2" />
                  Install O'Rocket
                </Button>
              </div>
            </GlowCard>
          )}

          {/* iOS Instructions */}
          {isIOS && !isInstalled && (
            <GlowCard glowColor="cyan" className="mb-8">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Apple className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Install on iPhone/iPad</h2>
                </div>
                
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</span>
                    <div>
                      <p className="font-medium text-foreground">Tap the Share button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Look for <Share className="w-4 h-4" /> at the bottom of Safari
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</span>
                    <div>
                      <p className="font-medium text-foreground">Scroll down and tap "Add to Home Screen"</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Look for <Plus className="w-4 h-4 border border-current rounded" /> icon
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</span>
                    <div>
                      <p className="font-medium text-foreground">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground">O'Rocket will appear on your home screen</p>
                    </div>
                  </li>
                </ol>
              </div>
            </GlowCard>
          )}

          {/* Android Instructions (when no prompt) */}
          {isAndroid && !deferredPrompt && !isInstalled && (
            <GlowCard glowColor="cyan" className="mb-8">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Smartphone className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Install on Android</h2>
                </div>
                
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</span>
                    <div>
                      <p className="font-medium text-foreground">Tap the menu button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Look for <MoreVertical className="w-4 h-4" /> at the top right
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</span>
                    <div>
                      <p className="font-medium text-foreground">Tap "Install app" or "Add to Home screen"</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</span>
                    <div>
                      <p className="font-medium text-foreground">Confirm the installation</p>
                      <p className="text-sm text-muted-foreground">O'Rocket will appear on your home screen</p>
                    </div>
                  </li>
                </ol>
              </div>
            </GlowCard>
          )}

          {/* Desktop Instructions */}
          {!isMobile && !isInstalled && (
            <GlowCard glowColor="purple" className="mb-8">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Install on Desktop</h2>
                </div>
                
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</span>
                    <div>
                      <p className="font-medium text-foreground">Look for the install icon in your browser's address bar</p>
                      <p className="text-sm text-muted-foreground">Usually a "+" or computer icon on the right side</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</span>
                    <div>
                      <p className="font-medium text-foreground">Click "Install"</p>
                      <p className="text-sm text-muted-foreground">O'Rocket will open as a standalone app</p>
                    </div>
                  </li>
                </ol>
              </div>
            </GlowCard>
          )}

          {/* Benefits */}
          <GlowCard className="mb-8">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Why install?</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  <span>Quick access from home screen</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  <span>Full-screen experience without browser UI</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  <span>Faster loading with cached assets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  <span>Works offline for viewing positions</span>
                </li>
              </ul>
            </div>
          </GlowCard>

          {/* QR Code for sharing */}
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-2">Share with friends</p>
            <Button variant="outline" onClick={copyUrl} className="border-primary/30">
              <QrCode className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Install;
