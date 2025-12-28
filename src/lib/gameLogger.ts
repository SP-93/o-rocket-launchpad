/**
 * Game Logger - Unified logging with correlation IDs for debugging
 */

// Generate unique correlation ID for each action
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

interface GameLogEntry {
  correlationId: string;
  action: string;
  timestamp: string;
  data?: Record<string, any>;
  error?: string;
}

const MAX_LOG_ENTRIES = 100;
const LOG_STORAGE_KEY = 'game_debug_logs';

// Get logs from storage
export function getGameLogs(): GameLogEntry[] {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Add log entry
export function logGameAction(
  correlationId: string,
  action: string,
  data?: Record<string, any>,
  error?: string
): void {
  const entry: GameLogEntry = {
    correlationId,
    action,
    timestamp: new Date().toISOString(),
    data,
    error,
  };

  // Console log for immediate debugging
  if (error) {
    console.error(`[GAME:${correlationId}] ${action}:`, data, error);
  } else {
    console.log(`[GAME:${correlationId}] ${action}:`, data);
  }

  // Store in localStorage for debug panel
  try {
    const logs = getGameLogs();
    logs.unshift(entry);
    // Keep only recent entries
    const trimmed = logs.slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable
  }
}

// Clear logs
export function clearGameLogs(): void {
  localStorage.removeItem(LOG_STORAGE_KEY);
}

// Pending purchase recovery
interface PendingPurchase {
  txHash: string;
  walletAddress: string;
  ticketValue: number;
  paymentCurrency: 'WOVER' | 'USDT';
  paymentAmount: number;
  timestamp: number;
  correlationId: string;
}

const PENDING_PURCHASE_KEY = 'game_pending_purchases';
const PENDING_PURCHASE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export function savePendingPurchase(purchase: Omit<PendingPurchase, 'timestamp'>): void {
  try {
    const pending = getPendingPurchases();
    pending.push({ ...purchase, timestamp: Date.now() });
    localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(pending));
    logGameAction(purchase.correlationId, 'PENDING_PURCHASE_SAVED', { txHash: purchase.txHash });
  } catch {
    // Storage error
  }
}

export function getPendingPurchases(): PendingPurchase[] {
  try {
    const stored = localStorage.getItem(PENDING_PURCHASE_KEY);
    if (!stored) return [];
    const purchases: PendingPurchase[] = JSON.parse(stored);
    // Filter out expired
    const now = Date.now();
    return purchases.filter(p => now - p.timestamp < PENDING_PURCHASE_EXPIRY);
  } catch {
    return [];
  }
}

export function removePendingPurchase(txHash: string): void {
  try {
    const pending = getPendingPurchases();
    const filtered = pending.filter(p => p.txHash !== txHash);
    localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(filtered));
  } catch {
    // Storage error
  }
}

export function clearPendingPurchases(): void {
  localStorage.removeItem(PENDING_PURCHASE_KEY);
}
