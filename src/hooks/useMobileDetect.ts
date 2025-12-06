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
    const isOverWalletBrowser = /OverWallet/i.test(userAgent) || !!(window as any).ethereum?.isOverWallet;
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

// Deep link generators for mobile wallets
export const getMetaMaskDeepLink = (): string => {
  // MetaMask deep link format - opens dApp in MetaMask browser
  const dappUrl = window.location.host + window.location.pathname + window.location.search;
  return `https://metamask.app.link/dapp/${dappUrl}`;
};

export const getOverWalletDeepLink = (): string => {
  // OverWallet deep link format
  const dappUrl = encodeURIComponent(window.location.href);
  return `overwallet://open?url=${dappUrl}`;
};

export const getTrustWalletDeepLink = (): string => {
  const dappUrl = encodeURIComponent(window.location.href);
  return `trust://open_url?url=${dappUrl}`;
};

export const getCoinbaseWalletDeepLink = (): string => {
  const dappUrl = encodeURIComponent(window.location.href);
  return `https://go.cb-w.com/dapp?cb_url=${dappUrl}`;
};

export default useMobileDetect;
