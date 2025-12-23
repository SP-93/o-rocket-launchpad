import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Provably fair crash point generation
function generateCrashPoint(serverSeed: string): number {
  // Convert seed to hash
  const encoder = new TextEncoder();
  const data = encoder.encode(serverSeed);
  
  // Simple hash-based random number
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // 3% chance of instant crash (x1.00)
  const instantCrashCheck = Math.abs(hash % 100);
  if (instantCrashCheck < 3) {
    return 1.00;
  }
  
  // Generate crash point between 1.01 and 10.00
  // Using exponential distribution for more 1.x crashes
  const normalizedHash = Math.abs(hash % 10000) / 10000;
  
  // Exponential distribution: more low values, fewer high values
  // Formula creates a curve where ~50% crash before 2x, ~20% reach 5x+
  const crashPoint = 1 + (Math.pow(1.05, normalizedHash * 100) - 1) / 10;
  
  // Clamp to max 10.00
  return Math.min(Math.round(crashPoint * 100) / 100, 10.00);
}

// Generate server seed
function generateServerSeed(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash server seed for pre-commitment
async function hashSeed(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'start_round': {
        // Check if game is active
        const { data: gameStatus } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'game_status')
          .single();

        if (!gameStatus?.config_value?.active) {
          return new Response(
            JSON.stringify({ error: 'Game is paused' }),
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
          // Auto-pause game
          await supabase
            .from('game_config')
            .update({ config_value: { active: false, reason: 'Low prize pool' } })
            .eq('config_key', 'game_status');

          return new Response(
            JSON.stringify({ error: 'Game auto-paused: Prize pool below threshold' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate server seed and hash
        const serverSeed = generateServerSeed();
        const serverSeedHash = await hashSeed(serverSeed);

        // Create new round
        const { data: round, error: roundError } = await supabase
          .from('game_rounds')
          .insert({
            status: 'betting',
            server_seed_hash: serverSeedHash,
            server_seed: serverSeed, // Will be revealed after crash
            crash_point: generateCrashPoint(serverSeed),
          })
          .select()
          .single();

        if (roundError) {
          console.error('Error creating round:', roundError);
          return new Response(
            JSON.stringify({ error: 'Failed to create round' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`New round started: ${round.id}, hash: ${serverSeedHash}`);

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
        const { round_id } = await req.json();

        const { error } = await supabase
          .from('game_rounds')
          .update({ status: 'countdown', started_at: new Date().toISOString() })
          .eq('id', round_id)
          .eq('status', 'betting');

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to start countdown' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, status: 'countdown' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'start_flying': {
        const { round_id } = await req.json();

        const { error } = await supabase
          .from('game_rounds')
          .update({ status: 'flying' })
          .eq('id', round_id)
          .eq('status', 'countdown');

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to start flying' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, status: 'flying' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process_auto_cashouts': {
        const { round_id, current_multiplier } = await req.json();

        // Find all active bets with auto_cashout_at <= current_multiplier
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

        return new Response(
          JSON.stringify({ success: true, processed: autoCashouts?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'crash': {
        const { round_id } = await req.json();

        // Get round data
        const { data: round } = await supabase
          .from('game_rounds')
          .select('*')
          .eq('id', round_id)
          .single();

        if (!round) {
          return new Response(
            JSON.stringify({ error: 'Round not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark round as crashed
        await supabase
          .from('game_rounds')
          .update({ 
            status: 'crashed', 
            crashed_at: new Date().toISOString() 
          })
          .eq('id', round_id);

        // Mark all active bets as lost
        await supabase
          .from('game_bets')
          .update({ status: 'lost', winnings: 0 })
          .eq('round_id', round_id)
          .eq('status', 'active');

        console.log(`Round ${round_id} crashed at ${round.crash_point}`);

        return new Response(
          JSON.stringify({
            success: true,
            crash_point: round.crash_point,
            server_seed: round.server_seed, // Reveal for verification
            server_seed_hash: round.server_seed_hash,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process_payouts': {
        const { round_id } = await req.json();

        // Get all winning bets
        const { data: winningBets } = await supabase
          .from('game_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('status', 'won');

        let totalPayouts = 0;
        if (winningBets) {
          totalPayouts = winningBets.reduce((sum, bet) => sum + (bet.winnings || 0), 0);
        }

        // Update round with total payouts
        await supabase
          .from('game_rounds')
          .update({ 
            status: 'payout',
            total_payouts: totalPayouts 
          })
          .eq('id', round_id);

        // Deduct from prize pool
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

        console.log(`Round ${round_id} payouts processed: ${totalPayouts} WOVER`);

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
    console.error('Error in game-round-manager:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
