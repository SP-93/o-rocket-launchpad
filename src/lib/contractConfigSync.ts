// Contract configuration sync with backend
// Syncs crashGame address between localStorage and Supabase game_config

import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';

const CONFIG_KEY = 'crash_game_address';

// Fetch crashGame address from backend
export const fetchCrashGameAddressFromBackend = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEY)
      .single();

    if (error || !data) {
      logger.info('No crashGame address in backend config');
      return null;
    }

    const configValue = data.config_value as Record<string, unknown> | null;
    const address = configValue?.address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      logger.info('Loaded crashGame address from backend:', address);
      return address;
    }

    return null;
  } catch (error) {
    logger.error('Failed to fetch crashGame address from backend:', error);
    return null;
  }
};

// Save crashGame address to backend
export const saveCrashGameAddressToBackend = async (address: string): Promise<boolean> => {
  try {
    // Upsert the config entry
    const { error } = await supabase
      .from('game_config')
      .upsert({
        config_key: CONFIG_KEY,
        config_value: { address },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'config_key',
      });

    if (error) {
      logger.error('Failed to save crashGame address to backend:', error);
      return false;
    }

    logger.info('Saved crashGame address to backend:', address);
    return true;
  } catch (error) {
    logger.error('Error saving crashGame address to backend:', error);
    return false;
  }
};

// Sync: Load from backend if not in localStorage
export const syncCrashGameAddress = async (localAddress: string | null): Promise<string | null> => {
  // If local has address, return it
  if (localAddress) {
    return localAddress;
  }

  // Otherwise, try to fetch from backend
  return await fetchCrashGameAddressFromBackend();
};
