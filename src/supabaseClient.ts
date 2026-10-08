import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://cwpbidoxhnocyotqzhaz.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Qv2zTEEaeOL2yZjY9to8tw_kHEGiYEV';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('organizai_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('organizai_supabase_anon_key') || '' : '';

export const supabaseUrl = envUrl || storedUrl || DEFAULT_URL;
export const supabaseAnonKey = envKey || storedKey || DEFAULT_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const queryCache = new Map<string, { data: any; ts: number }>();

export async function cachedQuery<T>(
  key: string,
  fetcher: () => PromiseLike<{ data: T | null; error: any }>,
  ttl = 15000,
): Promise<{ data: T | null; error: any }> {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) {
    return { data: cached.data as T, error: null };
  }
  const result = await fetcher();
  if (result.data) {
    queryCache.set(key, { data: result.data, ts: Date.now() });
  }
  return result;
}

/** Remove uma entrada do cache para forçar refetch em mutações (insert/update/delete). */
export function invalidateQuery(key: string) {
  queryCache.delete(key);
}

/** Limpa todo o cache (ex.: logout). */
export function clearQueryCache() {
  queryCache.clear();
}

