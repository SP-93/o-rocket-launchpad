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
    
    if (!wallet_address) {
      console.error('[game-get-tickets] Missing wallet_address');
      return new Response(
        JSON.stringify({ error: 'wallet_address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = wallet_address.toLowerCase();
    console.log(`[game-get-tickets] Fetching tickets for wallet: ${normalizedAddress}`);

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all tickets for this wallet
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('game_tickets')
      .select('*')
      .eq('wallet_address', normalizedAddress)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      console.error('[game-get-tickets] Error fetching tickets:', ticketsError);
      return new Response(
        JSON.stringify({ error: ticketsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter available tickets (not used, not expired)
    const now = new Date();
    const availableTickets = (tickets || []).filter(
      (t: any) => !t.is_used && new Date(t.expires_at) > now
    );

    console.log(`[game-get-tickets] Found ${tickets?.length || 0} total, ${availableTickets.length} available`);

    return new Response(
      JSON.stringify({ 
        tickets: tickets || [], 
        availableTickets,
        success: true 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[game-get-tickets] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
