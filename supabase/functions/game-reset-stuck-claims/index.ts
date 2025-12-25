import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reset 'claiming' bets back to 'won' if stuck for more than 5 minutes
const STUCK_TIMEOUT_MINUTES = 5;

// Chain ID for Over Protocol mainnet
const CHAIN_ID = 54176;

// CRITICAL FIX: Use usedClaims (not usedNonces) - matches the smart contract
const CRASH_GAME_ABI = [
  "function usedClaims(bytes32) view returns (bool)"
];

// RPC endpoints with fallback
const RPC_ENDPOINTS = [
  'https://rpc.overprotocol.com',
  'https://rpc.overprotocol.com' // Same for now, but could add backup
];

// Helper: Check claim on-chain with retry logic
async function checkClaimOnChainWithRetry(
  contractAddress: string,
  claimHash: string,
  maxRetries: number = 3
): Promise<{ used: boolean | null; error: string | null }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        // Set timeout for the provider call
        const contract = new ethers.Contract(contractAddress, CRASH_GAME_ABI, provider);
        
        // Use Promise.race to add timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout')), 10000)
        );
        
        const checkPromise = contract.usedClaims(claimHash);
        const used = await Promise.race([checkPromise, timeoutPromise]) as boolean;
        
        return { used, error: null };
      } catch (e) {
        console.warn(`[game-reset-stuck-claims] RPC attempt ${attempt}/${maxRetries} failed for ${rpcUrl}:`, e);
      }
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
    }
  }
  
  return { used: null, error: 'All RPC attempts failed' };
}

// Helper: Calculate claim hash exactly as game-sign-claim does
function calculateClaimHash(
  walletAddress: string,
  amountWei: ethers.BigNumber,
  roundIdHash: string,
  nonce: number,
  contractAddress: string
): string {
  return ethers.utils.solidityKeccak256(
    ['address', 'uint256', 'bytes32', 'uint256', 'uint256', 'address'],
    [
      walletAddress.toLowerCase(),
      amountWei,
      roundIdHash,
      nonce,
      CHAIN_ID,
      contractAddress.toLowerCase()
    ]
  );
}

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

    // Find stuck claims: status='claiming', claiming_started_at < cutoff
    const { data: stuckBets, error: fetchError } = await supabase
      .from('game_bets')
      .select('id, wallet_address, round_id, claiming_started_at, claim_nonce, winnings, claim_tx_hash')
      .eq('status', 'claiming')
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
        JSON.stringify({ success: true, message: 'No stuck claims found', reset: 0, confirmed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[game-reset-stuck-claims] Found ${stuckBets.length} stuck claims`);

    // Get contract address from game_config
    const { data: configData } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'crash_game_v2_address')
      .single();

    let contractAddress = configData?.config_value;
    if (typeof contractAddress === 'object' && contractAddress !== null) {
      contractAddress = (contractAddress as Record<string, string>).address || '';
    }

    if (!contractAddress) {
      console.warn('[game-reset-stuck-claims] No contract address configured - cannot verify on-chain');
      return new Response(
        JSON.stringify({ error: 'Contract not configured', reset: 0, confirmed: 0, skipped: stuckBets.length }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-reset-stuck-claims] Contract:', contractAddress);

    const resetIds: string[] = [];
    const confirmedIds: string[] = [];
    const skippedIds: string[] = [];

    // Process each stuck bet
    for (const bet of stuckBets) {
      console.log(`[game-reset-stuck-claims] Processing bet ${bet.id}...`);

      // CRITICAL: We must have all required data to verify on-chain
      if (!bet.claim_nonce || !bet.wallet_address || !bet.round_id || !bet.winnings) {
        console.warn(`[game-reset-stuck-claims] Bet ${bet.id} missing required data, skipping`);
        skippedIds.push(bet.id);
        continue;
      }

      // Calculate the claim hash
      const amountWei = ethers.utils.parseEther(bet.winnings.toString());
      const roundIdHash = ethers.utils.id(bet.round_id);
      const claimHash = calculateClaimHash(
        bet.wallet_address,
        amountWei,
        roundIdHash,
        bet.claim_nonce,
        contractAddress as string
      );

      console.log(`[game-reset-stuck-claims] Bet ${bet.id} claim hash: ${claimHash.substring(0, 20)}...`);

      // Check on-chain status with retry
      const { used, error: rpcError } = await checkClaimOnChainWithRetry(contractAddress as string, claimHash);

      if (rpcError) {
        // CRITICAL: RPC verification failed - DO NOT RESET
        // This is the key fix: never reset without confirmed on-chain status
        console.error(`[game-reset-stuck-claims] RPC check failed for bet ${bet.id} - NOT resetting (safety)`);
        skippedIds.push(bet.id);
        continue;
      }

      if (used) {
        // Claim was used on-chain - this claim succeeded, confirm it
        console.log(`[game-reset-stuck-claims] Bet ${bet.id} was claimed ON-CHAIN, confirming...`);
        
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
          skippedIds.push(bet.id);
        } else {
          confirmedIds.push(bet.id);
          console.log(`[game-reset-stuck-claims] ✓ Confirmed bet ${bet.id} as claimed`);
        }
      } else {
        // Claim NOT used on-chain - safe to reset to 'won'
        console.log(`[game-reset-stuck-claims] Bet ${bet.id} NOT claimed on-chain, resetting to 'won'...`);
        
        const { error: resetError } = await supabase
          .from('game_bets')
          .update({
            status: 'won',
            claiming_started_at: null,
            claim_nonce: null,
            claim_tx_hash: null,
          })
          .eq('id', bet.id);

        if (resetError) {
          console.error(`[game-reset-stuck-claims] Failed to reset bet ${bet.id}:`, resetError);
          skippedIds.push(bet.id);
        } else {
          resetIds.push(bet.id);
          console.log(`[game-reset-stuck-claims] ✓ Reset bet ${bet.id} to 'won'`);
        }
      }
    }

    // Summary logging
    console.log(`[game-reset-stuck-claims] SUMMARY:`);
    console.log(`  - Reset to 'won': ${resetIds.length}`);
    console.log(`  - Confirmed as 'claimed': ${confirmedIds.length}`);
    console.log(`  - Skipped (verification failed): ${skippedIds.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stuckBets.length} stuck claims`,
        reset: resetIds.length,
        confirmed: confirmedIds.length,
        skipped: skippedIds.length,
        resetBets: resetIds,
        confirmedBets: confirmedIds,
        skippedBets: skippedIds,
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
