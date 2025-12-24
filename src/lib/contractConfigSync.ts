// Contract configuration sync with backend
// Syncs crashGame and ticketNFT addresses between localStorage and Supabase game_config
// Uses versioned keys for v2 contracts (signature claims)

import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';

// Versioned config keys for v2 contracts
const CONFIG_KEYS = {
  CRASH_GAME_V2: 'crash_game_v2_address',
  TICKET_NFT: 'ticket_nft_address',
  // Legacy key (for detection/migration)
  CRASH_GAME_LEGACY: 'crash_game_address',
};

// ==================== CrashGame v2 ====================

// Fetch crashGame v2 address from backend
export const fetchCrashGameAddressFromBackend = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEYS.CRASH_GAME_V2)
      .maybeSingle(); // Use maybeSingle to not error when no row exists

    if (error) {
      logger.error('Error fetching crashGame v2 address:', error);
      return null;
    }

    if (!data) {
      logger.info('No crashGame v2 address in backend config');
      return null;
    }

    const configValue = data.config_value as Record<string, unknown> | null;
    const address = configValue?.address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      logger.info('Loaded crashGame v2 address from backend:', address);
      return address;
    }

    return null;
  } catch (error) {
    logger.error('Failed to fetch crashGame v2 address from backend:', error);
    return null;
  }
};

// Save crashGame v2 address to backend
export const saveCrashGameAddressToBackend = async (address: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_config')
      .upsert({
        config_key: CONFIG_KEYS.CRASH_GAME_V2,
        config_value: { address, version: 'v2-signature-claims', updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'config_key',
      });

    if (error) {
      logger.error('Failed to save crashGame v2 address to backend:', error);
      return false;
    }

    logger.info('Saved crashGame v2 address to backend:', address);
    return true;
  } catch (error) {
    logger.error('Error saving crashGame v2 address to backend:', error);
    return false;
  }
};

// Clear crashGame v2 address from backend
export const clearCrashGameAddressFromBackend = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_config')
      .delete()
      .eq('config_key', CONFIG_KEYS.CRASH_GAME_V2);

    if (error) {
      logger.error('Failed to clear crashGame v2 address from backend:', error);
      return false;
    }

    logger.info('Cleared crashGame v2 address from backend');
    return true;
  } catch (error) {
    logger.error('Error clearing crashGame v2 address from backend:', error);
    return false;
  }
};

// ==================== TicketNFT ====================

// Fetch ticketNFT address from backend
export const fetchTicketNFTAddressFromBackend = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEYS.TICKET_NFT)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching ticketNFT address:', error);
      return null;
    }

    if (!data) {
      logger.info('No ticketNFT address in backend config');
      return null;
    }

    const configValue = data.config_value as Record<string, unknown> | null;
    const address = configValue?.address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      logger.info('Loaded ticketNFT address from backend:', address);
      return address;
    }

    return null;
  } catch (error) {
    logger.error('Failed to fetch ticketNFT address from backend:', error);
    return null;
  }
};

// Save ticketNFT address to backend
export const saveTicketNFTAddressToBackend = async (address: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_config')
      .upsert({
        config_key: CONFIG_KEYS.TICKET_NFT,
        config_value: { address, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'config_key',
      });

    if (error) {
      logger.error('Failed to save ticketNFT address to backend:', error);
      return false;
    }

    logger.info('Saved ticketNFT address to backend:', address);
    return true;
  } catch (error) {
    logger.error('Error saving ticketNFT address to backend:', error);
    return false;
  }
};

// Clear ticketNFT address from backend
export const clearTicketNFTAddressFromBackend = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_config')
      .delete()
      .eq('config_key', CONFIG_KEYS.TICKET_NFT);

    if (error) {
      logger.error('Failed to clear ticketNFT address from backend:', error);
      return false;
    }

    logger.info('Cleared ticketNFT address from backend');
    return true;
  } catch (error) {
    logger.error('Error clearing ticketNFT address from backend:', error);
    return false;
  }
};

// ==================== Legacy Detection ====================

// Check if legacy crashGame address exists (for migration warning)
export const checkLegacyCrashGameAddress = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEYS.CRASH_GAME_LEGACY)
      .maybeSingle();

    if (error || !data) return null;

    const configValue = data.config_value as Record<string, unknown> | null;
    const address = configValue?.address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      return address;
    }
    return null;
  } catch {
    return null;
  }
};

// Clear legacy crashGame address from backend
export const clearLegacyCrashGameAddress = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_config')
      .delete()
      .eq('config_key', CONFIG_KEYS.CRASH_GAME_LEGACY);

    if (error) {
      logger.error('Failed to clear legacy crashGame address:', error);
      return false;
    }

    logger.info('Cleared legacy crashGame address from backend');
    return true;
  } catch (error) {
    logger.error('Error clearing legacy crashGame address:', error);
    return false;
  }
};

// ==================== Sync Utilities ====================

// Sync: Load from backend if not in localStorage
export const syncCrashGameAddress = async (localAddress: string | null): Promise<string | null> => {
  if (localAddress) {
    return localAddress;
  }
  return await fetchCrashGameAddressFromBackend();
};

// Sync: Load ticketNFT from backend if not in localStorage
export const syncTicketNFTAddress = async (localAddress: string | null): Promise<string | null> => {
  if (localAddress) {
    return localAddress;
  }
  return await fetchTicketNFTAddressFromBackend();
};

// Get all backend addresses at once
export const fetchAllBackendAddresses = async (): Promise<{
  crashGameV2: string | null;
  ticketNFT: string | null;
  crashGameLegacy: string | null;
}> => {
  const [crashGameV2, ticketNFT, crashGameLegacy] = await Promise.all([
    fetchCrashGameAddressFromBackend(),
    fetchTicketNFTAddressFromBackend(),
    checkLegacyCrashGameAddress(),
  ]);
  
  return { crashGameV2, ticketNFT, crashGameLegacy };
};
