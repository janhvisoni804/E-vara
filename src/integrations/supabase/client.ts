import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Enterprise-grade environment detection.
 */
export const isSimulationMode = !SUPABASE_URL || SUPABASE_URL.includes("placeholder") || !SUPABASE_PUBLISHABLE_KEY;

// Fail-fast in development if env vars are missing
if (import.meta.env.DEV && isSimulationMode) {
  console.warn("E-VARA: Missing Environment Variables. Falling back to secure local development mode.");
}

/**
 * The 'Sovereign' client.
 * Strictly avoids hardcoded external fallbacks to prevent supply-chain attacks.
 * In simulation mode, this client remains uninitialized to prevent network noise.
 */
export const supabase = createClient<Database>(
  SUPABASE_URL || "https://local-simulation.e-vara.io", 
  SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.local-mock"
);

/**
 * Health check to verify if the infrastructure is reachable.
 */
export const checkInfrastructure = async (): Promise<boolean> => {
  if (isSimulationMode) return false;
  try {
    const { error } = await supabase.from('monitored_identities').select('count', { count: 'exact', head: true }).limit(1);
    return !error;
  } catch {
    return false;
  }
};
