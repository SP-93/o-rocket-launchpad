import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reset 'claiming' bets back to 'won' if stuck for more than 5 minutes
const STUCK_TIMEOUT_MINUTES = 5;

// Minimal ABI for checking if nonce was used
const CRASH_GAME_ABI = [
  "function usedNonces(bytes32) view returns (bool)"
];

// RPC endpoint for OverProtocol
const RPC_URL = 'https://rpc.overprotocol.com';

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
      .select('id, wallet_address, round_id, claiming_started_at, claim_nonce, winnings')
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
        JSON.stringify({ success: true, message: 'No stuck claims found', reset: 0, confirmed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[game-reset-stuck-claims] Found ${stuckBets.length} stuck claims`);

    // Get contract address from protocol config
    const { data: configData } = await supabase
      .from('protocol_config')
      .select('config_value')
      .eq('config_key', 'crash_game_address')
      .maybeSingle();

    const contractAddress = configData?.config_value;
    
    let provider: ethers.providers.JsonRpcProvider | null = null;
    let contract: ethers.Contract | null = null;
    
    if (contractAddress) {
      try {
        provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        contract = new ethers.Contract(contractAddress as string, CRASH_GAME_ABI, provider);
      } catch (e) {
        console.warn('[game-reset-stuck-claims] Failed to init contract:', e);
      }
    }

    const resetIds: string[] = [];
    const confirmedIds: string[] = [];

    // Process each stuck bet
    for (const bet of stuckBets) {
      let wasUsedOnChain = false;

      // If we have contract and nonce, check on-chain status
      if (contract && bet.claim_nonce && bet.wallet_address) {
        try {
          // Compute the nonce hash as contract does
          const nonceHash = ethers.utils.solidityKeccak256(
            ['address', 'uint256'],
            [bet.wallet_address, bet.claim_nonce]
          );
          
          wasUsedOnChain = await contract.usedNonces(nonceHash);
          console.log(`[game-reset-stuck-claims] Bet ${bet.id} nonce ${bet.claim_nonce} used on-chain: ${wasUsedOnChain}`);
        } catch (e) {
          console.warn(`[game-reset-stuck-claims] Failed to check nonce for bet ${bet.id}:`, e);
        }
      }

      if (wasUsedOnChain) {
        // Nonce was used - this claim succeeded on-chain, confirm it
        console.log(`[game-reset-stuck-claims] Bet ${bet.id} was claimed on-chain, confirming...`);
        
        const { error: confirmError } = await supabase
          .from('game_bets')
          .update({
            status: 'claimed',
            claimed_at: new Date().toISOString(),
            // Note: we don't have txHash here, but status is correct
          })
          .eq('id', bet.id);

        if (confirmError) {
          console.error(`[game-reset-stuck-claims] Failed to confirm bet ${bet.id}:`, confirmError);
        } else {
          confirmedIds.push(bet.id);
        }
      } else {
        // Nonce not used - safe to reset to 'won'
        resetIds.push(bet.id);
      }
    }

    // Reset bets that were not claimed on-chain
    if (resetIds.length > 0) {
      const { error: updateError } = await supabase
        .from('game_bets')
        .update({
          status: 'won',
          claiming_started_at: null,
          claim_nonce: null,
        })
        .in('id', resetIds);

      if (updateError) {
        console.error('[game-reset-stuck-claims] Update error:', updateError);
      } else {
        console.log(`[game-reset-stuck-claims] Reset ${resetIds.length} claims`);
      }
    }

    // Log details
    for (const bet of stuckBets) {
      if (resetIds.includes(bet.id)) {
        console.log(`[game-reset-stuck-claims] Reset bet ${bet.id} for wallet ${bet.wallet_address}`);
      } else if (confirmedIds.includes(bet.id)) {
        console.log(`[game-reset-stuck-claims] Confirmed bet ${bet.id} for wallet ${bet.wallet_address}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset ${resetIds.length} claims, confirmed ${confirmedIds.length} on-chain claims`,
        reset: resetIds.length,
        confirmed: confirmedIds.length,
        resetBets: resetIds,
        confirmedBets: confirmedIds,
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