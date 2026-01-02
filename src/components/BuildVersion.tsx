import { useState, useEffect } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Build version is set at build time via vite.config.ts define
declare const __BUILD_TIME__: string;
const BUILD_DATE = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';

interface BuildVersionProps {
  className?: string;
  showUpdatePrompt?: boolean;
  showHardRefresh?: boolean;
}

export const BuildVersion = ({ 
  className = '', 
  showUpdatePrompt = true,
  showHardRefresh = false 
}: BuildVersionProps) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!showUpdatePrompt) return;
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                toast.info('New version available! Click to refresh.', {
                  action: {
                    label: 'Refresh',
                    onClick: () => handleHardRefresh(),
                  },
                  duration: 10000,
                });
              }
            });
          }
        });
      });
    }
  }, [showUpdatePrompt]);

  const handleHardRefresh = async () => {
    toast.info('Clearing cache and refreshing...');
    
    try {
      // Clear all caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
        console.log('[BuildVersion] Cleared caches:', names);
      }
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log('[BuildVersion] Unregistered service workers:', registrations.length);
      }
      
      // Force reload from server
      window.location.reload();
    } catch (error) {
      console.error('[BuildVersion] Hard refresh error:', error);
      window.location.reload();
    }
  };

  return (
    <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${className}`}>
      <span>Build: {BUILD_DATE}</span>
      
      {updateAvailable && (
        <button 
          onClick={handleHardRefresh}
          className="flex items-center gap-1 text-primary hover:text-primary/80 animate-pulse"
        >
          <RefreshCw className="w-3 h-3" />
          Update
        </button>
      )}
      
      {showHardRefresh && !updateAvailable && (
        <button 
          onClick={handleHardRefresh}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          title="Force refresh (clear cache)"
        >
          <Zap className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default BuildVersion;
