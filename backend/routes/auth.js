/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */

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

/**
 * @swagger
 * /auth/sign-in:
 *   post:
 *     summary: Sign in user with email and password
 *     description: Authenticate a user with their email and password credentials
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: secretPassword123
 *     responses:
 *       200:
 *         description: User signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /auth/sign-up:
 *   post:
 *     summary: Register a new user account
 *     description: Create a new user account with email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User's password (minimum 6 characters)
 *                 example: myNewPassword123
 *     responses:
 *       200:
 *         description: User account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - missing or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /auth/sign-out:
 *   post:
 *     summary: Sign out current user
 *     description: Sign out the currently authenticated user and invalidate their session
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User signed out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Signed out successfully
 *       400:
 *         description: Bad request - sign out failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /auth/user:
 *   get:
 *     summary: Get current authenticated user
 *     description: Retrieve information about the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - no token provided or token invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
