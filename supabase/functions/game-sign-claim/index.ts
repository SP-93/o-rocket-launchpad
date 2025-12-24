import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, roundId, amount, nonce } = await req.json();

    console.log('[game-sign-claim] Request:', { walletAddress, roundId, amount, nonce });

    // Validate inputs
    if (!walletAddress || !roundId || !amount || nonce === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the bet exists and player won
    const { data: bet, error: betError } = await supabase
      .from('game_bets')
      .select('*, game_rounds(*)')
      .eq('round_id', roundId)
      .ilike('wallet_address', walletAddress)
      .single();

    if (betError || !bet) {
      console.error('[game-sign-claim] Bet not found:', betError);
      return new Response(
        JSON.stringify({ error: 'Bet not found for this round' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    // Note: cashed_out_at is already the multiplier (e.g., 1.45x), not a percentage
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

    // Check if already claimed or claiming
    if (bet.status === 'claimed') {
      return new Response(
        JSON.stringify({ error: 'Winnings already claimed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bet.status === 'claiming') {
      return new Response(
        JSON.stringify({ error: 'Claim already in progress' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ATOMIC LOCK: Change status to 'claiming' ONLY if still 'won'
    // This prevents race conditions where multiple signatures could be generated
    const { data: lockResult, error: lockError } = await supabase
      .from('game_bets')
      .update({ status: 'claiming' })
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

    console.log('[game-sign-claim] Successfully locked bet for claiming:', bet.id);

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
    
    // Chain ID for Over Protocol mainnet
    const chainId = 54176;

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

    // Create message hash matching contract logic:
    // keccak256(abi.encodePacked(player, amount, roundId, nonce, block.chainid, address(this)))
    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'bytes32', 'uint256', 'uint256', 'address'],
      [
        walletAddress.toLowerCase(),
        amountWei,
        roundIdHash,
        nonce,
        chainId,
        contractAddress.toLowerCase()
      ]
    );

    console.log('[game-sign-claim] Message hash:', messageHash);

    // Create Ethereum Signed Message hash (adds prefix)
    const ethSignedMessageHash = ethers.utils.hashMessage(ethers.utils.arrayify(messageHash));

    // Sign the message
    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));

    console.log('[game-sign-claim] Signature generated:', signature.substring(0, 20) + '...');

    const claimData = {
      player: walletAddress.toLowerCase(),
      amount: amountWei.toString(),
      roundId: roundIdHash,
      nonce: nonce,
      chainId: chainId,
      contractAddress: contractAddress.toLowerCase(),
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
