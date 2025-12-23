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

    // Validate multiplier
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

    // Get bet
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

    // Calculate winnings
    const winnings = bet.bet_amount * current_multiplier;

    // Update bet
    const { data: updatedBet, error: updateError } = await supabase
      .from('game_bets')
      .update({
        cashed_out_at: current_multiplier,
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

    console.log(`Cashout successful: ${bet_id} by ${wallet_address}, multiplier: ${current_multiplier}, winnings: ${winnings}`);

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
