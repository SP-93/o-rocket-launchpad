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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, ticket_value, payment_currency, payment_amount, tx_hash } = await req.json();

    // Validate input
    if (!wallet_address || !ticket_value || !payment_currency || !payment_amount) {
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
        JSON.stringify({ error: 'Too many requests. Please wait before buying more tickets.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ticket value (1-5)
    if (ticket_value < 1 || ticket_value > 5 || !Number.isInteger(ticket_value)) {
      return new Response(
        JSON.stringify({ error: 'Ticket value must be 1, 2, 3, 4, or 5' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment currency
    if (!['WOVER', 'USDT'].includes(payment_currency)) {
      return new Response(
        JSON.stringify({ error: 'Payment currency must be WOVER or USDT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment amount
    if (payment_amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Payment amount must be positive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if game is active
    const { data: gameStatus } = await supabase
      .from('game_config')
      .select('config_value')
      .eq('config_key', 'game_status')
      .single();

    if (!gameStatus?.config_value?.active) {
      return new Response(
        JSON.stringify({ error: 'Game is currently paused. Cannot purchase tickets.' }),
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
      console.error('Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket' }),
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
      console.log('RPC not available, using direct update');
      
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

    console.log(`Ticket purchased: ${ticket.id} for ${wallet_address}, value: ${ticket_value}, currency: ${payment_currency}`);

    return new Response(
      JSON.stringify({
        success: true,
        ticket: {
          id: ticket.id,
          ticket_value: ticket.ticket_value,
          payment_currency: ticket.payment_currency,
          payment_amount: ticket.payment_amount,
          expires_at: ticket.expires_at,
          created_at: ticket.created_at,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in game-buy-ticket:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
