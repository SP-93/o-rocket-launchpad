// Security initialization utilities
// Runs on app load to verify storage integrity and initialize security measures

import { verifyStorageIntegrity } from '@/contracts/storage';
import logger from './logger';

/**
 * Initialize security checks on app load
 * - Verifies localStorage integrity
 * - Clears corrupted data if found
 * - Logs security status (dev only)
 */
export const initializeSecurity = (): { isSecure: boolean; issues: string[] } => {
  const issues: string[] = [];

  try {
    // Verify storage integrity
    const storageCheck = verifyStorageIntegrity();
    
    if (!storageCheck.isValid) {
      logger.warn('Storage integrity check failed:', storageCheck.issues);
      issues.push(...storageCheck.issues);
      
      // Clear potentially tampered data
      const keysToCheck = [
        'orocket_deployed_contracts',
        'orocket_deployed_pools',
        'orocket_deployment_history',
      ];
      
      for (const key of keysToCheck) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            // If it has checksum format but failed validation, clear it
            if (parsed.checksum) {
              localStorage.removeItem(key);
              logger.info(`Cleared potentially tampered storage: ${key}`);
            }
          }
        } catch {
          // If we can't parse it, remove it
          localStorage.removeItem(key);
        }
      }
    } else {
      logger.info('Storage integrity check passed');
    }

    // Check for suspicious localStorage entries
    const suspiciousPatterns = [
      /^orocket_.*_backup$/,
      /^orocket_.*_override$/,
      /^orocket_admin/,
    ];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(key)) {
            localStorage.removeItem(key);
            issues.push(`Removed suspicious key: ${key}`);
            logger.warn(`Removed suspicious localStorage key: ${key}`);
          }
        }
      }
    }

    return {
      isSecure: issues.length === 0,
      issues,
    };
  } catch (error) {
    logger.error('Security initialization failed:', error);
    return {
      isSecure: false,
      issues: ['Security initialization error'],
    };
  }
};

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext || 
         window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

export default {
  initializeSecurity,
  isSecureContext,
};
