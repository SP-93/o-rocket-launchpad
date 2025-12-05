import { useState, useEffect } from 'react';

interface MobileDetectResult {
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isInAppBrowser: boolean;
  isMetaMaskBrowser: boolean;
  isOverWalletBrowser: boolean;
}

export const useMobileDetect = (): MobileDetectResult => {
  const [result, setResult] = useState<MobileDetectResult>({
    isMobile: false,
    isAndroid: false,
    isIOS: false,
    isInAppBrowser: false,
    isMetaMaskBrowser: false,
    isOverWalletBrowser: false,
  });

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isMobile = isAndroid || isIOS || /webOS|BlackBerry|Opera Mini|IEMobile/i.test(userAgent);
    
    // Check for in-app browsers
    const isMetaMaskBrowser = /MetaMask/i.test(userAgent);
    const isOverWalletBrowser = /OverWallet/i.test(userAgent);
    const isInAppBrowser = isMetaMaskBrowser || isOverWalletBrowser;

    setResult({
      isMobile,
      isAndroid,
      isIOS,
      isInAppBrowser,
      isMetaMaskBrowser,
      isOverWalletBrowser,
    });
  }, []);

  return result;
};

// Deep link generators for mobile wallets
export const getMetaMaskDeepLink = (): string => {
  const dappUrl = window.location.host + window.location.pathname;
  return `https://metamask.app.link/dapp/${dappUrl}`;
};

export const getOverWalletDeepLink = (): string => {
  // OverWallet deep link format - adjust based on their documentation
  const dappUrl = encodeURIComponent(window.location.href);
  return `overwallet://open?url=${dappUrl}`;
};

export default useMobileDetect;
