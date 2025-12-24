import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: In-memory storage for server seeds - never exposed until crash
const activeRoundSeeds = new Map<string, { serverSeed: string; serverSeedHash: string }>();

// Rate limiting map (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max 10 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// ============ SECURITY FUNCTIONS ============

async function verifyAdminAuthorization(req: Request, supabase: any): Promise<{ authorized: boolean; walletAddress?: string; error?: string }> {
  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[SECURITY] No valid Authorization header');
      return { authorized: false, error: 'Missing authorization' };
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Verify JWT and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.log('[SECURITY] Invalid JWT:', userError?.message);
      return { authorized: false, error: 'Invalid token' };
    }

    console.log(`[SECURITY] Authenticated user: ${user.id}`);

    // Get user's wallet address
    const { data: wallet, error: walletError } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (walletError || !wallet) {
      console.log('[SECURITY] No wallet linked for user');
      return { authorized: false, error: 'No wallet linked' };
    }

    const walletAddress = wallet.wallet_address;
    console.log(`[SECURITY] User wallet: ${walletAddress}`);

    // Check if wallet is admin using RPC function
    const { data: isAdmin, error: adminError } = await supabase
      .rpc('is_wallet_admin', { _wallet_address: walletAddress });

    if (adminError) {
      console.error('[SECURITY] Admin check error:', adminError);
      return { authorized: false, error: 'Admin check failed' };
    }

    if (!isAdmin) {
      console.log(`[SECURITY] Wallet ${walletAddress} is NOT admin`);
      return { authorized: false, error: 'Not authorized' };
    }

    console.log(`[SECURITY] ✓ Admin verified: ${walletAddress}`);
    return { authorized: true, walletAddress };

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
    'get_status' // Public action - no auth needed
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
  
  // 3% chance of instant crash (x1.00)
  if (randomValue < 0.03) {
    return 1.00;
  }
  
  // Exponential distribution
  const crashPoint = 1 + (Math.pow(1.05, randomValue * 100) - 1) / 10;
  return Math.min(Math.round(crashPoint * 100) / 100, 10.00);
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
          valid_actions: ['start_round', 'start_countdown', 'start_flying', 'process_auto_cashouts', 'crash', 'process_payouts', 'get_status']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Auth client uses anon key to verify JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PUBLIC ACTION: get_status - no auth needed
    if (action === 'get_status') {
      const { data: gameStatus } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'game_status')
        .single();

      const { data: pool } = await supabase
        .from('game_pool')
        .select('current_balance')
        .limit(1)
        .single();

      const { data: currentRound } = await supabase
        .from('game_rounds')
        .select('*')
        .in('status', ['betting', 'countdown', 'flying'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(
        JSON.stringify({
          game_active: gameStatus?.config_value?.active ?? false,
          game_paused_reason: gameStatus?.config_value?.reason ?? null,
          prize_pool: pool?.current_balance ?? 0,
          current_round: currentRound ?? null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ ADMIN-ONLY ACTIONS BELOW ============

    // Rate limit check (by IP or identifier)
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      console.log(`[${requestId}] Rate limited: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify admin authorization
    const authResult = await verifyAdminAuthorization(req, supabaseAuth);
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

        // Store seed in memory only
        activeRoundSeeds.set(round.id, { serverSeed, serverSeedHash });

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
          .update({ status: 'flying' })
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

        const { data: autoCashouts } = await supabase
          .from('game_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('status', 'active')
          .lte('auto_cashout_at', current_multiplier)
          .not('auto_cashout_at', 'is', null);

        if (autoCashouts && autoCashouts.length > 0) {
          for (const bet of autoCashouts) {
            const winnings = bet.bet_amount * bet.auto_cashout_at;
            await supabase
              .from('game_bets')
              .update({
                cashed_out_at: bet.auto_cashout_at,
                winnings: winnings,
                status: 'won',
              })
              .eq('id', bet.id)
              .eq('status', 'active');
          }
        }

        console.log(`[${requestId}] ✓ Auto-cashouts processed: ${autoCashouts?.length || 0}`);
        return new Response(
          JSON.stringify({ success: true, processed: autoCashouts?.length || 0 }),
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

        const seedData = activeRoundSeeds.get(round_id);
        
        if (!seedData) {
          console.error(`[${requestId}] No seed found for round ${round_id}`);
          return new Response(
            JSON.stringify({ error: 'Round seed not found - possible server restart' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { serverSeed, serverSeedHash } = seedData;
        const crashPoint = await generateCrashPoint(serverSeed);

        const { error: updateError } = await supabase
          .from('game_rounds')
          .update({ 
            status: 'crashed', 
            crashed_at: new Date().toISOString(),
            server_seed: serverSeed,
            crash_point: crashPoint,
          })
          .eq('id', round_id);

        if (updateError) {
          console.error(`[${requestId}] Crash update error:`, updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to crash round' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark active bets as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost', winnings: 0 })
          .eq('round_id', round_id)
          .eq('status', 'active');

        // Remove from memory
        activeRoundSeeds.delete(round_id);

        console.log(`[${requestId}] ✓ Round ${round_id} crashed at ${crashPoint}x`);

        return new Response(
          JSON.stringify({
            success: true,
            crash_point: crashPoint,
            server_seed: serverSeed,
            server_seed_hash: serverSeedHash,
          }),
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

        const { data: winningBets } = await supabase
          .from('game_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('status', 'won');

        let totalPayouts = 0;
        if (winningBets) {
          totalPayouts = winningBets.reduce((sum, bet) => sum + (bet.winnings || 0), 0);
        }

        await supabase
          .from('game_rounds')
          .update({ 
            status: 'payout',
            total_payouts: totalPayouts 
          })
          .eq('id', round_id);

        if (totalPayouts > 0) {
          const { data: pool } = await supabase
            .from('game_pool')
            .select('*')
            .limit(1)
            .single();

          if (pool) {
            await supabase
              .from('game_pool')
              .update({
                current_balance: pool.current_balance - totalPayouts,
                total_payouts: pool.total_payouts + totalPayouts,
                last_payout_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', pool.id);
          }
        }

        console.log(`[${requestId}] ✓ Payouts processed: ${totalPayouts} WOVER to ${winningBets?.length || 0} winners`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            total_payouts: totalPayouts,
            winning_bets: winningBets?.length || 0 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error(`[ERROR] game-round-manager:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
