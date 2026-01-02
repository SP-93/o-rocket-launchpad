import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Build version is set at build time
const BUILD_DATE = new Date().toISOString().slice(0, 16).replace('T', ' ');

interface BuildVersionProps {
  className?: string;
  showUpdatePrompt?: boolean;
}

export const BuildVersion = ({ className = '', showUpdatePrompt = true }: BuildVersionProps) => {
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
                    onClick: () => window.location.reload(),
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

  const handleRefresh = () => {
    // Clear caches and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return (
    <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${className}`}>
      <span>Build: {BUILD_DATE}</span>
      {updateAvailable && (
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-1 text-primary hover:text-primary/80 animate-pulse"
        >
          <RefreshCw className="w-3 h-3" />
          Update
        </button>
      )}
    </div>
  );
};

export default BuildVersion;
