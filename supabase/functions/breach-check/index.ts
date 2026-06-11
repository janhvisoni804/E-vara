import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiter (persists per edge isolate)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per minute per user

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. TRUSTLESS AUTHENTICATION: Derive user_id only from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('ERR_AUTH_EXPIRED')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('ERR_HANDSHAKE_FAILED')

    // RATE LIMITING ENFORCEMENT
    const now = Date.now();
    const userRateLimit = rateLimitMap.get(user.id) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    
    if (now > userRateLimit.resetTime) {
      userRateLimit.count = 1;
      userRateLimit.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      userRateLimit.count++;
      if (userRateLimit.count > MAX_REQUESTS_PER_WINDOW) {
        throw new Error('ERR_RATE_LIMIT_EXCEEDED');
      }
    }
    rateLimitMap.set(user.id, userRateLimit);

    const { identityHash, isDemoTarget } = await req.json()
    if (!identityHash) throw new Error('ERR_MISSING_HASH')

    // 2. SOVEREIGN OWNERSHIP VERIFICATION using Cryptographic Hash
    const { data: identity } = await supabase
      .from('monitored_identities')
      .select('id, user_id, identity_type')
      .eq('identity_hash', identityHash)
      .eq('user_id', user.id)
      .single()

    if (!identity) throw new Error('ERR_OWNERSHIP_MISMATCH')

    // 3. INDUSTRIAL INTELLIGENCE PIPELINE
    const findings = []
    
    // --- GOLDEN PATH INVESTOR BYPASS ---
    if (isDemoTarget) {
      findings.push(
        { user_id: user.id, identity_id: identity.id, source_name: "Cleartext Password Dump (Telegram)", leak_date: new Date().toISOString().split('T')[0], severity: "high", data_types: ["email", "passwords", "phone"], description: "High-value executive credential dump found in private Telegram channels." },
        { user_id: user.id, identity_id: identity.id, source_name: "Dark Web Ransomware Extortion", leak_date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], severity: "critical", data_types: ["metadata", "financial", "documents"], description: "Cryptographic signature matches documents indexed in ransomware leak site." },
        { user_id: user.id, identity_id: identity.id, source_name: "Underground Forum (Breached.vc)", leak_date: new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0], severity: "medium", data_types: ["email", "metadata"], description: "Associated email hashes found in massive scraped dataset." },
        { user_id: user.id, identity_id: identity.id, source_name: "Third-Party Vendor Compromise", leak_date: new Date(Date.now() - 86400000 * 120).toISOString().split('T')[0], severity: "high", data_types: ["pii", "billing", "email"], description: "Supply chain attack resulted in downstream data exposure." },
        { user_id: user.id, identity_id: identity.id, source_name: "GitHub Public Repository Leak", leak_date: new Date(Date.now() - 86400000 * 200).toISOString().split('T')[0], severity: "low", data_types: ["email", "metadata"], description: "Identity markers found inside committed source code on a public repository." }
      );
    } else {
      const osintApiKey = Deno.env.get('EXTERNAL_OSINT_API_KEY')
      if (!osintApiKey) {
        throw new Error('ERR_MISSING_OSINT_CONFIG')
      }

      // Call external Dark Web/OSINT API (e.g. Dehashed, IntelX, or similar commercial API supporting SHA-256 lookups)
      const osintRes = await fetch(`https://api.external-osint-provider.com/v1/search?hash=${identityHash}`, {
        headers: {
          'Authorization': `Bearer ${osintApiKey}`,
          'Accept': 'application/json'
        }
      })

      if (!osintRes.ok) {
        throw new Error('ERR_OSINT_PROVIDER_UNAVAILABLE')
      }

      const osintData = await osintRes.json()

      // Map external API findings to our Sovereign database schema
      if (osintData.breaches && Array.isArray(osintData.breaches)) {
        for (const breach of osintData.breaches) {
          findings.push({
            user_id: user.id,
            identity_id: identity.id,
            source_name: breach.source || "Dark Web Archive Correlation",
            leak_date: breach.leak_date || new Date().toISOString().split('T')[0],
            severity: breach.severity || "medium",
            data_types: breach.data_classes || ["metadata"],
            description: breach.description || `Exposed records matching cryptographic signature found in ${breach.source}.`
          })
        }
      }
    }

    // 4. ATOMIC DATA INGESTION (Server-side enforced)
    if (findings.length > 0) {
      const { error: ingestError } = await supabase.from('identity_breaches').insert(findings)
      if (ingestError) throw ingestError
    }

    // 5. SCORE CALIBRATION
    await supabase.from('monitored_identities')
      .update({ risk_score: findings.length > 0 ? 35 : 5, last_scanned_at: new Date().toISOString() })
      .eq('id', identity.id)

    return new Response(
      JSON.stringify({ success: true, count: findings.length, status: "NODE_STABLE" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
