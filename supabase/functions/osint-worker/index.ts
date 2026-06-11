import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // This function should be triggered via pg_net or cron
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const workerId = crypto.randomUUID();

  // 1. Claim Jobs (Lease Locking)
  // Calculate lease expiry as 2 minutes from now.
  const leaseExpiry = new Date(Date.now() + 120000).toISOString();

  const { data: jobs, error: claimError } = await supabase
    .from('osint_jobs')
    .update({ 
      status: 'processing', 
      locked_by: workerId, 
      locked_at: new Date().toISOString(),
      lease_expiry_at: leaseExpiry,
      last_heartbeat_at: new Date().toISOString()
    })
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .is('locked_by', null)
    .select('*')
    .limit(10);

  if (claimError) {
    console.error('Failed to claim jobs:', claimError);
    return new Response(JSON.stringify({ error: claimError }), { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 });
  }

  const osintApiKey = Deno.env.get('EXTERNAL_OSINT_API_KEY');

  for (const job of jobs) {
    try {
      if (!osintApiKey) {
        throw new Error('MISSING_API_KEY');
      }

      // Simulated external call
      const osintRes = await fetch(`https://api.external-osint-provider.com/v1/search?hash=${job.identity_hash}`, {
        headers: {
          'Authorization': `Bearer ${osintApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!osintRes.ok) {
        throw new Error('API_UNAVAILABLE');
      }

      const findings = await osintRes.json();

      // Ensure jobs array is typed as jsonb
      const { error: insertError } = await supabase
        .from('identity_breaches')
        .insert(findings.map((f: Record<string, unknown>) => ({
          user_id: job.user_id,
          identity_id: job.identity_id,
          source_name: f.source,
          severity: f.severity,
          data_types: f.data_types,
          leak_date: f.date
        })));

      if (insertError) throw insertError;

      // Mark completed
      await supabase
        .from('osint_jobs')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          locked_by: null,
          lease_expiry_at: null
        })
        .eq('id', job.id);

    } catch (error: unknown) {
      const e = error as Error;
      // Exponential backoff handled by Reaper, but we can set pending here if we catch it
      await supabase
        .from('osint_jobs')
        .update({ 
          status: 'pending', 
          locked_by: null,
          lease_expiry_at: null,
          error_log: e.message
        })
        .eq('id', job.id);
    }
  }

  return new Response(JSON.stringify({ processed: jobs.length }), { status: 200 });
})
