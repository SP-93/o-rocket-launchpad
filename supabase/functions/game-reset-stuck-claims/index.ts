import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reset 'claiming' bets back to 'won' if stuck for more than 5 minutes
const STUCK_TIMEOUT_MINUTES = 5;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[game-reset-stuck-claims] Starting cleanup...');

    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - STUCK_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // Find stuck claims: status='claiming', claim_tx_hash is null, claiming_started_at < cutoff
    const { data: stuckBets, error: fetchError } = await supabase
      .from('game_bets')
      .select('id, wallet_address, round_id, claiming_started_at')
      .eq('status', 'claiming')
      .is('claim_tx_hash', null)
      .lt('claiming_started_at', cutoffTime);

    if (fetchError) {
      console.error('[game-reset-stuck-claims] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stuck claims' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stuckBets || stuckBets.length === 0) {
      console.log('[game-reset-stuck-claims] No stuck claims found');
      return new Response(
        JSON.stringify({ success: true, message: 'No stuck claims found', reset: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[game-reset-stuck-claims] Found ${stuckBets.length} stuck claims`);

    // Reset each stuck claim
    const resetIds = stuckBets.map(b => b.id);
    const { error: updateError, count } = await supabase
      .from('game_bets')
      .update({
        status: 'won',
        claiming_started_at: null,
        claim_nonce: null,
      })
      .in('id', resetIds);

    if (updateError) {
      console.error('[game-reset-stuck-claims] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset stuck claims' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[game-reset-stuck-claims] Reset ${count || stuckBets.length} claims`);

    // Log details of reset claims
    for (const bet of stuckBets) {
      console.log(`[game-reset-stuck-claims] Reset bet ${bet.id} for wallet ${bet.wallet_address}, round ${bet.round_id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset ${stuckBets.length} stuck claims`,
        reset: stuckBets.length,
        resetBets: stuckBets.map(b => ({ id: b.id, round_id: b.round_id })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[game-reset-stuck-claims] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});