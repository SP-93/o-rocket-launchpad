import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    console.log(`Rate limit exceeded for IP: ${ip.substring(0, 8)}...`);
    return true;
  }

  record.count++;
  return false;
}

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP)) {
      console.log('check-admin: Rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      )
    }

    const { wallet_address } = await req.json()

    if (!wallet_address) {
      console.log('check-admin: Missing wallet address')
      return new Response(
        JSON.stringify({ isAdmin: false, error: 'Missing wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate wallet address format (basic check)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(wallet_address)) {
      console.log('check-admin: Invalid wallet address format')
      return new Response(
        JSON.stringify({ isAdmin: false, error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`check-admin: Checking admin status for wallet: ${wallet_address.substring(0, 10)}...`)

    // Get Supabase URL and key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('check-admin: Missing Supabase environment variables');
      // Still try to verify using hardcoded wallets as fallback
      const HARDCODED_ADMINS = [
        '0x8334966329b7f4b459633696a8ca59118253bc89',
        '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
      ];
      
      const isHardcodedAdmin = HARDCODED_ADMINS.some(
        admin => admin.toLowerCase() === wallet_address.toLowerCase()
      );
      
      return new Response(
        JSON.stringify({ 
          isAdmin: isHardcodedAdmin,
          verifiedAt: new Date().toISOString(),
          source: 'hardcoded_fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Use the is_wallet_admin function (SECURITY DEFINER - works without service role)
    const { data: isAdmin, error } = await supabaseAdmin.rpc('is_wallet_admin', {
      _wallet_address: wallet_address
    })

    if (error) {
      console.error('check-admin: Database error:', error)
      // Fallback to hardcoded wallets on DB error
      const HARDCODED_ADMINS = [
        '0x8334966329b7f4b459633696a8ca59118253bc89',
        '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
      ];
      
      const isHardcodedAdmin = HARDCODED_ADMINS.some(
        admin => admin.toLowerCase() === wallet_address.toLowerCase()
      );
      
      return new Response(
        JSON.stringify({ 
          isAdmin: isHardcodedAdmin,
          verifiedAt: new Date().toISOString(),
          source: 'hardcoded_fallback',
          dbError: error.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`check-admin: Wallet verification completed - isAdmin: ${isAdmin}`)

    return new Response(
      JSON.stringify({ 
        isAdmin: isAdmin === true,
        verifiedAt: new Date().toISOString(),
        source: 'database'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('check-admin: Unexpected error:', error)
    return new Response(
      JSON.stringify({ isAdmin: false, error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
