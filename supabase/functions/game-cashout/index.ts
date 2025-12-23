import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (very strict for cashout to prevent spam)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 5 * 1000; // 5 seconds
const MAX_REQUESTS = 2;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  record.count++;
  return record.count > MAX_REQUESTS;
}

// SECURITY: Calculate expected multiplier on server side
function calculateServerMultiplier(startedAt: string): number {
  const startTime = new Date(startedAt).getTime();
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  // Same formula as client: Math.pow(1.0718, elapsed)
  const multiplier = Math.pow(1.0718, elapsedSeconds);
  return Math.min(multiplier, 10.00);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, bet_id, current_multiplier } = await req.json();

    // Validate input
    if (!wallet_address || !bet_id || current_multiplier === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by wallet
    if (isRateLimited(wallet_address.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Too many cashout attempts' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate multiplier range
    if (current_multiplier < 1.00 || current_multiplier > 10.00) {
      return new Response(
        JSON.stringify({ error: 'Invalid multiplier value' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get bet with round info
    const { data: bet, error: betError } = await supabase
      .from('game_bets')
      .select('*, game_rounds(*)')
      .eq('id', bet_id)
      .single();

    if (betError || !bet) {
      return new Response(
        JSON.stringify({ error: 'Bet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check bet ownership
    if (bet.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'This bet does not belong to you' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if round is in flying phase
    if (bet.game_rounds.status !== 'flying') {
      return new Response(
        JSON.stringify({ error: 'Cannot cash out - round is not in flight' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already cashed out
    if (bet.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Bet already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Server-side multiplier validation
    // Calculate what the multiplier SHOULD be based on round start time
    const roundStartedAt = bet.game_rounds.started_at;
    if (!roundStartedAt) {
      return new Response(
        JSON.stringify({ error: 'Round start time not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serverCalculatedMultiplier = calculateServerMultiplier(roundStartedAt);
    
    // Allow 15% tolerance for network latency and timing differences
    const tolerance = 0.15;
    const multiplierDiff = Math.abs(current_multiplier - serverCalculatedMultiplier) / serverCalculatedMultiplier;
    
    if (multiplierDiff > tolerance) {
      console.warn(`[SECURITY] Multiplier mismatch! Client: ${current_multiplier}, Server: ${serverCalculatedMultiplier.toFixed(2)}, Diff: ${(multiplierDiff * 100).toFixed(1)}%`);
      return new Response(
        JSON.stringify({ 
          error: 'Multiplier validation failed - please try again',
          details: 'Your cashout timing may have been affected by network latency'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Use server-calculated multiplier (more secure, prevents manipulation)
    const validatedMultiplier = Math.min(current_multiplier, serverCalculatedMultiplier);
    
    // Calculate winnings using validated multiplier
    const winnings = bet.bet_amount * validatedMultiplier;

    // Update bet
    const { data: updatedBet, error: updateError } = await supabase
      .from('game_bets')
      .update({
        cashed_out_at: validatedMultiplier,
        winnings: winnings,
        status: 'won',
      })
      .eq('id', bet_id)
      .eq('status', 'active') // Optimistic locking
      .select()
      .single();

    if (updateError || !updatedBet) {
      console.error('Error updating bet:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to process cashout. Bet may have already been processed.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SECURE] Cashout: ${bet_id} by ${wallet_address.substring(0, 10)}..., client_mult: ${current_multiplier}, validated_mult: ${validatedMultiplier.toFixed(2)}, winnings: ${winnings.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        cashout: {
          bet_id: updatedBet.id,
          cashed_out_at: updatedBet.cashed_out_at,
          winnings: updatedBet.winnings,
          bet_amount: updatedBet.bet_amount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in game-cashout:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
