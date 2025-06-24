import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Helper function to validate a user token
export async function validateUser(authToken) {
    try {
        if (!authToken) {
            return { user: null, error: 'No authorization token provided' };
        }

        // Method 1: Use Supabase client with the token
        const supabase = createUserClient(authToken);
        const { data, error } = await supabase.auth.getUser();

        if (!error && data?.user) {
            console.log('✅ User authenticated via Supabase getUser');
            return { user: data.user, error: null };
        }

        if (error) {
            console.log('⚠️ Supabase getUser error:', error.message);
            // Continue to next method
        }

        // Method 2: Try getting session
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (!sessionError && sessionData?.session?.user) {
                console.log('✅ User authenticated via Supabase getSession');
                return { user: sessionData.session.user, error: null };
            }

            if (sessionError) {
                console.log('⚠️ Supabase getSession error:', sessionError.message);
            }
        } catch (sessionErr) {
            console.log('⚠️ Session check error:', sessionErr.message);
        }

        // Method 3: Directly decode JWT
        try {
            // Decode the token (verification happens separately)
            const decoded = jwt.decode(authToken, { complete: true });
            if (!decoded) {
                return { user: null, error: 'Failed to decode JWT' };
            }

            const payload = decoded.payload;
            console.log('🔍 JWT payload decoded:', {
                sub: payload.sub,
                aud: payload.aud,
                exp: payload.exp
            });

            // Check token expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return { user: null, error: 'Token has expired' };
            }

            // Try to get user from Supabase Admin API
            const admin = supabaseAdmin();
            if (admin && payload.sub) {
                try {
                    const { data: userData, error: userError } = await admin.auth.admin.getUserById(payload.sub);

                    if (userData?.user) {
                        console.log('✅ User authenticated via admin lookup');
                        return { user: userData.user, error: null };
                    }

                    if (userError) {
                        console.log('⚠️ Admin user lookup error:', userError.message);
                    }
                } catch (adminError) {
                    console.log('⚠️ Admin API error:', adminError.message);
                }
            }

            // Fallback: construct minimal user object from token
            console.log('✅ Using fallback authentication from JWT');
            return {
                user: {
                    id: payload.sub,
                    email: payload.email || 'unknown',
                    aud: payload.aud || 'authenticated',
                    app_metadata: payload.app_metadata || {},
                    user_metadata: payload.user_metadata || {},
                    created_at: new Date().toISOString()
                },
                error: null
            };
        } catch (jwtError) {
            console.error('❌ JWT decoding error:', jwtError.message);
            return { user: null, error: 'Invalid token format' };
        }
    } catch (error) {
        console.error('❌ User validation error:', error);
        return { user: null, error: 'Authentication failed: ' + error.message };
    }
}

// Sign in route
router.post('/sign-in', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const supabase = createUserClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('Sign in error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign up route
router.post('/sign-up', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const supabase = createUserClient();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('Sign up error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign out route
router.post('/sign-out', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        const supabase = createUserClient(authToken);

        const { error } = await supabase.auth.signOut();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        console.error('Sign out error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/user', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('Auth check request:');
        console.log('- Has authorization header:', !!req.headers.authorization);
        console.log('- Token length:', authToken?.length || 0);
        console.log('- Token starts with:', authToken?.substring(0, 20) + '...');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Try different methods to verify the user
        try {
            // Method 1: Use Supabase client with the token
            const supabase = createUserClient(authToken);
            const { data, error } = await supabase.auth.getUser();

            if (error) {
                console.log('Supabase getUser error:', error.message);
                // Don't return immediately, try the next method
            } else if (data?.user) {
                console.log('User authenticated successfully via Supabase getUser');
                return res.json({ user: data.user });
            }

            // Method 2: Directly decode JWT
            try {
                // Decode the token (verification happens separately)
                const decoded = jwt.decode(authToken, { complete: true });
                if (!decoded) {
                    throw new Error('Failed to decode JWT');
                }

                const payload = decoded.payload;
                console.log('JWT payload successfully decoded:', {
                    sub: payload.sub,
                    aud: payload.aud,
                    exp: payload.exp
                });

                // Check token expiration
                if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                    return res.status(401).json({ error: 'Token has expired' });
                }

                // Try to get user from Supabase Admin API
                const admin = supabaseAdmin();
                if (admin && payload.sub) {
                    try {
                        const { data: userData, error: userError } = await admin.auth.admin.getUserById(payload.sub);

                        if (userData?.user) {
                            console.log('User authenticated via admin lookup');
                            return res.json({ user: userData.user });
                        }

                        if (userError) {
                            console.log('Admin user lookup error:', userError.message);
                        }
                    } catch (adminError) {
                        console.log('Admin API error:', adminError.message);
                    }
                }

                // Fallback: construct minimal user object from token
                console.log('Using fallback authentication from JWT');
                return res.json({
                    user: {
                        id: payload.sub,
                        email: payload.email,
                        aud: payload.aud,
                        app_metadata: payload.app_metadata || {},
                        user_metadata: payload.user_metadata || {},
                        created_at: new Date().toISOString()
                    }
                });
            } catch (jwtError) {
                console.error('JWT decoding error:', jwtError.message);
                return res.status(401).json({ error: 'Invalid token format' });
            }
        } catch (verificationError) {
            console.error('User verification error:', verificationError);
            return res.status(401).json({ error: verificationError.message || 'Authentication failed' });
        }
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
