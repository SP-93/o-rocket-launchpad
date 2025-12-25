import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-wallet',
};

// Rate limiting map (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // max 60 requests per minute for tick
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Simple encryption key from environment (or fallback)
const ENCRYPTION_KEY = Deno.env.get('SEED_ENCRYPTION_KEY') || 'orocket-seed-encryption-key-2024';

// Hardcoded admin wallets (same as frontend)
const ADMIN_WALLETS = [
  '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
  '0x8334966329b7f4b459633696a8ca59118253bc89',
];

// Game timing configuration (in seconds)
const GAME_CONFIG = {
  bettingDuration: 20,      // More time for bets
  countdownDuration: 5,     // Dramatic countdown
  crashDisplayDuration: 5,  // Time to see crash result
  pauseDuration: 3,         // Pause between rounds
};

function isWalletAdmin(walletAddress: string): boolean {
  if (!walletAddress) return false;
  return ADMIN_WALLETS.some(
    wallet => wallet.toLowerCase() === walletAddress.toLowerCase()
  );
}

// ============ SECURITY FUNCTIONS ============

async function verifyAdminAuthorization(
  req: Request, 
  supabaseAuth: any, 
  supabaseService: any,
  body: any
): Promise<{ authorized: boolean; walletAddress?: string; error?: string }> {
  try {
    // METHOD 1: Direct wallet address from trusted admin (for auto-game loop)
    const adminWalletHeader = req.headers.get('x-admin-wallet');
    const adminWalletBody = body?.admin_wallet;
    const directWallet = adminWalletHeader || adminWalletBody;
    
    if (directWallet && isWalletAdmin(directWallet)) {
      console.log(`[SECURITY] ✓ Direct admin wallet verified: ${directWallet}`);
      return { authorized: true, walletAddress: directWallet };
    }

    // METHOD 2: JWT-based auth (legacy - for UI with login)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '');
      
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(jwt);
      
      if (!userError && user) {
        console.log(`[SECURITY] Authenticated user: ${user.id}`);

        const { data: wallet, error: walletError } = await supabaseService
          .from('user_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!walletError && wallet) {
          const walletAddress = wallet.wallet_address;
          console.log(`[SECURITY] User wallet: ${walletAddress}`);

          // Check hardcoded admin list first (faster)
          if (isWalletAdmin(walletAddress)) {
            console.log(`[SECURITY] ✓ Admin verified (hardcoded): ${walletAddress}`);
            return { authorized: true, walletAddress };
          }

          // Fallback: Check DB
          const { data: isAdmin, error: adminError } = await supabaseService
            .rpc('is_wallet_admin', { _wallet_address: walletAddress });

          if (!adminError && isAdmin) {
            console.log(`[SECURITY] ✓ Admin verified (DB): ${walletAddress}`);
            return { authorized: true, walletAddress };
          }
        }
      }
    }

    console.log('[SECURITY] No valid admin authorization found');
    return { authorized: false, error: 'Not authorized' };

  } catch (error) {
    console.error('[SECURITY] Authorization error:', error);
    return { authorized: false, error: 'Authorization failed' };
  }
}

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

function validateAction(action: string): boolean {
  const validActions = [
    'start_round',
    'start_countdown', 
    'start_flying',
    'process_auto_cashouts',
    'crash',
    'process_payouts',
    'get_status',
    'tick',           // New: automatic state machine tick
    'enable_engine',  // New: enable/disable engine
    'disable_engine', // New: disable engine
  ];
  return validActions.includes(action);
}

// ============ CRYPTO FUNCTIONS ============

