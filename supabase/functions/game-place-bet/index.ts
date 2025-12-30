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

// Generate request ID for logging
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const serverTime = new Date().toISOString();

  try {
    const { wallet_address, ticket_id, auto_cashout_at, correlation_id } = await req.json();

    console.log(`[${requestId}] PLACE_BET_START`, {
      wallet: wallet_address?.slice(0, 10),
      ticket_id: ticket_id?.slice(0, 8),
      auto_cashout_at,
      correlation_id,
      serverTime,
    });

    // Validate input
    if (!wallet_address || !ticket_id) {
      console.log(`[${requestId}] VALIDATION_FAILED: Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by wallet
    if (isRateLimited(wallet_address.toLowerCase())) {
      console.log(`[${requestId}] RATE_LIMITED: ${wallet_address}`);
      return new Response(
        JSON.stringify({ error: 'Too many bet attempts. Please wait.', request_id: requestId }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate auto_cashout_at if provided (must be 2, 5, or 10, or null for manual)
    if (auto_cashout_at !== null && auto_cashout_at !== undefined) {
      if (![2, 5, 10].includes(auto_cashout_at)) {
        return new Response(
          JSON.stringify({ error: 'Auto cash-out must be x2, x5, x10, or OFF (null)', request_id: requestId }),
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
      console.log(`[${requestId}] NO_BETTING_ROUND: ${roundError?.message}`);
      return new Response(
        JSON.stringify({ error: 'No active betting round. Please wait for the next round.', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] ROUND_FOUND`, {
      round_id: currentRound.id.slice(0, 8),
      round_number: currentRound.round_number,
      status: currentRound.status,
    });

    // Validate ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('game_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.log(`[${requestId}] TICKET_NOT_FOUND: ${ticket_id}`);
      return new Response(
        JSON.stringify({ error: 'Ticket not found', request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check ticket ownership
    if (ticket.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      console.log(`[${requestId}] UNAUTHORIZED: Ticket belongs to different wallet`);
      return new Response(
        JSON.stringify({ error: 'This ticket does not belong to you', request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is already used
    if (ticket.is_used) {
      console.log(`[${requestId}] TICKET_ALREADY_USED: ${ticket_id}`);
      return new Response(
        JSON.stringify({ error: 'This ticket has already been used', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is expired
    if (new Date(ticket.expires_at) < new Date()) {
      console.log(`[${requestId}] TICKET_EXPIRED: ${ticket_id}`);
      return new Response(
        JSON.stringify({ error: 'This ticket has expired', request_id: requestId }),
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
      console.log(`[${requestId}] ALREADY_BET: Player already has bet ${existingBet.id} in round`);
      return new Response(
        JSON.stringify({ error: 'You already have a bet in this round', existing_bet_id: existingBet.id, request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark ticket as used (with optimistic locking)
    const { error: updateTicketError, data: updatedTicket } = await supabase
      .from('game_tickets')
      .update({ 
        is_used: true, 
        used_in_round: currentRound.id 
      })
      .eq('id', ticket_id)
      .eq('is_used', false) // Optimistic locking - only update if not already used
      .select()
      .single();

    if (updateTicketError || !updatedTicket) {
      console.error(`[${requestId}] TICKET_UPDATE_FAILED:`, updateTicketError);
      return new Response(
        JSON.stringify({ error: 'Failed to process ticket. It may have been used by another request.', request_id: requestId }),
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
      console.error(`[${requestId}] BET_CREATE_FAILED:`, betError);
      
      // Rollback ticket usage
      await supabase
        .from('game_tickets')
        .update({ is_used: false, used_in_round: null })
        .eq('id', ticket_id);
      
      console.log(`[${requestId}] ROLLBACK: Ticket ${ticket_id} restored`);
      
      return new Response(
        JSON.stringify({ error: 'Failed to place bet', request_id: requestId }),
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

    console.log(`[${requestId}] BET_PLACED_SUCCESS`, {
      bet_id: bet.id,
      round_id: currentRound.id.slice(0, 8),
      round_number: currentRound.round_number,
      ticket_id: ticket_id.slice(0, 8),
      bet_amount: ticket.ticket_value,
      auto_cashout_at,
    });

    // Insert audit log
    await supabase.from('game_audit_log').insert({
      event_type: 'BET_PLACED',
      wallet_address: wallet_address.toLowerCase(),
      ticket_id: ticket_id,
      bet_id: bet.id,
      round_id: currentRound.id,
      correlation_id: correlation_id || requestId,
      event_data: {
        round_number: currentRound.round_number,
        bet_amount: ticket.ticket_value,
        auto_cashout_at,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        server_time: serverTime,
        bet: {
          id: bet.id,
          round_id: bet.round_id,
          round_number: currentRound.round_number,
          bet_amount: bet.bet_amount,
          auto_cashout_at: bet.auto_cashout_at,
          status: bet.status,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${requestId}] INTERNAL_ERROR:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
