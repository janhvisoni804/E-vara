import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail-fast in development if env vars are missing
if (import.meta.env.DEV && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)) {
  console.warn("E-VARA: Missing Environment Variables. Falling back to local development mocks.");
}

/**
 * Enterprise-grade environment detection.
 * Centralizes 'Demo Mode' logic to avoid duplication across components.
 */
export const isSimulationMode = !SUPABASE_URL || SUPABASE_URL.includes("placeholder") || !SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL || "http://127.0.0.1:54321", 
  SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.local-mock"
);

/**
 * Health check to verify if the infrastructure is reachable.
 */
export const checkInfrastructure = async (): Promise<boolean> => {
  if (isSimulationMode) return false;
  try {
    const { error } = await supabase.from('monitored_identities' as any).select('count', { count: 'exact', head: true }).limit(1);
    return !error;
  } catch {
    return false;
  }
};
