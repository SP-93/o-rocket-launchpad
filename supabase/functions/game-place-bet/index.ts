import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const MAX_REQUESTS = 3;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  record.count++;
  return record.count > MAX_REQUESTS;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, ticket_id, auto_cashout_at } = await req.json();

    // Validate input
    if (!wallet_address || !ticket_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by wallet
    if (isRateLimited(wallet_address.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Too many bet attempts. Please wait.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate auto_cashout_at if provided (must be 2 or 10, or null for manual)
    if (auto_cashout_at !== null && auto_cashout_at !== undefined) {
      if (![2, 10].includes(auto_cashout_at)) {
        return new Response(
          JSON.stringify({ error: 'Auto cash-out must be x2, x10, or OFF (null)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current round in betting phase
    const { data: currentRound, error: roundError } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('status', 'betting')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError || !currentRound) {
      return new Response(
        JSON.stringify({ error: 'No active betting round. Please wait for the next round.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('game_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check ticket ownership
    if (ticket.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'This ticket does not belong to you' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is already used
    if (ticket.is_used) {
      return new Response(
        JSON.stringify({ error: 'This ticket has already been used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is expired
    if (new Date(ticket.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This ticket has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player already has a bet in this round
    const { data: existingBet } = await supabase
      .from('game_bets')
      .select('id')
      .eq('round_id', currentRound.id)
      .eq('wallet_address', wallet_address.toLowerCase())
      .single();

    if (existingBet) {
      return new Response(
        JSON.stringify({ error: 'You already have a bet in this round' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark ticket as used
    const { error: updateTicketError } = await supabase
      .from('game_tickets')
      .update({ 
        is_used: true, 
        used_in_round: currentRound.id 
      })
      .eq('id', ticket_id);

    if (updateTicketError) {
      console.error('Error updating ticket:', updateTicketError);
      return new Response(
        JSON.stringify({ error: 'Failed to process ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create bet
    const { data: bet, error: betError } = await supabase
      .from('game_bets')
      .insert({
        round_id: currentRound.id,
        wallet_address: wallet_address.toLowerCase(),
        ticket_id: ticket_id,
        bet_amount: ticket.ticket_value,
        auto_cashout_at: auto_cashout_at || null,
        status: 'active',
      })
      .select()
      .single();

    if (betError) {
      console.error('Error creating bet:', betError);
      // Rollback ticket usage
      await supabase
        .from('game_tickets')
        .update({ is_used: false, used_in_round: null })
        .eq('id', ticket_id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to place bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update round stats
    await supabase
      .from('game_rounds')
      .update({
        total_bets: currentRound.total_bets + 1,
        total_wagered: (currentRound.total_wagered || 0) + ticket.ticket_value,
      })
      .eq('id', currentRound.id);

    console.log(`Bet placed: ${bet.id} by ${wallet_address}, amount: ${ticket.ticket_value}, auto_cashout: ${auto_cashout_at}`);

    return new Response(
      JSON.stringify({
        success: true,
        bet: {
          id: bet.id,
          round_id: bet.round_id,
          bet_amount: bet.bet_amount,
          auto_cashout_at: bet.auto_cashout_at,
          status: bet.status,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in game-place-bet:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
