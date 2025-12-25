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
    const { wallet_address, admin_mode, admin_wallet, limit } = await req.json();
    
    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ADMIN MODE - fetch all tickets with stats
    if (admin_mode && admin_wallet) {
      console.log(`[game-get-tickets] Admin mode requested by: ${admin_wallet}`);
      
      // Verify admin status
      const { data: isAdmin, error: adminError } = await supabaseAdmin
        .rpc('is_wallet_admin', { _wallet_address: admin_wallet.toLowerCase() });
      
      if (adminError || !isAdmin) {
        console.error('[game-get-tickets] Not authorized as admin:', adminError);
        return new Response(
          JSON.stringify({ error: 'Not authorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch recent tickets (limited)
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('game_tickets')
        .select('id, wallet_address, payment_currency, payment_amount, ticket_value, created_at, is_used, expires_at')
        .order('created_at', { ascending: false })
        .limit(limit || 50);

      if (ticketsError) {
        console.error('[game-get-tickets] Error fetching tickets:', ticketsError);
        return new Response(
          JSON.stringify({ error: ticketsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    // Fetch ALL tickets for accurate stats (no limit)
    const { data: allTickets, error: statsError } = await supabaseAdmin
      .from('game_tickets')
      .select('payment_currency, payment_amount, ticket_value, is_used, expires_at');

    if (statsError) {
      console.error('[game-get-tickets] Error fetching stats:', statsError);
    }

    // Calculate detailed stats from ALL tickets
    const now = new Date();
    let totalWover = 0;
    let totalUsdt = 0;
    let activeCount = 0;
    let usedCount = 0;
    let expiredCount = 0;
    let activeValue = 0;

    (allTickets || []).forEach((t: any) => {
      // Payment totals
      if (t.payment_currency === 'WOVER') {
        totalWover += Number(t.payment_amount) || 0;
      } else if (t.payment_currency === 'USDT') {
        totalUsdt += Number(t.payment_amount) || 0;
      }
      
      // Ticket status counts
      const expiresAt = new Date(t.expires_at);
      if (t.is_used) {
        usedCount++;
      } else if (expiresAt < now) {
        expiredCount++;
      } else {
        activeCount++;
        activeValue += Number(t.ticket_value) || 0;
      }
    });

    console.log(`[game-get-tickets] Admin fetched ${tickets?.length || 0} tickets, total: ${allTickets?.length || 0}`);

    return new Response(
      JSON.stringify({ 
        tickets: tickets || [], 
        stats: {
          totalWover,
          totalUsdt,
          count: allTickets?.length || 0,
          activeCount,
          usedCount,
          expiredCount,
          activeValue
        },
        success: true 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }

    // NORMAL MODE - fetch tickets for specific wallet
    if (!wallet_address) {
      console.error('[game-get-tickets] Missing wallet_address');
      return new Response(
        JSON.stringify({ error: 'wallet_address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = wallet_address.toLowerCase();
    console.log(`[game-get-tickets] Fetching tickets for wallet: ${normalizedAddress}`);

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
