import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (strict for cashout to prevent spam)
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

// Generate request ID for logging
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

// SECURITY: Calculate expected multiplier on server side
function calculateServerMultiplier(startedAt: string): number {
  const startTime = new Date(startedAt).getTime();
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  // Same formula as client: Math.pow(1.0718, elapsed)
  const multiplier = Math.pow(1.0718, elapsedSeconds);
  return Math.min(multiplier, 10.00);
}

// Calculate time until crash based on crash point
function calculateCrashTime(crashPoint: number): number {
  // Reverse of multiplier formula: elapsed = ln(crashPoint) / ln(1.0718)
  return Math.log(crashPoint) / Math.log(1.0718);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const serverTime = new Date().toISOString();
  const serverTimestamp = Date.now();

  try {
    const { wallet_address, bet_id, current_multiplier, client_timestamp, correlation_id } = await req.json();

    // Calculate network latency if client_timestamp provided
    let networkLatencyMs = 0;
    if (client_timestamp) {
      networkLatencyMs = Math.max(0, serverTimestamp - client_timestamp);
      // Cap latency compensation at 1 second to prevent abuse
      networkLatencyMs = Math.min(networkLatencyMs, 1000);
    }

    console.log(`[${requestId}] CASHOUT_START`, {
      wallet: wallet_address?.slice(0, 10),
      bet_id: bet_id?.slice(0, 8),
      client_multiplier: current_multiplier,
      client_timestamp,
      network_latency_ms: networkLatencyMs,
      correlation_id,
      serverTime,
    });

    // Validate input
    if (!wallet_address || !bet_id || current_multiplier === undefined) {
      console.log(`[${requestId}] VALIDATION_FAILED: Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by wallet
    if (isRateLimited(wallet_address.toLowerCase())) {
      console.log(`[${requestId}] RATE_LIMITED: ${wallet_address}`);
      return new Response(
        JSON.stringify({ error: 'Too many cashout attempts', request_id: requestId }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate multiplier range
    if (current_multiplier < 1.00 || current_multiplier > 10.00) {
      console.log(`[${requestId}] INVALID_MULTIPLIER: ${current_multiplier}`);
      return new Response(
        JSON.stringify({ error: 'Invalid multiplier value', request_id: requestId }),
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
      console.log(`[${requestId}] BET_NOT_FOUND: ${bet_id}`);
      return new Response(
        JSON.stringify({ error: 'Bet not found', request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check bet ownership
    if (bet.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      console.log(`[${requestId}] UNAUTHORIZED: Bet belongs to different wallet`);
      return new Response(
        JSON.stringify({ error: 'This bet does not belong to you', request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const round = bet.game_rounds;

    // Check if already cashed out
    if (bet.status !== 'active') {
      console.log(`[${requestId}] BET_ALREADY_PROCESSED: status=${bet.status}`);
      return new Response(
        JSON.stringify({ error: 'Bet already processed', status: bet.status, request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CRITICAL: SERVER-AUTHORITATIVE CASHOUT ==========
    const roundStartedAt = round.started_at;
    if (!roundStartedAt) {
      console.log(`[${requestId}] NO_START_TIME: Round has no started_at`);
      return new Response(
        JSON.stringify({ error: 'Round start time not available', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate server-side multiplier with latency compensation
    // Subtract latency to give benefit of doubt to user (they clicked earlier)
    const adjustedServerTimestamp = serverTimestamp - networkLatencyMs;
    const elapsedSeconds = Math.max(0, (adjustedServerTimestamp - new Date(roundStartedAt).getTime()) / 1000);
    const serverCalculatedMultiplier = Math.min(Math.pow(1.0718, elapsedSeconds), 10.00);
    
    console.log(`[${requestId}] MULTIPLIER_CHECK`, {
      client: current_multiplier,
      server: serverCalculatedMultiplier.toFixed(4),
      latency_compensation_ms: networkLatencyMs,
      diff_percent: (Math.abs(current_multiplier - serverCalculatedMultiplier) / serverCalculatedMultiplier * 100).toFixed(2),
      round_status: round.status,
      round_crash_point: round.crash_point,
    });

    // ========== RACE CONDITION DETECTION ==========
    // Check if round should have already crashed based on crash point
    if (round.crash_point && round.status === 'flying') {
      const crashTime = calculateCrashTime(round.crash_point);
      const startTime = new Date(roundStartedAt).getTime();
      const expectedCrashTimestamp = startTime + (crashTime * 1000);
      
      if (serverTimestamp > expectedCrashTimestamp) {
        // Round should have crashed already - this is a race condition
        const lateDiff = serverTimestamp - expectedCrashTimestamp;
        console.log(`[${requestId}] RACE_CONDITION_DETECTED: Round should have crashed ${lateDiff}ms ago`);
        
        // Force crash the round immediately
        await supabase
          .from('game_rounds')
          .update({
            status: 'crashed',
            crashed_at: new Date(expectedCrashTimestamp).toISOString(),
            server_seed: round.server_seed, // Reveal seed on crash
          })
          .eq('id', round.id)
          .eq('status', 'flying'); // Only if still flying

        // Mark this bet as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost' })
          .eq('id', bet_id)
          .eq('status', 'active');

        console.log(`[${requestId}] CASHOUT_DENIED: Round crashed before cashout request`);
        return new Response(
          JSON.stringify({ 
            error: 'Round has already crashed', 
            crash_point: round.crash_point,
            request_id: requestId 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Double-check round status (may have been updated by another process)
    if (round.status !== 'flying') {
      console.log(`[${requestId}] ROUND_NOT_FLYING: status=${round.status}`);
      return new Response(
        JSON.stringify({ error: 'Cannot cash out - round is not in flight', status: round.status, request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow 25% tolerance for network latency and timing differences (increased from 20%)
    // Mobile devices especially need more tolerance
    const tolerance = 0.25;
    const multiplierDiff = Math.abs(current_multiplier - serverCalculatedMultiplier) / serverCalculatedMultiplier;
    
    if (multiplierDiff > tolerance) {
      console.warn(`[${requestId}] MULTIPLIER_MISMATCH_REJECTED: client=${current_multiplier}, server=${serverCalculatedMultiplier.toFixed(2)}, diff=${(multiplierDiff * 100).toFixed(1)}%, latency=${networkLatencyMs}ms`);
      return new Response(
        JSON.stringify({ 
          error: 'Multiplier validation failed - please try again',
          details: 'Your cashout timing may have been affected by network latency',
          server_multiplier: serverCalculatedMultiplier,
          network_latency_ms: networkLatencyMs,
          request_id: requestId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Use the MINIMUM of client and server multiplier (protect against manipulation)
    const validatedMultiplier = Math.min(current_multiplier, serverCalculatedMultiplier);
    
    // Round to 2 decimal places
    const finalMultiplier = Math.round(validatedMultiplier * 100) / 100;
    
    // Calculate winnings using validated multiplier
    const winnings = bet.bet_amount * finalMultiplier;

    // Update bet with optimistic locking
    const { data: updatedBet, error: updateError } = await supabase
      .from('game_bets')
      .update({
        cashed_out_at: finalMultiplier,
        winnings: winnings,
        status: 'won',
      })
      .eq('id', bet_id)
      .eq('status', 'active') // Optimistic locking - only update if still active
      .select()
      .single();

    if (updateError || !updatedBet) {
      console.error(`[${requestId}] BET_UPDATE_ERROR:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to process cashout. Bet may have already been processed.', request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] CASHOUT_SUCCESS`, {
      bet_id: bet_id.slice(0, 8),
      wallet: wallet_address.slice(0, 10),
      client_mult: current_multiplier,
      server_mult: serverCalculatedMultiplier.toFixed(4),
      final_mult: finalMultiplier,
      bet_amount: bet.bet_amount,
      winnings: winnings.toFixed(2),
    });

    // Insert audit log
    await supabase.from('game_audit_log').insert({
      event_type: 'CASHOUT',
      wallet_address: wallet_address.toLowerCase(),
      bet_id: bet_id,
      round_id: round.id,
      correlation_id: correlation_id || requestId,
      event_data: {
        round_number: round.round_number,
        client_multiplier: current_multiplier,
        server_multiplier: serverCalculatedMultiplier,
        final_multiplier: finalMultiplier,
        bet_amount: bet.bet_amount,
        winnings,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        server_time: serverTime,
        cashout: {
          bet_id: updatedBet.id,
          cashed_out_at: updatedBet.cashed_out_at,
          winnings: updatedBet.winnings,
          bet_amount: updatedBet.bet_amount,
          server_multiplier: serverCalculatedMultiplier,
          validated_multiplier: finalMultiplier,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${requestId}] INTERNAL_ERROR:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
