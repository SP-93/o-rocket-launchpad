// Storage validation utilities
// Provides checksum validation for localStorage data to prevent tampering

import { ethers } from 'ethers';

// Secret salt for checksum (obfuscated in production build)
const VALIDATION_SALT = 'orocket_v1_' + String.fromCharCode(0x52, 0x4f, 0x43, 0x4b, 0x45, 0x54);

// Generate checksum for data
export const generateChecksum = (data: string): string => {
  const saltedData = VALIDATION_SALT + data + VALIDATION_SALT;
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltedData)).slice(0, 18);
};

// Validate checksum
export const validateChecksum = (data: string, checksum: string): boolean => {
  const expectedChecksum = generateChecksum(data);
  return expectedChecksum === checksum;
};

// Secure storage wrapper
export const secureStorage = {
  setItem: (key: string, data: any): void => {
    const jsonData = JSON.stringify(data);
    const checksum = generateChecksum(jsonData);
    const secureData = JSON.stringify({
      data: jsonData,
      checksum,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, secureData);
  },

  getItem: <T>(key: string, defaultValue: T): { data: T; isValid: boolean } => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        return { data: defaultValue, isValid: true };
      }

      const parsed = JSON.parse(stored);
      
      // Check if it's in the new secure format
      if (parsed.data && parsed.checksum) {
        const isValid = validateChecksum(parsed.data, parsed.checksum);
        if (!isValid) {
          return { data: defaultValue, isValid: false };
        }
        return { data: JSON.parse(parsed.data), isValid: true };
      }
      
      // Legacy format - migrate it
      return { data: parsed as T, isValid: true };
    } catch {
      return { data: defaultValue, isValid: false };
    }
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },
};

// Validate Ethereum address format
export const isValidAddress = (address: string | null): boolean => {
  if (!address) return false;
  try {
    return ethers.utils.isAddress(address);
  } catch {
    return false;
  }
};

// Validate all contract addresses in storage
export const validateContractAddresses = (contracts: Record<string, string | null>): {
  isValid: boolean;
  invalidAddresses: string[];
} => {
  const invalidAddresses: string[] = [];
  
  for (const [key, address] of Object.entries(contracts)) {
    if (address !== null && !isValidAddress(address)) {
      invalidAddresses.push(key);
    }
  }
  
  return {
    isValid: invalidAddresses.length === 0,
    invalidAddresses,
  };
};
