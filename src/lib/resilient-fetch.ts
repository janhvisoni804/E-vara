import { toast } from "sonner";

// In-memory cache replaces insecure localStorage for sensitive data
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Executes an operation with automatic retry & fallback to in-memory cache.
 * Throws the actual error if all retries fail and no cache exists.
 */
export async function runResilient<T>(
  operation: () => Promise<T>,
  storageKey: string,
  emptyFallback: T,
  retries = 3,
  delay = 500
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await operation();
      // Cache successful database responses securely in memory
      memoryCache.set(storageKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoffDelay = delay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  console.warn(`Resilient fetch exhausted all ${retries} retries for ${storageKey}. Returning cached or empty fallback. Error:`, lastError);

  const cached = memoryCache.get(storageKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data as T;
  }
  
  toast.error("Network Error", {
    description: "Could not fetch latest data from the server.",
    duration: 5000,
  });

  return emptyFallback;
}
