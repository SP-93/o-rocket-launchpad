import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, limit = 50, offset = 0 } = await req.json();
    
    if (!wallet_address) {
      return new Response(
        JSON.stringify({ success: false, error: 'wallet_address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HISTORY] Fetching for wallet: ${wallet_address.slice(0, 10)}...`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const walletLower = wallet_address.toLowerCase();

    // Fetch all history data in parallel
    const [ticketsResult, betsResult, auditResult] = await Promise.all([
      // All tickets (including used/expired)
      supabase
        .from('game_tickets')
        .select('*')
        .eq('wallet_address', walletLower)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      
      // All bets with round info
      supabase
        .from('game_bets')
        .select(`
          *,
          game_rounds (
            round_number,
            crash_point,
            crashed_at
          )
        `)
        .eq('wallet_address', walletLower)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      
      // Recent audit events
      supabase
        .from('game_audit_log')
        .select('*')
        .eq('wallet_address', walletLower)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

    // Calculate stats
    const bets = betsResult.data || [];
    const tickets = ticketsResult.data || [];
    
    const stats = {
      total_bets: bets.length,
      total_wins: bets.filter((b: any) => b.status === 'won').length,
      total_losses: bets.filter((b: any) => b.status === 'lost').length,
      total_wagered: bets.reduce((sum: number, b: any) => sum + (b.bet_amount || 0), 0),
      total_winnings: bets.reduce((sum: number, b: any) => sum + (b.winnings || 0), 0),
      total_claimed: bets.filter((b: any) => b.claimed_at).reduce((sum: number, b: any) => sum + (b.winnings || 0), 0),
      best_multiplier: Math.max(...bets.filter((b: any) => b.cashed_out_at).map((b: any) => b.cashed_out_at), 0),
      total_tickets_purchased: tickets.length,
      total_tickets_used: tickets.filter((t: any) => t.is_used).length,
      total_tickets_expired: tickets.filter((t: any) => !t.is_used && new Date(t.expires_at) < new Date()).length
    };

    // Format bets with additional info
    const formattedBets = bets.map((bet: any) => ({
      id: bet.id,
      round_number: bet.game_rounds?.round_number,
      bet_amount: bet.bet_amount,
      status: bet.status,
      auto_cashout_at: bet.auto_cashout_at,
      cashed_out_at: bet.cashed_out_at,
      winnings: bet.winnings,
      crash_point: bet.game_rounds?.crash_point,
      claimed_at: bet.claimed_at,
      claim_tx_hash: bet.claim_tx_hash,
      created_at: bet.created_at,
      profit: bet.status === 'won' ? (bet.winnings || 0) - bet.bet_amount : -bet.bet_amount
    }));

    // Format tickets with status
    const formattedTickets = tickets.map((ticket: any) => {
      const now = new Date();
      const expiresAt = new Date(ticket.expires_at);
      let status = 'active';
      if (ticket.is_used) status = 'used';
      else if (expiresAt < now) status = 'expired';
      
      return {
        id: ticket.id,
        serial_number: ticket.serial_number,
        ticket_value: ticket.ticket_value,
        payment_amount: ticket.payment_amount,
        payment_currency: ticket.payment_currency,
        tx_hash: ticket.tx_hash,
        status,
        expires_at: ticket.expires_at,
        used_in_round: ticket.used_in_round,
        created_at: ticket.created_at
      };
    });

    console.log(`[HISTORY] Found ${bets.length} bets, ${tickets.length} tickets for wallet`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        bets: formattedBets,
        tickets: formattedTickets,
        audit_log: auditResult.data || [],
        pagination: {
          offset,
          limit,
          has_more: bets.length === limit || tickets.length === limit
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HISTORY] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
