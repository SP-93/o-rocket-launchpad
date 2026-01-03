import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

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
    const { wallet_address, nickname, signature, nonce } = await req.json();

    // Validate inputs
    if (!wallet_address || !nickname || !signature || !nonce) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: wallet_address, nickname, signature, nonce' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate nickname format (3-20 chars, alphanumeric + underscore)
    const nicknameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!nicknameRegex.test(nickname)) {
      return new Response(
        JSON.stringify({ error: 'Nickname must be 3-20 characters, alphanumeric and underscore only' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const message = `Set nickname to "${nickname}" for oRocket chat.\n\nNonce: ${nonce}`;
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (e) {
      console.error('Signature verification failed:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check recovered address matches
    if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Signature does not match wallet address' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if nickname is already taken (case-insensitive)
    const { data: existingProfile, error: checkError } = await supabase
      .from('chat_profiles')
      .select('wallet_address')
      .ilike('nickname', nickname)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database check error:', checkError);
      throw checkError;
    }

    // If nickname exists and belongs to different wallet, reject
    if (existingProfile && existingProfile.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Nickname already taken' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert profile
    const { data: profile, error: upsertError } = await supabase
      .from('chat_profiles')
      .upsert({
        wallet_address: wallet_address.toLowerCase(),
        nickname,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      // Check for unique constraint violation
      if (upsertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Nickname already taken' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw upsertError;
    }

    console.log(`Nickname set: ${wallet_address} -> ${nickname}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: {
          wallet_address: profile.wallet_address,
          nickname: profile.nickname,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in set-chat-nickname:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