async function generateCrashPoint(serverSeed: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(serverSeed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const view = new DataView(hashBuffer);
  const randomValue = view.getUint32(0, true) / 0xFFFFFFFF;
  
  // PRODUCTION DISTRIBUTION - Target avg ~1.6-1.8x
  // 15% instant crash (1.00x) - higher instant crash rate
  if (randomValue < 0.15) {
    return 1.00;
  }
  
  // Remaining 85% distributed with SQUARE ROOT curve for ultra-low bias
  // Target: ~80% under 2x, ~92% under 3x, ~98% under 5x
  
  const normalized = (randomValue - 0.15) / 0.85; // 0-1 range
  
  let crashPoint: number;
  
  if (normalized < 0.75) {
    // 75% of remaining (63.75% total) → 1.01x to 1.80x
    // SQUARE ROOT curve = strongly favors low values
    const subNorm = normalized / 0.75;
    crashPoint = 1.01 + Math.pow(subNorm, 2) * 0.79; // Square pushes to low end
  } else if (normalized < 0.90) {
    // 15% of remaining (12.75% total) → 1.80x to 3.00x
    const subNorm = (normalized - 0.75) / 0.15;
    crashPoint = 1.80 + subNorm * 1.20;
  } else if (normalized < 0.97) {
    // 7% of remaining (5.95% total) → 3.00x to 5.00x
    const subNorm = (normalized - 0.90) / 0.07;
    crashPoint = 3.00 + subNorm * 2.00;
  } else {
    // 3% of remaining (2.55% total) → 5.00x to 8.00x (rare, capped lower)
    const subNorm = (normalized - 0.97) / 0.03;
    crashPoint = 5.00 + subNorm * 3.00; // Max 8x instead of 10x
  }
  
  return Math.round(crashPoint * 100) / 100;
}

function generateServerSeed(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashSeed(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple XOR-based encryption (sufficient for short-term seed storage)
function encryptSeed(seed: string): string {
  const key = ENCRYPTION_KEY;
  let encrypted = '';
  for (let i = 0; i < seed.length; i++) {
    encrypted += String.fromCharCode(seed.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encrypted);
}

function decryptSeed(encryptedSeed: string): string {
  const key = ENCRYPTION_KEY;
  const encrypted = atob(encryptedSeed);
  let decrypted = '';
  for (let i = 0; i < encrypted.length; i++) {
    decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decrypted;
}

// ============ DB SEED STORAGE FUNCTIONS ============

async function storeSeedInDb(supabase: any, roundId: string, serverSeed: string, serverSeedHash: string): Promise<boolean> {
  try {
    const encryptedSeed = encryptSeed(serverSeed);
    const { error } = await supabase
      .from('game_round_secrets')
      .insert({
        round_id: roundId,
        encrypted_server_seed: encryptedSeed,
        server_seed_hash: serverSeedHash,
      });
    
    if (error) {
      console.error('[SEED] Failed to store seed:', error);
      return false;
    }
    console.log('[SEED] ✓ Seed stored in DB for round:', roundId);
    return true;
  } catch (err) {
    console.error('[SEED] Error storing seed:', err);
    return false;
  }
}

async function getSeedFromDb(supabase: any, roundId: string): Promise<{ serverSeed: string; serverSeedHash: string } | null> {
  try {
    const { data, error } = await supabase
      .from('game_round_secrets')
      .select('encrypted_server_seed, server_seed_hash')
      .eq('round_id', roundId)
      .single();
    
    if (error || !data) {
      console.error('[SEED] Failed to retrieve seed:', error);
      return null;
    }
    
    const serverSeed = decryptSeed(data.encrypted_server_seed);
    console.log('[SEED] ✓ Seed retrieved from DB for round:', roundId);
    return { serverSeed, serverSeedHash: data.server_seed_hash };
  } catch (err) {
    console.error('[SEED] Error retrieving seed:', err);
    return null;
  }
}

async function deleteSeedFromDb(supabase: any, roundId: string): Promise<void> {
  try {
    await supabase
      .from('game_round_secrets')
      .delete()
      .eq('round_id', roundId);
    console.log('[SEED] ✓ Seed deleted from DB for round:', roundId);
  } catch (err) {
    console.error('[SEED] Error deleting seed:', err);
  }
}

// ============ MULTIPLIER CALCULATION ============

function calculateMultiplier(flyingStartedAt: string): number {
  const startTime = new Date(flyingStartedAt).getTime();
  const elapsed = (Date.now() - startTime) / 1000;
  // Exponential growth formula - same as frontend
  const multiplier = Math.pow(1.0718, elapsed);
  return Math.min(Math.round(multiplier * 100) / 100, 10.00);
}

// ============ STUCK CLAIMS RECOVERY ============

const STUCK_CLAIM_TIMEOUT_MINUTES = 5;

async function resetStuckClaims(supabase: any, requestId: string): Promise<void> {
  try {
    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - STUCK_CLAIM_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // Find and reset stuck claims: status='claiming', claim_tx_hash is null, claiming_started_at < cutoff
    const { data: stuckBets, error: fetchError } = await supabase
      .from('game_bets')
      .select('id')
      .eq('status', 'claiming')
      .is('claim_tx_hash', null)
      .lt('claiming_started_at', cutoffTime);

    if (fetchError || !stuckBets || stuckBets.length === 0) {
      return; // No stuck claims or error
    }

    const resetIds = stuckBets.map((b: any) => b.id);
    await supabase
      .from('game_bets')
      .update({
        status: 'won',
        claiming_started_at: null,
        claim_nonce: null,
      })
      .in('id', resetIds);

    console.log(`[${requestId}] TICK: Reset ${stuckBets.length} stuck claims`);
  } catch (err) {
    console.error(`[${requestId}] Error resetting stuck claims:`, err);
  }
}

// ============ TICK ENGINE - SERVER-SIDE STATE MACHINE ============

async function handleTick(supabase: any, requestId: string): Promise<{ action: string; details: any }> {
  // Reset stuck claims periodically (every tick is fine, query is fast)
  await resetStuckClaims(supabase, requestId);

  // Check if engine is enabled
  const { data: engineConfig } = await supabase
    .from('game_config')
    .select('config_value')
    .eq('config_key', 'engine_enabled')
    .single();

  if (!engineConfig?.config_value?.enabled) {
    return { action: 'idle', details: { reason: 'Engine disabled' } };
  }

  // Check if game is active
  const { data: gameStatus } = await supabase
    .from('game_config')
    .select('config_value')
    .eq('config_key', 'game_status')
    .single();

  // AUTO-RESUME: If paused due to low prize pool, check if we can resume
  if (!gameStatus?.config_value?.active && gameStatus?.config_value?.reason === 'Low prize pool') {
    const { data: pool } = await supabase
      .from('game_pool')
      .select('current_balance')
      .limit(1)
      .single();

    const { data: threshold } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'auto_pause_threshold')
      .single();

    const minBalance = threshold?.config_value?.wover || 55;

    if (pool && pool.current_balance >= minBalance) {
      await supabase
        .from('game_config')
        .upsert({ 
          config_key: 'game_status',
          config_value: { active: true, resumed_at: new Date().toISOString(), resumed_reason: 'Pool replenished' } 
        }, { onConflict: 'config_key' });

      console.log(`[${requestId}] AUTO-RESUME: Pool balance ${pool.current_balance} >= threshold ${minBalance}`);
      // Continue to start new round (don't return, let it flow through)
    } else {
      return { action: 'paused', details: { reason: 'Low prize pool', balance: pool?.current_balance, threshold: minBalance } };
    }
  } else if (!gameStatus?.config_value?.active) {
    return { action: 'paused', details: { reason: gameStatus?.config_value?.reason || 'Game paused' } };
  }

  // Get current active round - EXCLUDE 'payout' so a new round starts after payout
  const { data: currentRound } = await supabase
    .from('game_rounds')
    .select('*')
    .in('status', ['betting', 'countdown', 'flying', 'crashed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();

  // No active round - start a new one
  if (!currentRound) {
    console.log(`[${requestId}] TICK: No active round, starting new round`);
    
    // Check prize pool balance first
    const { data: pool } = await supabase
      .from('game_pool')
      .select('id, current_balance')
      .limit(1)
      .single();

    const { data: threshold } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'auto_pause_threshold')
      .single();

    const minBalance = threshold?.config_value?.wover || 55;

    if (pool && pool.current_balance < minBalance) {
      await supabase
        .from('game_config')
        .upsert({ 
          config_key: 'game_status',
          config_value: { active: false, reason: 'Low prize pool' } 
        }, { onConflict: 'config_key' });

      return { action: 'auto_paused', details: { reason: 'Low prize pool', balance: pool.current_balance } };
    }

    // Generate server seed and hash
    const serverSeed = generateServerSeed();
    const serverSeedHash = await hashSeed(serverSeed);

    // Create new round
    const { data: newRound, error: roundError } = await supabase
      .from('game_rounds')
      .insert({
        status: 'betting',
        server_seed_hash: serverSeedHash,
        server_seed: null,
        crash_point: null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (roundError) {
      console.error(`[${requestId}] Failed to create round:`, roundError);
      return { action: 'error', details: { error: 'Failed to create round' } };
    }

    // Store seed
    await storeSeedInDb(supabase, newRound.id, serverSeed, serverSeedHash);

    console.log(`[${requestId}] TICK: Round ${newRound.round_number} started (betting)`);
    return { action: 'round_started', details: { roundId: newRound.id, roundNumber: newRound.round_number } };
  }

  // Use effective start time with proper fallback chain
  // For crashed status, use crashed_at for payout timer
  // For other statuses, use started_at (phase start time)
  const getEffectiveStartTime = (): number => {
    if (currentRound.status === 'crashed' && currentRound.crashed_at) {
      // Use crashed_at for payout phase timing
      return new Date(currentRound.crashed_at).getTime();
    }
    if (currentRound.started_at) {
      return new Date(currentRound.started_at).getTime();
    }
    return new Date(currentRound.created_at).getTime();
  };

  const effectiveStart = getEffectiveStartTime();
  const elapsed = (now - effectiveStart) / 1000;

  // Handle based on current status
  switch (currentRound.status) {
    case 'betting': {
      // After betting duration, move to countdown
      if (elapsed >= GAME_CONFIG.bettingDuration) {
        await supabase
          .from('game_rounds')
          .update({ 
            status: 'countdown', 
            started_at: new Date().toISOString() 
          })
          .eq('id', currentRound.id);

        console.log(`[${requestId}] TICK: Round ${currentRound.round_number} → countdown`);
        return { action: 'countdown_started', details: { roundId: currentRound.id } };
      }
      return { action: 'betting', details: { timeRemaining: Math.ceil(GAME_CONFIG.bettingDuration - elapsed) } };
    }

    case 'countdown': {
      // After countdown duration, move to flying
      if (elapsed >= GAME_CONFIG.countdownDuration) {
        await supabase
          .from('game_rounds')
          .update({ 
            status: 'flying', 
            started_at: new Date().toISOString() 
          })
          .eq('id', currentRound.id);

        console.log(`[${requestId}] TICK: Round ${currentRound.round_number} → flying`);
        return { action: 'flying_started', details: { roundId: currentRound.id } };
      }
      return { action: 'countdown', details: { timeRemaining: Math.ceil(GAME_CONFIG.countdownDuration - elapsed) } };
    }

    case 'flying': {
      // SAFETY CHECK: If round already has crash_point, it was already crashed
      // This can happen due to race conditions between concurrent ticks
      if (currentRound.crash_point !== null) {
        console.log(`[${requestId}] Round ${currentRound.id} already has crash_point ${currentRound.crash_point}, recovering to crashed status`);
        await supabase
          .from('game_rounds')
          .update({ status: 'crashed' })
          .eq('id', currentRound.id);
        return { action: 'recovering_crashed_round', details: { roundId: currentRound.id, crashPoint: currentRound.crash_point } };
      }

      // Calculate current multiplier and check if should crash
      const currentMultiplier = calculateMultiplier(currentRound.started_at);
      
      // Get crash point from seed
      const seedData = await getSeedFromDb(supabase, currentRound.id);
      if (!seedData) {
        console.error(`[${requestId}] No seed found for flying round ${currentRound.id}`);
        // RECOVERY: Force crash the round without seed to prevent stuck state
        console.log(`[${requestId}] Forcing crash on round ${currentRound.id} due to missing seed`);
        await supabase
          .from('game_rounds')
          .update({
            status: 'crashed',
            crash_point: 1.00,
            crashed_at: new Date().toISOString(),
          })
          .eq('id', currentRound.id);
        
        // Mark all active bets as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost' })
          .eq('round_id', currentRound.id)
          .eq('status', 'active');
        
        return { action: 'forced_crash', details: { roundId: currentRound.id, reason: 'Missing seed' } };
      }

      const crashPoint = await generateCrashPoint(seedData.serverSeed);

      // Process auto-cashouts for bets that should cash out at current multiplier
      const { data: autoCashouts } = await supabase
        .from('game_bets')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('status', 'active')
        .not('auto_cashout_at', 'is', null)
        .lte('auto_cashout_at', currentMultiplier);

      for (const bet of autoCashouts || []) {
        const winnings = Math.floor(bet.bet_amount * bet.auto_cashout_at);
        await supabase
          .from('game_bets')
          .update({
            status: 'won',
            cashed_out_at: bet.auto_cashout_at,
            winnings,
          })
          .eq('id', bet.id);
        console.log(`[${requestId}] Auto-cashout: ${bet.wallet_address} at ${bet.auto_cashout_at}x → ${winnings}`);
      }

      // Check if should crash
      if (currentMultiplier >= crashPoint) {
        const crashedAt = new Date().toISOString();
        // Update round with crash info - DO NOT overwrite started_at!
        // Keep original flying started_at for accurate multiplier calculation
        await supabase
          .from('game_rounds')
          .update({
            status: 'crashed',
            crash_point: crashPoint,
            server_seed: seedData.serverSeed,
            crashed_at: crashedAt,
            // NOTE: We keep started_at as original flying start time
            // crashed_at is now used for payout phase timing
          })
          .eq('id', currentRound.id);

        // Mark all remaining active bets as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost' })
          .eq('round_id', currentRound.id)
          .eq('status', 'active');

        // Delete seed from DB
        await deleteSeedFromDb(supabase, currentRound.id);

        console.log(`[${requestId}] TICK: Round ${currentRound.round_number} crashed at ${crashPoint}x`);
        return { action: 'crashed', details: { roundId: currentRound.id, crashPoint } };
      }

      return { action: 'flying', details: { multiplier: currentMultiplier, crashPoint } };
    }

    case 'crashed': {
      // After crash display duration, process payouts
      if (elapsed >= GAME_CONFIG.crashDisplayDuration) {
        // Calculate totals
        const { data: bets } = await supabase
          .from('game_bets')
          .select('bet_amount, winnings, status')
          .eq('round_id', currentRound.id);

        const totalWagered = (bets || []).reduce((sum: number, b: any) => sum + (b.bet_amount || 0), 0);
        const totalPayouts = (bets || []).filter((b: any) => b.status === 'won').reduce((sum: number, b: any) => sum + (b.winnings || 0), 0);

        // Update round stats and mark as payout (completed)
        await supabase
          .from('game_rounds')
          .update({
            status: 'payout',
            total_wagered: totalWagered,
            total_payouts: totalPayouts,
            total_bets: bets?.length || 0,
          })
          .eq('id', currentRound.id);

        // Update pool balance with proper ID filter
        const netChange = totalWagered - totalPayouts;
        const { data: pool } = await supabase
          .from('game_pool')
          .select('id, current_balance, total_payouts')
          .limit(1)
          .single();

        if (pool) {
          await supabase
            .from('game_pool')
            .update({
              current_balance: pool.current_balance + netChange,
              total_payouts: (pool.total_payouts || 0) + totalPayouts,
              last_payout_at: new Date().toISOString(),
            })
            .eq('id', pool.id);
          console.log(`[${requestId}] Pool updated: balance ${pool.current_balance} → ${pool.current_balance + netChange}`);
        }

        console.log(`[${requestId}] TICK: Round ${currentRound.round_number} → payout (net: ${netChange})`);
        return { action: 'payout_started', details: { totalWagered, totalPayouts, netChange } };
      }
      return { action: 'crashed_display', details: { timeRemaining: Math.ceil(GAME_CONFIG.crashDisplayDuration - elapsed) } };
    }

    // payout is now excluded from active round query, so we won't reach here
    // If we somehow do, just return that it's done

    default:
      return { action: 'unknown', details: { status: currentRound.status } };
  }
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Request received`);

  try {
    const body = await req.json();
    const { action } = body;

    console.log(`[${requestId}] Action: ${action}`);

    // Validate action first
    if (!action || !validateAction(action)) {
      console.log(`[${requestId}] Invalid action: ${action}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid action',
          valid_actions: ['start_round', 'start_countdown', 'start_flying', 'process_auto_cashouts', 'crash', 'process_payouts', 'get_status', 'tick', 'enable_engine', 'disable_engine']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PUBLIC ACTION: get_status - no auth needed
    if (action === 'get_status') {
      const { data: gameStatus } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'game_status')
        .single();

      const { data: engineConfig } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'engine_enabled')
        .single();

      const engineEnabled = engineConfig?.config_value?.enabled ?? false;

      const { data: thresholdConfig } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'auto_pause_threshold')
        .single();

      const { data: pool } = await supabase
        .from('game_pool')
        .select('current_balance')
        .limit(1)
        .single();

      // If engine is stopped, show the last finished round instead of a stuck in-progress one
      let currentRound: any | null = null;
      if (engineEnabled) {
        const { data } = await supabase
          .from('game_rounds')
          .select('*')
          .in('status', ['betting', 'countdown', 'flying'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        currentRound = data ?? null;
      } else {
        const { data } = await supabase
          .from('game_rounds')
          .select('*')
          .in('status', ['crashed', 'payout'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        currentRound = data ?? null;
      }

      return new Response(
        JSON.stringify({
          game_active: gameStatus?.config_value?.active ?? false,
          pause_reason: gameStatus?.config_value?.reason ?? null,
          engine_enabled: engineEnabled,
          threshold: thresholdConfig?.config_value?.wover ?? 100,
          prize_pool: pool?.current_balance ?? 0,
          current_round: currentRound,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC ACTION: tick - drives the game state machine (rate limited but no auth)
    if (action === 'tick') {
      const clientIP = req.headers.get('x-forwarded-for') || 'tick';
      const rateCheck = checkRateLimit(clientIP);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', remaining: 0 }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await handleTick(supabase, requestId);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ ADMIN-ONLY ACTIONS BELOW ============

    // Rate limit check
    const clientIP = req.headers.get('x-forwarded-for') || 'admin';
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      console.log(`[${requestId}] Rate limited: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify admin authorization (supports both wallet and JWT)
    const authResult = await verifyAdminAuthorization(req, supabaseAuth, supabase, body);
    if (!authResult.authorized) {
      console.log(`[${requestId}] Unauthorized: ${authResult.error}`);
      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Admin authorized: ${authResult.walletAddress}`);

    // ============ HANDLE ACTIONS ============

    switch (action) {
      case 'enable_engine': {
        await supabase
          .from('game_config')
          .upsert({ 
            config_key: 'engine_enabled',
            config_value: { enabled: true, started_at: new Date().toISOString(), started_by: authResult.walletAddress } 
          }, { onConflict: 'config_key' });

        // Also ensure game is active
        await supabase
          .from('game_config')
          .upsert({ 
            config_key: 'game_status',
            config_value: { active: true } 
          }, { onConflict: 'config_key' });

        console.log(`[${requestId}] ✓ Engine enabled by ${authResult.walletAddress}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Engine enabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disable_engine': {
        await supabase
          .from('game_config')
          .upsert({ 
            config_key: 'engine_enabled',
            config_value: { enabled: false, stopped_at: new Date().toISOString(), stopped_by: authResult.walletAddress } 
          }, { onConflict: 'config_key' });

        console.log(`[${requestId}] ✓ Engine disabled by ${authResult.walletAddress}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Engine disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'start_round': {
        // Check if game is active
        const { data: gameStatus } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'game_status')
          .single();

        if (!gameStatus?.config_value?.active) {
          const reason = gameStatus?.config_value?.reason || 'Game is paused by admin';
          console.log(`[${requestId}] Game paused: ${reason}`);
          return new Response(
            JSON.stringify({ error: `Game is paused: ${reason}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check prize pool balance
        const { data: pool } = await supabase
          .from('game_pool')
          .select('current_balance')
          .limit(1)
          .single();

        const { data: threshold } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'auto_pause_threshold')
          .single();

        const minBalance = threshold?.config_value?.wover || 150;

        if (pool && pool.current_balance < minBalance) {
          await supabase
            .from('game_config')
            .upsert({ 
              config_key: 'game_status',
              config_value: { active: false, reason: 'Low prize pool' } 
            }, { onConflict: 'config_key' });

          console.log(`[${requestId}] Auto-paused: balance ${pool.current_balance} < ${minBalance}`);
          return new Response(
            JSON.stringify({ error: `Game auto-paused: Prize pool (${pool.current_balance}) below threshold (${minBalance})` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate server seed and hash
        const serverSeed = generateServerSeed();
        const serverSeedHash = await hashSeed(serverSeed);

        // Create round WITHOUT server_seed and crash_point
        const { data: round, error: roundError } = await supabase
          .from('game_rounds')
          .insert({
            status: 'betting',
            server_seed_hash: serverSeedHash,
            server_seed: null,
            crash_point: null,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (roundError) {
          console.error(`[${requestId}] Error creating round:`, roundError);
          return new Response(
            JSON.stringify({ error: 'Failed to create round' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store seed in DATABASE
        const stored = await storeSeedInDb(supabase, round.id, serverSeed, serverSeedHash);
        if (!stored) {
          console.error(`[${requestId}] Failed to store seed in DB`);
          await supabase.from('game_rounds').delete().eq('id', round.id);
          return new Response(
            JSON.stringify({ error: 'Failed to secure round seed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] ✓ Round ${round.round_number} started (ID: ${round.id})`);

        return new Response(
          JSON.stringify({
            success: true,
            round: {
              id: round.id,
              round_number: round.round_number,
              status: round.status,
              server_seed_hash: round.server_seed_hash,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'start_countdown': {
        const { round_id } = body;
        if (!round_id) {
          return new Response(
            JSON.stringify({ error: 'Missing round_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('game_rounds')
          .update({ status: 'countdown', started_at: new Date().toISOString() })
          .eq('id', round_id)
          .eq('status', 'betting');

        if (error) {
          console.error(`[${requestId}] Countdown error:`, error);
          return new Response(
            JSON.stringify({ error: 'Failed to start countdown' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] ✓ Round ${round_id} → countdown`);
        return new Response(
          JSON.stringify({ success: true, status: 'countdown' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'start_flying': {
        const { round_id } = body;
        if (!round_id) {
          return new Response(
            JSON.stringify({ error: 'Missing round_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('game_rounds')
          .update({ status: 'flying', started_at: new Date().toISOString() })
          .eq('id', round_id)
          .eq('status', 'countdown');

        if (error) {
          console.error(`[${requestId}] Flying error:`, error);
          return new Response(
            JSON.stringify({ error: 'Failed to start flying' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] ✓ Round ${round_id} → flying`);
        return new Response(
          JSON.stringify({ success: true, status: 'flying' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process_auto_cashouts': {
        const { round_id, current_multiplier } = body;
        
        if (!round_id || typeof current_multiplier !== 'number') {
          return new Response(
            JSON.stringify({ error: 'Missing round_id or current_multiplier' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (current_multiplier < 1.00 || current_multiplier > 100.00) {
          return new Response(
            JSON.stringify({ error: 'Invalid multiplier range' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find bets with auto_cashout_at <= current_multiplier that are still active
        const { data: autoCashouts, error: fetchError } = await supabase
          .from('game_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('status', 'active')
          .not('auto_cashout_at', 'is', null)
          .lte('auto_cashout_at', current_multiplier);

        if (fetchError) {
          console.error(`[${requestId}] Auto-cashout fetch error:`, fetchError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch auto-cashouts' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let processed = 0;
        for (const bet of autoCashouts || []) {
          const winnings = Math.floor(bet.bet_amount * bet.auto_cashout_at);
          await supabase
            .from('game_bets')
            .update({
              status: 'won',
              cashed_out_at: bet.auto_cashout_at,
              winnings,
            })
            .eq('id', bet.id);
          processed++;
        }

        console.log(`[${requestId}] ✓ Auto-cashed out ${processed} bets at ${current_multiplier}x`);
        return new Response(
          JSON.stringify({ success: true, processed }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'crash': {
        const { round_id } = body;
        if (!round_id) {
          return new Response(
            JSON.stringify({ error: 'Missing round_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get seed from DB
        const seedData = await getSeedFromDb(supabase, round_id);
        if (!seedData) {
          console.error(`[${requestId}] No seed found for round ${round_id}`);
          return new Response(
            JSON.stringify({ error: 'Round seed not found' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate crash point
        const crashPoint = await generateCrashPoint(seedData.serverSeed);
        console.log(`[${requestId}] Crash point calculated: ${crashPoint}x`);

        // Update round with crash info
        const { error: updateError } = await supabase
          .from('game_rounds')
          .update({
            status: 'crashed',
            crash_point: crashPoint,
            server_seed: seedData.serverSeed,
            crashed_at: new Date().toISOString(),
          })
          .eq('id', round_id);

        if (updateError) {
          console.error(`[${requestId}] Crash update error:`, updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to crash round' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark all active bets as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost' })
          .eq('round_id', round_id)
          .eq('status', 'active');

        // Delete seed from DB
        await deleteSeedFromDb(supabase, round_id);

        console.log(`[${requestId}] ✓ Round ${round_id} crashed at ${crashPoint}x`);
        return new Response(
          JSON.stringify({ success: true, crash_point: crashPoint }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process_payouts': {
        const { round_id } = body;
        if (!round_id) {
          return new Response(
            JSON.stringify({ error: 'Missing round_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate total wagered and payouts
        const { data: bets } = await supabase
          .from('game_bets')
          .select('bet_amount, winnings, status')
          .eq('round_id', round_id);

        const totalWagered = (bets || []).reduce((sum, b) => sum + (b.bet_amount || 0), 0);
        const totalPayouts = (bets || []).filter(b => b.status === 'won').reduce((sum, b) => sum + (b.winnings || 0), 0);

        // Update round stats
        await supabase
          .from('game_rounds')
          .update({
            status: 'payout',
            total_wagered: totalWagered,
            total_payouts: totalPayouts,
            total_bets: bets?.length || 0,
          })
          .eq('id', round_id);

        // Update pool balance (add wagered, subtract payouts)
        const netChange = totalWagered - totalPayouts;
        const { data: pool } = await supabase
          .from('game_pool')
          .select('current_balance')
          .limit(1)
          .single();

        if (pool) {
          await supabase
            .from('game_pool')
            .update({
              current_balance: pool.current_balance + netChange,
              total_deposits: pool.current_balance + totalWagered,
              total_payouts: (pool as any).total_payouts + totalPayouts,
              last_payout_at: new Date().toISOString(),
            })
            .limit(1);
        }

        console.log(`[${requestId}] ✓ Payouts processed: wagered=${totalWagered}, paid=${totalPayouts}, net=${netChange}`);
        return new Response(
          JSON.stringify({ success: true, totalWagered, totalPayouts, netChange }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error(`[${requestId}] Internal error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
