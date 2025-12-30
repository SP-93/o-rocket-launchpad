import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

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

// Treasury wallet address (must match frontend)
const TREASURY_WALLET = '0x8334966329b7f4b459633696a8ca59118253bc89';

// Token contracts on Over Protocol
const TOKEN_CONTRACTS = {
  WOVER: '0x9eBc3A67cf6Da4C13642fE995E3e3Ff37772eadC',
  USDT: '0xabc123...', // Update with actual USDT contract
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const serverTime = new Date().toISOString();

  try {
    const { 
      wallet_address, 
      ticket_value, 
      payment_currency, 
      payment_amount, 
      tx_hash,
      correlation_id 
    } = await req.json();

    console.log(`[${requestId}] BUY_TICKET_START`, {
      wallet: wallet_address?.slice(0, 10),
      ticket_value,
      payment_currency,
      payment_amount,
      tx_hash: tx_hash?.slice(0, 20),
      correlation_id,
      serverTime,
    });

    // Validate input
    if (!wallet_address || !ticket_value || !payment_currency || !payment_amount) {
      console.log(`[${requestId}] VALIDATION_FAILED: Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      console.log(`[${requestId}] VALIDATION_FAILED: Invalid wallet format`);
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by wallet
    if (isRateLimited(wallet_address.toLowerCase())) {
      console.log(`[${requestId}] RATE_LIMITED: ${wallet_address}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before buying more tickets.', request_id: requestId }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ticket value (1-5)
    if (ticket_value < 1 || ticket_value > 5 || !Number.isInteger(ticket_value)) {
      return new Response(
        JSON.stringify({ error: 'Ticket value must be 1, 2, 3, 4, or 5', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment currency
    if (!['WOVER', 'USDT'].includes(payment_currency)) {
      return new Response(
        JSON.stringify({ error: 'Payment currency must be WOVER or USDT', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment amount
    if (payment_amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Payment amount must be positive', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== TX HASH VERIFICATION ==========
    if (tx_hash) {
      // Check for duplicate tx_hash (idempotency)
      const { data: existingTicket, error: dupError } = await supabase
        .from('game_tickets')
        .select('id')
        .eq('tx_hash', tx_hash)
        .maybeSingle();

      if (existingTicket) {
        console.log(`[${requestId}] DUPLICATE_TX_HASH: ${tx_hash} already used for ticket ${existingTicket.id}`);
        return new Response(
          JSON.stringify({ 
            error: 'This transaction has already been used to purchase a ticket',
            existing_ticket_id: existingTicket.id,
            request_id: requestId 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify transaction on-chain (basic validation)
      // In production, you'd call the Over Protocol RPC to verify:
      // 1. Transaction exists and is confirmed
      // 2. Transaction is a transfer to TREASURY_WALLET
      // 3. Amount matches payment_amount
      // 4. Sender matches wallet_address
      // For now, we log and trust the frontend (with tx_hash as proof)
      console.log(`[${requestId}] TX_HASH_RECORDED: ${tx_hash}`);
    } else {
      console.log(`[${requestId}] WARNING: No tx_hash provided - ticket created without on-chain proof`);
    }

    // Check if game is active
    const { data: gameStatus } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'game_status')
      .single();

    if (!gameStatus?.config_value?.active) {
      console.log(`[${requestId}] GAME_PAUSED: Cannot purchase tickets`);
      return new Response(
        JSON.stringify({ error: 'Game is currently paused. Cannot purchase tickets.', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiry (15 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15);

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('game_tickets')
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        ticket_value,
        payment_currency,
        payment_amount,
        tx_hash: tx_hash || null,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
      .select()
      .single();

    if (ticketError) {
      console.error(`[${requestId}] TICKET_CREATE_ERROR:`, ticketError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket', details: ticketError.message, request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update pending revenue
    const revenueField = payment_currency === 'WOVER' ? 'pending_wover' : 'pending_usdt';
    const totalField = payment_currency === 'WOVER' ? 'total_wover_collected' : 'total_usdt_collected';

    const { error: revenueError } = await supabase.rpc('increment_game_revenue', {
      field_name: revenueField,
      amount: payment_amount,
      total_field: totalField
    });

    // If RPC doesn't exist, use direct update
    if (revenueError) {
      const { data: currentRevenue } = await supabase
        .from('game_revenue')
        .select('*')
        .limit(1)
        .single();

      if (currentRevenue) {
        const updateData: Record<string, number | string> = {};
        updateData[revenueField] = (currentRevenue[revenueField] || 0) + payment_amount;
        updateData[totalField] = (currentRevenue[totalField] || 0) + payment_amount;
        updateData['updated_at'] = new Date().toISOString();

        await supabase
          .from('game_revenue')
          .update(updateData)
          .eq('id', currentRevenue.id);
      }
    }

    console.log(`[${requestId}] TICKET_CREATED_SUCCESS`, {
      ticketId: ticket.id,
      wallet: wallet_address.slice(0, 10),
      value: ticket_value,
      currency: payment_currency,
      txHash: tx_hash?.slice(0, 20),
    });

    // Insert audit log
    await supabase.from('game_audit_log').insert({
      event_type: 'TICKET_PURCHASED',
      wallet_address: wallet_address.toLowerCase(),
      ticket_id: ticket.id,
      correlation_id: correlation_id || requestId,
      event_data: {
        ticket_value,
        payment_currency,
        payment_amount,
        tx_hash,
        serial_number: ticket.serial_number,
        expires_at: ticket.expires_at,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        server_time: serverTime,
        ticket: {
          id: ticket.id,
          ticket_value: ticket.ticket_value,
          payment_currency: ticket.payment_currency,
          payment_amount: ticket.payment_amount,
          expires_at: ticket.expires_at,
          created_at: ticket.created_at,
          tx_hash: ticket.tx_hash,
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
