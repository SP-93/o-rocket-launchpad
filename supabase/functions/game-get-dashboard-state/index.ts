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
    const { wallet_address, correlation_id } = await req.json();
    
    console.log(`[DASHBOARD:${correlation_id || 'unknown'}] Fetching state for wallet: ${wallet_address?.slice(0, 10)}...`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const serverTime = new Date().toISOString();
    
    // Fetch all data in parallel for maximum efficiency
    const [
      currentRoundResult,
      ticketsResult,
      pendingWinningsResult,
      recentHistoryResult,
      myBetsResult
    ] = await Promise.all([
      // Current round (latest active or betting)
      supabase
        .from('game_rounds')
        .select('*')
        .in('status', ['betting', 'countdown', 'flying', 'crashed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      // User's active tickets
      wallet_address ? supabase
        .from('game_tickets')
        .select('*')
        .eq('wallet_address', wallet_address.toLowerCase())
        .eq('is_used', false)
        .gte('expires_at', serverTime)
        .order('expires_at', { ascending: true }) : Promise.resolve({ data: [], error: null }),
      
      // User's pending winnings (bets that won but not claimed)
      wallet_address ? supabase
        .from('game_bets')
        .select('*, game_rounds!inner(round_number, crash_point)')
        .eq('wallet_address', wallet_address.toLowerCase())
        .eq('status', 'won')
        .is('claimed_at', null)
        .order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      
      // Recent round history (last 20)
      supabase.rpc('get_game_rounds_public', { limit_count: 20 }),
      
      // User's bet in current round (if any)
      null // Will be fetched after we know the round
    ]);

    // Get current round
    const currentRound = currentRoundResult.data;
    
    // Fetch user's bet in current round if exists
    let myBet = null;
    if (currentRound && wallet_address) {
      const { data: betData } = await supabase
        .from('game_bets')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('wallet_address', wallet_address.toLowerCase())
        .single();
      myBet = betData;
    }

    // Calculate total pending winnings
    const pendingWinnings = pendingWinningsResult.data || [];
    const totalPendingWinnings = pendingWinnings.reduce(
      (sum: number, bet: any) => sum + (bet.winnings || 0), 
      0
    );

    // Get ticket stats
    const tickets = ticketsResult.data || [];
    const ticketStats = {
      total: tickets.length,
      totalValue: tickets.reduce((sum: number, t: any) => sum + t.ticket_value, 0),
      byValue: tickets.reduce((acc: Record<number, number>, t: any) => {
        acc[t.ticket_value] = (acc[t.ticket_value] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };

    console.log(`[DASHBOARD:${correlation_id || 'unknown'}] State fetched - Round: ${currentRound?.round_number || 'none'}, Tickets: ${tickets.length}, Pending: ${pendingWinnings.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        server_time: serverTime,
        current_round: currentRound ? {
          id: currentRound.id,
          round_number: currentRound.round_number,
          status: currentRound.status,
          server_seed_hash: currentRound.server_seed_hash,
          server_seed: currentRound.status === 'crashed' || currentRound.status === 'payout' 
            ? currentRound.server_seed : null,
          crash_point: currentRound.status === 'crashed' || currentRound.status === 'payout' 
            ? currentRound.crash_point : null,
          started_at: currentRound.started_at,
          crashed_at: currentRound.crashed_at,
          total_bets: currentRound.total_bets,
          total_wagered: currentRound.total_wagered
        } : null,
        my_bet: myBet,
        tickets: tickets,
        ticket_stats: ticketStats,
        pending_winnings: {
          bets: pendingWinnings,
          total: totalPendingWinnings,
          count: pendingWinnings.length
        },
        round_history: recentHistoryResult.data || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DASHBOARD] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        server_time: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
