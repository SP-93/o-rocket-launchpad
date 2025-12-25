import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CRITICAL: This function saves the txHash to the database IMMEDIATELY after
 * the transaction is sent (before waiting for confirmation).
 * 
 * This ensures that even if the user refreshes or closes the page,
 * we have the txHash stored for recovery/verification.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, betId, txHash, nonce } = await req.json();

    console.log('[game-save-tx-hash] Request:', { walletAddress, betId, txHash, nonce });

    // Validate inputs
    if (!walletAddress || !betId || !txHash || nonce === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate txHash format (basic check)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction hash format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ATOMIC UPDATE: Only update if bet is in 'claiming' status AND nonce matches
    // This prevents race conditions and ensures we're saving for the correct claim attempt
    const { data: updateResult, error: updateError } = await supabase
      .from('game_bets')
      .update({
        claim_tx_hash: txHash,
      })
      .eq('id', betId)
      .eq('status', 'claiming')
      .eq('claim_nonce', nonce)
      .ilike('wallet_address', walletAddress) // Case-insensitive match
      .select('id, status, claim_nonce, claim_tx_hash');

    if (updateError) {
      console.error('[game-save-tx-hash] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save transaction hash' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if any rows were updated
    if (!updateResult || updateResult.length === 0) {
      // Check why it failed - fetch the bet to see current state
      const { data: bet } = await supabase
        .from('game_bets')
        .select('id, status, claim_nonce, claim_tx_hash, wallet_address')
        .eq('id', betId)
        .single();

      if (!bet) {
        console.warn('[game-save-tx-hash] Bet not found:', betId);
        return new Response(
          JSON.stringify({ error: 'Bet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If already has txHash and it matches, that's OK
      if (bet.claim_tx_hash === txHash) {
        console.log('[game-save-tx-hash] TxHash already saved (duplicate request)');
        return new Response(
          JSON.stringify({ success: true, message: 'TxHash already saved', duplicate: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If bet is already claimed, that's also OK
      if (bet.status === 'claimed') {
        console.log('[game-save-tx-hash] Bet already claimed');
        return new Response(
          JSON.stringify({ success: true, message: 'Already claimed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Otherwise there's a mismatch
      console.warn('[game-save-tx-hash] Mismatch:', {
        betStatus: bet.status,
        betNonce: bet.claim_nonce,
        requestNonce: nonce,
        betWallet: bet.wallet_address,
        requestWallet: walletAddress,
      });

      return new Response(
        JSON.stringify({ error: 'Bet state mismatch - cannot save txHash' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-save-tx-hash] Successfully saved txHash for bet:', betId, 'txHash:', txHash);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transaction hash saved',
        betId,
        txHash,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[game-save-tx-hash] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
