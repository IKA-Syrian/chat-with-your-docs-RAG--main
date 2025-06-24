import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Enhanced Supabase client configuration for persistent sessions
const createPersistentSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
};

// Create a singleton instance
let _supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!_supabaseClient) {
    _supabaseClient = createPersistentSupabaseClient();
  }
  return _supabaseClient;
};

export default getSupabaseClient;
