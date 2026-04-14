/**
 * Cloudflare Worker — Odds API Proxy for tips.co.za
 *
 * Routes: /api/{endpoint}?{params}  →  api.odds-api.io/v3/{endpoint}?{params}&apiKey=SECRET
 *
 * Features:
 *   - API key stays server-side (bound as ODDS_API_KEY secret)
 *   - Edge cache: 2 min for most endpoints, 30s for dropping-odds
 *   - Per-IP rate limiting: 30 req/min via in-memory counter (resets per isolate)
 *   - CORS locked to tips.co.za + localhost dev
 *   - Strips apiKey from any incoming query string (defence in depth)
 */

const UPSTREAM = 'https://api.odds-api.io/v3';

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://tips.co.za',
  'https://www.tips.co.za',
  'http://localhost:3000',
  'http://localhost:8788',
  'http://127.0.0.1:3000',
];

// Cache TTLs (seconds)
const CACHE_TTL = {
  'events':        120,   // 2 min
  'odds':          120,   // 2 min
  'value-bets':    120,   // 2 min
  'dropping-odds':  30,   // 30 sec (fast-moving data)
};

// Rate limiting: requests per minute per IP
const RATE_LIMIT = 30;
const rateCounts = new Map();

// Clean up rate limiter every 60s
setInterval(() => rateCounts.clear(), 60_000);

function checkRateLimit(ip) {
  const count = (rateCounts.get(ip) || 0) + 1;
  rateCounts.set(ip, count);
  return count <= RATE_LIMIT;
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only handle /api/* routes
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    // Handle CORS preflight
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only GET allowed
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    // Rate limit check
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 30 requests per minute.' }), {
        status: 429,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // Extract the API path: /api/events → events, /api/value-bets → value-bets
    const apiPath = url.pathname.replace(/^\/api\//, '');
    if (!apiPath || apiPath.includes('..')) {
      return new Response('Bad request', { status: 400, headers: corsHeaders(origin) });
    }

    // Build upstream URL — strip any apiKey from client params, inject server secret
    const params = new URLSearchParams(url.search);
    params.delete('apiKey');
    params.set('apiKey', env.ODDS_API_KEY);

    const upstreamUrl = `${UPSTREAM}/${apiPath}?${params.toString()}`;

    // Determine cache TTL
    const endpoint = apiPath.split('/')[0].split('?')[0];
    const ttl = CACHE_TTL[endpoint] || 120;

    // Check Cloudflare cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (!response) {
      // Fetch from upstream
      const upstream = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'tips.co.za-proxy/1.0',
          'Accept': 'application/json',
        },
      });

      // Clone and prepare response with cache headers
      const body = await upstream.text();
      response = new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
          'X-Cache': 'MISS',
          'X-Proxy': 'tips-odds-proxy',
        },
      });

      // Store in edge cache (only for successful responses)
      if (upstream.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    } else {
      // Cache hit — add CORS headers and cache indicator
      response = new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          ...corsHeaders(origin),
          'X-Cache': 'HIT',
        },
      });
    }

    return response;
  },
};
