import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { runResilient } from "@/lib/resilient-fetch";

export interface ThreatFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  source: string;
  description: string;
  found_at: string;
}

export const useThreatMonitor = () => {
  return useQuery<ThreatFinding[], Error>({
    queryKey: ["threat-findings"],
    queryFn: async () => {
      return runResilient(
        async () => {
          const { data, error } = await supabase
            .from('identity_breaches')
            .select('id, severity, source_name, description, created_at')
            .order('created_at', { ascending: false });
          
          if (error) {
            throw new Error("Unable to securely fetch threat intelligence data.");
          }
          
          return (data || []).map((row) => ({
            id: row.id,
            severity: (row.severity || "medium") as ThreatFinding["severity"],
            title: `Exposure Detected in ${row.source_name || "Unknown Source"}`,
            source: row.source_name || "Unknown Source",
            description: row.description || "Data point leaked.",
            found_at: row.created_at || new Date().toISOString()
          }));
        },
        "e_vara_threat_findings",
        [] // Return an empty array on failure instead of mocked threats
      );
    },
    staleTime: 30000, // 30 seconds cache
  });
};
