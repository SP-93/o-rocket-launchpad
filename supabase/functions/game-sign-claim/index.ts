import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Keccak256 placeholder - in production use proper library
async function hashData(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

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
    if (!round || round.status !== 'crashed' && round.status !== 'payout') {
      return new Response(
        JSON.stringify({ error: 'Round not completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expected winnings
    const betAmount = bet.bet_amount || 0;
    const cashedOutAt = bet.cashed_out_at || 1;
    const expectedWinnings = betAmount * (cashedOutAt / 100);

    // Verify amount matches
    const requestedAmount = parseFloat(amount);
    if (Math.abs(requestedAmount - expectedWinnings) > 0.01) {
      console.error('[game-sign-claim] Amount mismatch:', { requestedAmount, expectedWinnings });
      return new Response(
        JSON.stringify({ error: 'Amount does not match winnings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get private key for signing
    const privateKey = Deno.env.get('CLAIM_SINGER_KEY');
    if (!privateKey) {
      console.error('[game-sign-claim] CLAIM_SINGER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert amount to wei (18 decimals)
    const amountWei = BigInt(Math.floor(requestedAmount * 1e18)).toString();

    // Create message hash matching contract logic
    // Contract: keccak256(abi.encodePacked(player, amount, roundId, nonce, block.chainid, address(this)))
    // We'll return the raw values and let the frontend construct the final hash
    
    // For now, return the claim data that frontend will use
    // The actual signature will be generated when we have ethers.js available
    
    const claimData = {
      player: walletAddress.toLowerCase(),
      amount: amountWei,
      roundId: roundId,
      nonce: nonce,
      chainId: 54176, // Over Protocol mainnet
      // Contract address will be added by frontend
    };

    console.log('[game-sign-claim] Claim data prepared:', claimData);

    // NOTE: For full implementation, you need an ethers.js compatible signing library for Deno
    // For now, return claim data and handle signing differently
    // In production, use a library like https://deno.land/x/web3 or call an external signing service

    return new Response(
      JSON.stringify({
        success: true,
        claimData,
        message: 'Claim data prepared. Signature generation requires ethers.js integration.',
        // The signature would be generated here in production
        signature: null, // Placeholder - implement proper signing
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
