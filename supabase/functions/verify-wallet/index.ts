import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration - IP based
const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const IP_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const IP_MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute per IP

// Rate limiting configuration - Wallet address based (stricter)
const walletRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const WALLET_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const WALLET_MAX_REQUESTS_PER_WINDOW = 5; // 5 attempts per minute per wallet

// Check if IP is rate limited
function isIPRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  if (!record) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (now > record.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= IP_MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count++;
  return false;
}

// Check if wallet address is rate limited
function isWalletRateLimited(walletAddress: string): boolean {
  const normalizedAddress = walletAddress.toLowerCase();
  const now = Date.now();
  const record = walletRateLimitMap.get(normalizedAddress);

  if (!record) {
    walletRateLimitMap.set(normalizedAddress, { count: 1, resetTime: now + WALLET_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (now > record.resetTime) {
    walletRateLimitMap.set(normalizedAddress, { count: 1, resetTime: now + WALLET_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= WALLET_MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count++;
  return false;
}

// Get client IP from request headers
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

// Get remaining time until rate limit reset
function getIPRateLimitResetTime(ip: string): number {
  const record = ipRateLimitMap.get(ip);
  if (!record) return 0;
  const remaining = Math.max(0, record.resetTime - Date.now());
  return Math.ceil(remaining / 1000);
}

function getWalletRateLimitResetTime(walletAddress: string): number {
  const record = walletRateLimitMap.get(walletAddress.toLowerCase());
  if (!record) return 0;
  const remaining = Math.max(0, record.resetTime - Date.now());
  return Math.ceil(remaining / 1000);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // IP-based rate limiting check (first layer)
  const clientIP = getClientIP(req);
  if (isIPRateLimited(clientIP)) {
    const retryAfter = getIPRateLimitResetTime(clientIP);
    console.warn(`verify-wallet: IP rate limit exceeded for: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        error: 'Too many requests', 
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter 
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        } 
      }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('verify-wallet: No authorization header, IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('verify-wallet: User auth error:', userError, 'IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('verify-wallet: Authenticated user:', user.id, 'IP:', clientIP);

    const { signature, message, walletAddress } = await req.json();

    if (!signature || !message || !walletAddress) {
      console.error('verify-wallet: Missing required fields:', { signature: !!signature, message: !!message, walletAddress: !!walletAddress });
      return new Response(
        JSON.stringify({ error: 'Missing signature, message, or walletAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Wallet address rate limiting check (second layer - stricter)
    if (isWalletRateLimited(walletAddress)) {
      const retryAfter = getWalletRateLimitResetTime(walletAddress);
      console.warn(`verify-wallet: Wallet rate limit exceeded for: ${walletAddress}, IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'Too many verification attempts for this wallet', 
          message: 'Please wait before trying again.',
          retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          } 
        }
      );
    }

    console.log('verify-wallet: Verifying signature for wallet:', walletAddress);

    // Verify the signature using ethers.js
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
      console.log('verify-wallet: Recovered address:', recoveredAddress);
    } catch (sigError) {
      console.error('verify-wallet: Signature verification failed:', sigError, 'IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if recovered address matches the claimed wallet address
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      console.error('verify-wallet: Address mismatch:', { recovered: recoveredAddress, claimed: walletAddress }, 'IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Signature does not match wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the message contains expected content (nonce and timestamp)
    const messagePattern = /RocketSwap Wallet Verification\nNonce: [a-f0-9]+\nTimestamp: \d+/;
    if (!messagePattern.test(message)) {
      console.error('verify-wallet: Invalid message format:', message, 'IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract timestamp and check if message is not too old (5 minutes)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const messageTimestamp = parseInt(timestampMatch[1]);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - messageTimestamp > fiveMinutes) {
        console.error('verify-wallet: Message expired:', { messageTimestamp, now }, 'IP:', clientIP);
        return new Response(
          JSON.stringify({ error: 'Signature expired, please try again' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if wallet is already linked to another user
    const { data: existingWallet, error: checkError } = await supabase
      .from('user_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('verify-wallet: Error checking existing wallet:', checkError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingWallet && existingWallet.user_id !== user.id) {
      console.error('verify-wallet: Wallet already linked to another user, IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'This wallet is already linked to another account' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If wallet already linked to this user, just return success
    if (existingWallet && existingWallet.user_id === user.id) {
      console.log('verify-wallet: Wallet already linked to this user');
      return new Response(
        JSON.stringify({ success: true, message: 'Wallet already linked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new wallet link
    const { error: insertError } = await supabase
      .from('user_wallets')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress.toLowerCase(),
        verified_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('verify-wallet: Error inserting wallet:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to link wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('verify-wallet: Wallet linked successfully:', walletAddress, 'User:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Wallet linked successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('verify-wallet: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
