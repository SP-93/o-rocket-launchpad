import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();

    // Validate wallet address
    if (!wallet_address || typeof wallet_address !== 'string') {
      console.log('[game-pending-winnings] Missing wallet_address');
      return new Response(
        JSON.stringify({ success: false, error: 'wallet_address required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate wallet format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet_address)) {
      console.log('[game-pending-winnings] Invalid wallet format:', wallet_address);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid wallet address format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const normalizedAddress = wallet_address.toLowerCase();
    console.log('[game-pending-winnings] Fetching for wallet:', normalizedAddress);

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query pending winnings - status 'won' or 'claiming' with winnings > 0
    const { data, error } = await supabase
      .from('game_bets')
      .select('id, round_id, bet_amount, cashed_out_at, winnings, created_at, status')
      .ilike('wallet_address', normalizedAddress)
      .in('status', ['won', 'claiming'])
      .gt('winnings', 0)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[game-pending-winnings] DB error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const pendingWinnings = (data || []).filter(w => w.status === 'won');
    const claimingWinnings = (data || []).filter(w => w.status === 'claiming');
    const totalPending = pendingWinnings.reduce((sum, w) => sum + (w.winnings || 0), 0);

    console.log('[game-pending-winnings] Found:', {
      pending: pendingWinnings.length,
      claiming: claimingWinnings.length,
      total: totalPending
    });

    return new Response(
      JSON.stringify({
        success: true,
        pendingWinnings,
        claimingWinnings,
        totalPending
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[game-pending-winnings] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
