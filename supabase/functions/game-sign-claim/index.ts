import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 3 requests per 10 seconds per wallet
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 10000; // 10 seconds

// Chain ID for Over Protocol mainnet
const CHAIN_ID = 54176;
const RPC_URL = 'https://rpc.overprotocol.com';

// CRITICAL: usedClaims check - matches the smart contract
const CRASH_GAME_ABI = [
  "function usedClaims(bytes32) view returns (bool)"
];

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

// Helper: Calculate claim hash exactly as the contract does
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

// Helper: Check if a claim has already been used on-chain with retry logic
async function checkClaimUsedOnChain(
  contractAddress: string,
  claimHash: string,
  retries: number = 3
): Promise<{ used: boolean; error: boolean }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(contractAddress, CRASH_GAME_ABI, provider);
      const used = await contract.usedClaims(claimHash);
      return { used, error: false };
    } catch (e) {
      console.warn(`[game-sign-claim] RPC check attempt ${attempt}/${retries} failed:`, e);
      if (attempt < retries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  // All retries failed - return error state
  return { used: false, error: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, betId, amount, nonce } = await req.json();

    console.log('[game-sign-claim] Request:', { walletAddress, betId, amount, nonce });

    // Validate inputs
    if (!walletAddress || !betId || !amount || nonce === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RATE LIMIT CHECK - Prevent spam/abuse
    const rateCheck = checkRateLimit(walletAddress);
    if (!rateCheck.allowed) {
      console.warn('[game-sign-claim] Rate limited:', walletAddress);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait 10 seconds.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the bet exists and belongs to wallet
    const { data: bet, error: betError } = await supabase
      .from('game_bets')
      .select('*, game_rounds(*)')
      .eq('id', betId)
      .single();

    if (betError || !bet) {
      console.error('[game-sign-claim] Bet not found:', betError);
      return new Response(
        JSON.stringify({ error: 'Bet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bet.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn('[game-sign-claim] Wallet mismatch:', { betWallet: bet.wallet_address, walletAddress });
      return new Response(
        JSON.stringify({ error: 'Bet does not belong to this wallet' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roundId = bet.round_id as string;
    if (!roundId) {
      return new Response(
        JSON.stringify({ error: 'Bet missing round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player cashed out (won)
    if (!bet.cashed_out_at || bet.cashed_out_at <= 0) {
      return new Response(
        JSON.stringify({ error: 'Player did not cash out (lost)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify round is completed
    const round = bet.game_rounds;
    if (!round || (round.status !== 'crashed' && round.status !== 'payout')) {
      return new Response(
        JSON.stringify({ error: 'Round not completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use stored winnings or calculate from bet amount * multiplier
    const expectedWinnings = bet.winnings || (bet.bet_amount * bet.cashed_out_at);

    // Verify amount matches
    const requestedAmount = parseFloat(amount);
    if (Math.abs(requestedAmount - expectedWinnings) > 0.01) {
      console.error('[game-sign-claim] Amount mismatch:', { requestedAmount, expectedWinnings });
      return new Response(
        JSON.stringify({ error: 'Amount does not match winnings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already claimed
    if (bet.status === 'claimed') {
      return new Response(
        JSON.stringify({ error: 'Winnings already claimed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contract address from game_config
    const { data: configData } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'crash_game_v2_address')
      .single();

    let contractAddress = configData?.config_value;
    if (typeof contractAddress === 'string') {
      // Already a string
    } else if (contractAddress && typeof contractAddress === 'object') {
      contractAddress = (contractAddress as Record<string, string>).address || '';
    }

    if (!contractAddress) {
      console.error('[game-sign-claim] Contract address not configured');
      return new Response(
        JSON.stringify({ error: 'Contract not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-sign-claim] Using contract:', contractAddress);

    // CRITICAL FIX: If bet is in 'claiming' status, check if previous claim was successful on-chain
    if (bet.status === 'claiming') {
      console.log('[game-sign-claim] Bet already in claiming status, checking on-chain...');
      
      const previousNonce = bet.claim_nonce;
      const claimingStartedAt = bet.claiming_started_at ? new Date(bet.claiming_started_at).getTime() : 0;
      const ageMinutes = (Date.now() - claimingStartedAt) / (1000 * 60);

      // If we have a previous nonce, check if it was used on-chain
      if (previousNonce !== null && previousNonce !== undefined) {
        const roundIdHash = ethers.utils.id(roundId);
        const amountWei = ethers.utils.parseEther(requestedAmount.toFixed(18));
        
        const previousClaimHash = calculateClaimHash(
          walletAddress,
          amountWei,
          roundIdHash,
          previousNonce,
          contractAddress as string
        );

        console.log('[game-sign-claim] Checking previous claim hash:', previousClaimHash.substring(0, 20) + '...');

        const { used, error: rpcError } = await checkClaimUsedOnChain(contractAddress as string, previousClaimHash);

        if (rpcError) {
          // RPC failed - DO NOT issue new signature, it's not safe
          console.error('[game-sign-claim] Cannot verify on-chain status - refusing to issue signature');
          return new Response(
            JSON.stringify({ error: 'Cannot verify claim status. Please try again.' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (used) {
          // CRITICAL: Claim was already used on-chain! Update DB and return error
          console.log('[game-sign-claim] Previous claim was SUCCESSFUL on-chain! Marking as claimed...');
          
          await supabase
            .from('game_bets')
            .update({
              status: 'claimed',
              claimed_at: new Date().toISOString(),
            })
            .eq('id', bet.id);

          return new Response(
            JSON.stringify({ error: 'Winnings already claimed on-chain' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Claim not used on-chain
        if (ageMinutes < 5) {
          // Still fresh - another transaction might be pending
          console.log('[game-sign-claim] Claiming in progress, age:', ageMinutes.toFixed(1), 'min');
          return new Response(
            JSON.stringify({ error: 'Claim in progress. Please wait for transaction to complete.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // More than 5 minutes AND not used on-chain - safe to reset and allow new claim
        console.log('[game-sign-claim] Previous claim timed out (', ageMinutes.toFixed(1), 'min), allowing new claim');
        
        // Reset the bet to 'won' first, then proceed to lock with new nonce
        const { error: resetError } = await supabase
          .from('game_bets')
          .update({
            status: 'won',
            claim_nonce: null,
            claiming_started_at: null,
            claim_tx_hash: null,
          })
          .eq('id', bet.id);

        if (resetError) {
          console.error('[game-sign-claim] Failed to reset bet:', resetError);
          return new Response(
            JSON.stringify({ error: 'Failed to reset stuck claim' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // No previous nonce - this shouldn't happen but handle it
        if (ageMinutes < 5) {
          return new Response(
            JSON.stringify({ error: 'Claim in progress' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Reset stuck claim without nonce
        await supabase
          .from('game_bets')
          .update({
            status: 'won',
            claim_nonce: null,
            claiming_started_at: null,
            claim_tx_hash: null,
          })
          .eq('id', bet.id);
      }
    }

    // ATOMIC LOCK: Change status to 'claiming' ONLY if status is 'won'
    const { data: lockResult, error: lockError } = await supabase
      .from('game_bets')
      .update({ 
        status: 'claiming',
        claim_nonce: nonce,
        claiming_started_at: new Date().toISOString(),
        claim_tx_hash: null, // Reset any stale txHash
      })
      .eq('id', bet.id)
      .eq('status', 'won')  // Critical: Only update if status is still 'won'
      .select();

    if (lockError) {
      console.error('[game-sign-claim] Lock error:', lockError);
      return new Response(
        JSON.stringify({ error: 'Failed to lock claim' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no rows were updated, another process already started claiming
    if (!lockResult || lockResult.length === 0) {
      console.log('[game-sign-claim] Race condition detected - bet already being claimed');
      return new Response(
        JSON.stringify({ error: 'Claim already in progress or status changed' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-sign-claim] Successfully locked bet for claiming:', bet.id, 'with nonce:', nonce);

    // Get private key for signing
    const privateKey = Deno.env.get('CLAIM_SINGER_KEY');
    if (!privateKey) {
      console.error('[game-sign-claim] CLAIM_SINGER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signer from private key
    const signer = new ethers.Wallet(privateKey);
    console.log('[game-sign-claim] Signer address:', signer.address);

    // Convert amount to wei (18 decimals)
    const amountWei = ethers.utils.parseEther(requestedAmount.toFixed(18));
    
    // Hash the roundId to bytes32
    const roundIdHash = ethers.utils.id(roundId);

    // Create message hash matching contract logic:
    // keccak256(abi.encodePacked(player, amount, roundId, nonce, block.chainid, address(this)))
    const messageHash = calculateClaimHash(
      walletAddress,
      amountWei,
      roundIdHash,
      nonce,
      contractAddress as string
    );

    console.log('[game-sign-claim] Message hash:', messageHash);

    // Sign the message
    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));

    console.log('[game-sign-claim] Signature generated:', signature.substring(0, 20) + '...');

    const claimData = {
      player: walletAddress.toLowerCase(),
      amount: amountWei.toString(),
      roundId: roundIdHash,
      nonce: nonce,
      chainId: CHAIN_ID,
      contractAddress: (contractAddress as string).toLowerCase(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        claimData,
        signature,
        signerAddress: signer.address,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[game-sign-claim] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
