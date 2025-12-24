import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CrashGame ABI - only WinningsClaimed event
const CRASH_GAME_ABI = [
  "event WinningsClaimed(address indexed player, uint256 amount, bytes32 indexed roundId, uint256 nonce)"
];

// Rate limiting: 3 requests per 10 seconds per wallet
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 10000; // 10 seconds

function checkRateLimit(walletAddress: string): { allowed: boolean; remaining: number } {
  const key = walletAddress.toLowerCase();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, roundId, txHash, nonce, amount } = await req.json();

    console.log('[game-confirm-claim] Request:', { walletAddress, roundId, txHash, nonce, amount });

    // Validate inputs
    if (!walletAddress || !roundId || !txHash || nonce === undefined || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RATE LIMIT CHECK - Prevent spam/abuse
    const rateCheck = checkRateLimit(walletAddress);
    if (!rateCheck.allowed) {
      console.warn('[game-confirm-claim] Rate limited:', walletAddress);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait 10 seconds.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the bet exists and is in 'claiming' status
    const { data: bet, error: betError } = await supabase
      .from('game_bets')
      .select('*')
      .eq('round_id', roundId)
      .ilike('wallet_address', walletAddress)
      .single();

    if (betError || !bet) {
      console.error('[game-confirm-claim] Bet not found:', betError);
      return new Response(
        JSON.stringify({ error: 'Bet not found for this round' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already claimed
    if (bet.status === 'claimed') {
      console.log('[game-confirm-claim] Already claimed');
      return new Response(
        JSON.stringify({ success: true, message: 'Already claimed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Must be in 'claiming' status to confirm
    if (bet.status !== 'claiming') {
      console.error('[game-confirm-claim] Invalid status:', bet.status);
      return new Response(
        JSON.stringify({ error: `Invalid bet status: ${bet.status}. Expected 'claiming'` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify nonce matches what was set during sign-claim
    // This prevents replay attacks and ensures claim integrity
    const dbNonce = bet.claim_nonce;
    if (!dbNonce || dbNonce !== nonce) {
      console.error('[game-confirm-claim] Nonce mismatch:', { requestNonce: nonce, dbNonce });
      return new Response(
        JSON.stringify({ error: 'Nonce mismatch - claim session invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify amount matches expected winnings
    const expectedWinnings = bet.winnings || (bet.bet_amount * bet.cashed_out_at);
    const requestedAmount = parseFloat(amount);
    if (Math.abs(requestedAmount - expectedWinnings) > 0.01) {
      console.error('[game-confirm-claim] Amount mismatch:', { requestedAmount, expectedWinnings });
      return new Response(
        JSON.stringify({ error: 'Amount does not match winnings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get RPC URL for Over Protocol
    const rpcUrl = 'https://rpc.overprotocol.com';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

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
      console.error('[game-confirm-claim] Contract address not configured');
      return new Response(
        JSON.stringify({ error: 'Contract not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-confirm-claim] Verifying tx:', txHash, 'on contract:', contractAddress);

    // Get transaction receipt
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(txHash);
    } catch (rpcError) {
      console.error('[game-confirm-claim] RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transaction receipt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!receipt) {
      console.log('[game-confirm-claim] Transaction not yet mined');
      return new Response(
        JSON.stringify({ error: 'Transaction not yet confirmed', pending: true }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check transaction status
    if (receipt.status !== 1) {
      console.error('[game-confirm-claim] Transaction failed:', receipt);
      // Reset to 'won' so user can try again
      await supabase
        .from('game_bets')
        .update({ status: 'won', claiming_started_at: null, claim_nonce: null })
        .eq('id', bet.id);
      
      return new Response(
        JSON.stringify({ error: 'Transaction failed on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction was to the correct contract
    if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
      console.error('[game-confirm-claim] Wrong contract:', { expected: contractAddress, got: receipt.to });
      return new Response(
        JSON.stringify({ error: 'Transaction not to correct contract' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse logs to find WinningsClaimed event
    const iface = new ethers.utils.Interface(CRASH_GAME_ABI);
    const roundIdHash = ethers.utils.id(roundId);
    let foundValidEvent = false;
    let eventAmountWei: ethers.BigNumber | null = null;
    let eventNonceValue: number | null = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) {
        continue;
      }

      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog.name === 'WinningsClaimed') {
          const eventPlayer = parsedLog.args.player.toLowerCase();
          eventAmountWei = parsedLog.args.amount;
          const eventRoundId = parsedLog.args.roundId;
          eventNonceValue = parsedLog.args.nonce.toNumber();

          console.log('[game-confirm-claim] Found WinningsClaimed event:', {
            player: eventPlayer,
            amount: ethers.utils.formatEther(eventAmountWei!),
            roundId: eventRoundId,
            nonce: eventNonceValue,
          });

          // Verify all event data matches
          if (
            eventPlayer === walletAddress.toLowerCase() &&
            eventRoundId === roundIdHash
          ) {
            foundValidEvent = true;
            break;
          }
        }
      } catch {
        // Not a WinningsClaimed event, continue
      }
    }

    if (!foundValidEvent || !eventAmountWei || eventNonceValue === null) {
      console.error('[game-confirm-claim] No matching WinningsClaimed event found');
      return new Response(
        JSON.stringify({ error: 'No valid claim event found in transaction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify event nonce matches database nonce
    if (eventNonceValue !== dbNonce) {
      console.error('[game-confirm-claim] Event nonce mismatch:', { eventNonce: eventNonceValue, dbNonce });
      return new Response(
        JSON.stringify({ error: 'Event nonce does not match claim session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify event amount matches expected winnings
    const eventAmountEther = parseFloat(ethers.utils.formatEther(eventAmountWei));
    if (Math.abs(eventAmountEther - expectedWinnings) > 0.01) {
      console.error('[game-confirm-claim] Event amount mismatch:', { eventAmount: eventAmountEther, expectedWinnings });
      return new Response(
        JSON.stringify({ error: 'Event amount does not match expected winnings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All verifications passed - update status to 'claimed'
    const { error: updateError } = await supabase
      .from('game_bets')
      .update({
        status: 'claimed',
        claim_tx_hash: txHash,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', bet.id);

    if (updateError) {
      console.error('[game-confirm-claim] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update claim status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-confirm-claim] Successfully confirmed claim for bet:', bet.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Claim confirmed',
        txHash,
        claimedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[game-confirm-claim] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
