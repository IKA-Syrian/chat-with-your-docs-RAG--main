import { createClient } from '@supabase/supabase-js';

// Lazy-loaded clients
let _supabaseAdmin = null;
let _supabaseClient = null;

function getSupabaseConfig() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase environment variables:');
        console.error('SUPABASE_URL:', supabaseUrl ? 'present' : 'missing');
        console.error('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'present' : 'missing');
        console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'present' : 'missing');
        throw new Error('Missing required Supabase environment variables (URL and ANON_KEY)');
    }

    return { supabaseUrl, supabaseServiceKey, supabaseAnonKey };
}

// Service role client for admin operations (only if service key is available)
export const supabaseAdmin = () => {
    if (!_supabaseAdmin) {
        const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
        _supabaseAdmin = supabaseServiceKey
            ? createClient(supabaseUrl, supabaseServiceKey)
            : null;
    }
    return _supabaseAdmin;
};

// Anonymous client for public operations
export const supabaseClient = () => {
    if (!_supabaseClient) {
        const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
        _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabaseClient;
};

// Create client with user auth
export const createUserClient = (authToken) => {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

    if (!authToken) {
        return supabaseClient();
    }

    // For debugging
    console.log('🔑 Creating Supabase client with token:', {
        tokenLength: authToken.length,
        tokenStart: authToken.substring(0, 20) + '...'
    });

    // Create client with auth token
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                authorization: `Bearer ${authToken}`,
            },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    // Set the session manually to ensure proper authentication
    try {
        client.auth.setSession({ access_token: authToken, refresh_token: '' });
    } catch (error) {
        console.error('Failed to set session:', error);
    }

    return client;
};
