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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { signature, message, walletAddress } = await req.json();

    if (!signature || !message || !walletAddress) {
      console.error('Missing required fields:', { signature: !!signature, message: !!message, walletAddress: !!walletAddress });
      return new Response(
        JSON.stringify({ error: 'Missing signature, message, or walletAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying signature for wallet:', walletAddress);

    // Verify the signature using ethers.js
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
      console.log('Recovered address:', recoveredAddress);
    } catch (sigError) {
      console.error('Signature verification failed:', sigError);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if recovered address matches the claimed wallet address
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      console.error('Address mismatch:', { recovered: recoveredAddress, claimed: walletAddress });
      return new Response(
        JSON.stringify({ error: 'Signature does not match wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the message contains expected content (nonce and timestamp)
    const messagePattern = /RocketSwap Wallet Verification\nNonce: [a-f0-9]+\nTimestamp: \d+/;
    if (!messagePattern.test(message)) {
      console.error('Invalid message format:', message);
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract timestamp and check if message is not too old (5 minutes)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const messageTimestamp = parseInt(timestampMatch[1]);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - messageTimestamp > fiveMinutes) {
        console.error('Message expired:', { messageTimestamp, now });
        return new Response(
          JSON.stringify({ error: 'Signature expired, please try again' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if wallet is already linked to another user
    const { data: existingWallet, error: checkError } = await supabase
      .from('user_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing wallet:', checkError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingWallet && existingWallet.user_id !== user.id) {
      console.error('Wallet already linked to another user');
      return new Response(
        JSON.stringify({ error: 'This wallet is already linked to another account' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If wallet already linked to this user, just return success
    if (existingWallet && existingWallet.user_id === user.id) {
      console.log('Wallet already linked to this user');
      return new Response(
        JSON.stringify({ success: true, message: 'Wallet already linked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new wallet link
    const { error: insertError } = await supabase
      .from('user_wallets')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress.toLowerCase(),
        verified_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting wallet:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to link wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Wallet linked successfully:', walletAddress);

    return new Response(
      JSON.stringify({ success: true, message: 'Wallet linked successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
