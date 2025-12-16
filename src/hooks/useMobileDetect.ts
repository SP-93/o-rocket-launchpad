import { useState, useEffect } from 'react';

interface MobileDetectResult {
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isInAppBrowser: boolean;
  isMetaMaskBrowser: boolean;
  isOverWalletBrowser: boolean;
  isTrustWallet: boolean;
  isCoinbaseWallet: boolean;
}

export const useMobileDetect = (): MobileDetectResult => {
  const [result, setResult] = useState<MobileDetectResult>({
    isMobile: false,
    isAndroid: false,
    isIOS: false,
    isInAppBrowser: false,
    isMetaMaskBrowser: false,
    isOverWalletBrowser: false,
    isTrustWallet: false,
    isCoinbaseWallet: false,
  });

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isMobile = isAndroid || isIOS || /webOS|BlackBerry|Opera Mini|IEMobile/i.test(userAgent);
    
    // Check for various in-app browsers
    const isMetaMaskBrowser = /MetaMask/i.test(userAgent) || !!(window as any).ethereum?.isMetaMask;
    // Check for OverWallet / Over Flex Wallet - multiple detection methods
    const isOverWalletBrowser = 
      /OverWallet|OverFlex|Over Flex/i.test(userAgent) || 
      !!(window as any).ethereum?.isOverWallet ||
      !!(window as any).overwallet ||
      !!(window as any).ethereum?.isOver;
    const isTrustWallet = /Trust/i.test(userAgent) || !!(window as any).ethereum?.isTrust;
    const isCoinbaseWallet = /CoinbaseWallet/i.test(userAgent) || !!(window as any).ethereum?.isCoinbaseWallet;
    
    const isInAppBrowser = isMetaMaskBrowser || isOverWalletBrowser || isTrustWallet || isCoinbaseWallet;

    setResult({
      isMobile,
      isAndroid,
      isIOS,
      isInAppBrowser,
      isMetaMaskBrowser,
      isOverWalletBrowser,
      isTrustWallet,
      isCoinbaseWallet,
    });
  }, []);

  return result;
};

// Get current dApp URL for deep links
const getDappUrl = (): string => {
  // Remove protocol for MetaMask deep links
  return window.location.host + window.location.pathname + window.location.search;
};

const getFullUrl = (): string => {
  return window.location.href;
};

// Detect OS for appropriate deep link format
export const detectOS = (): 'android' | 'ios' | 'unknown' => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
  return 'unknown';
};

// MetaMask Deep Link - OS-specific formats
export const getMetaMaskDeepLink = (): string => {
  const os = detectOS();
  const dappUrl = getDappUrl();
  
  if (os === 'android') {
    // Android: Use intent:// format which is more reliable
    return `intent://dapp/${dappUrl}#Intent;scheme=metamask;package=io.metamask;end`;
  } else if (os === 'ios') {
    // iOS: Use universal link format
    return `https://metamask.app.link/dapp/${dappUrl}`;
  }
  
  // Fallback to universal link
  return `https://metamask.app.link/dapp/${dappUrl}`;
};

// Alternative MetaMask link if primary fails
export const getMetaMaskFallbackLink = (): string => {
  const dappUrl = getDappUrl();
  return `metamask://dapp/${dappUrl}`;
};

// OverWallet / Over Flex Wallet Deep Link
export const getOverWalletDeepLink = (): string => {
  const fullUrl = encodeURIComponent(getFullUrl());
  const os = detectOS();
  
  // Try multiple formats for Over Flex Wallet
  if (os === 'android') {
    // Android intent format
    return `intent://open?url=${fullUrl}#Intent;scheme=overwallet;package=network.over.wallet;end`;
  } else if (os === 'ios') {
    // iOS universal link
    return `overwallet://open?url=${fullUrl}`;
  }
  
  return `overwallet://open?url=${fullUrl}`;
};

// App Store links for wallets
export const getWalletStoreLinks = () => {
  const os = detectOS();
  
  return {
    metamask: os === 'ios' 
      ? 'https://apps.apple.com/app/metamask/id1438144202'
      : 'https://play.google.com/store/apps/details?id=io.metamask',
    overwallet: os === 'ios'
      ? 'https://apps.apple.com/app/over-flex-wallet/id6474387758'
      : 'https://play.google.com/store/apps/details?id=network.over.wallet',
  };
};

// Trust Wallet Deep Link
export const getTrustWalletDeepLink = (): string => {
  const fullUrl = encodeURIComponent(getFullUrl());
  const os = detectOS();
  
  if (os === 'android') {
    return `intent://open?url=${fullUrl}#Intent;scheme=trust;package=com.wallet.crypto.trustapp;end`;
  }
  
  return `trust://open_url?url=${fullUrl}`;
};

// Coinbase Wallet Deep Link
export const getCoinbaseWalletDeepLink = (): string => {
  const fullUrl = encodeURIComponent(getFullUrl());
  return `https://go.cb-w.com/dapp?cb_url=${fullUrl}`;
};

// Try to open wallet with fallback
export const openWalletWithFallback = (
  walletId: 'metamask' | 'overwallet' | 'trust' | 'coinbase',
  onFallback?: () => void
): void => {
  let primaryLink: string;
  let fallbackLink: string | null = null;
  const storeLinks = getWalletStoreLinks();
  
  switch (walletId) {
    case 'metamask':
      primaryLink = getMetaMaskDeepLink();
      fallbackLink = getMetaMaskFallbackLink();
      break;
    case 'overwallet':
      primaryLink = getOverWalletDeepLink();
      break;
    case 'trust':
      primaryLink = getTrustWalletDeepLink();
      break;
    case 'coinbase':
      primaryLink = getCoinbaseWalletDeepLink();
      break;
    default:
      return;
  }
  
  // Try primary link
  const startTime = Date.now();
  window.location.href = primaryLink;
  
  // Set up fallback check
  setTimeout(() => {
    // If we're still here after 2.5 seconds, the deep link probably failed
    if (Date.now() - startTime > 2000) {
      if (fallbackLink) {
        // Try fallback link
        window.location.href = fallbackLink;
        
        // If that also fails, call the callback or open store
        setTimeout(() => {
          if (onFallback) {
            onFallback();
          } else {
            // Open app store as last resort
            const storeLink = walletId === 'metamask' ? storeLinks.metamask : storeLinks.overwallet;
            if (storeLink) {
              window.open(storeLink, '_blank');
            }
          }
        }, 2500);
      } else if (onFallback) {
        onFallback();
      }
    }
  }, 2500);
};

export default useMobileDetect;
