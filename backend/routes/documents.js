/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document upload, management, and retrieval endpoints
 */

import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const router = Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit to accommodate PDF and PowerPoint files
    },
    fileFilter: (req, file, cb) => {
        // Accept markdown, text, PDF, and PowerPoint files
        if (file.mimetype === 'text/markdown' ||
            file.mimetype === 'text/plain' ||
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            file.mimetype === 'application/vnd.ms-powerpoint' ||
            file.originalname.endsWith('.md') ||
            file.originalname.endsWith('.txt') ||
            file.originalname.endsWith('.pdf') ||
            file.originalname.endsWith('.ppt') ||
            file.originalname.endsWith('.pptx')) {
            cb(null, true);
        } else {
            cb(new Error('Only markdown, text, PDF, and PowerPoint files are allowed'));
        }
    },
});

// Helper function to validate user from token
async function validateUser(authToken) {
    if (!authToken) {
        return { user: null, error: 'No authorization token provided' };
    }

    const supabase = createUserClient(authToken);
    let user = null;
    let userError = null;

    try {
        // Method 1: Try getUser
        const getUserResult = await supabase.auth.getUser();
        if (getUserResult.data?.user) {
            user = getUserResult.data.user;
            console.log('✅ User validated via getUser');
        } else {
            userError = getUserResult.error;
            console.log('⚠️ getUser failed:', userError?.message);

            // Method 2: Try getSession
            console.log('🔍 Trying getSession...');
            const getSessionResult = await supabase.auth.getSession();
            if (getSessionResult.data?.session?.user) {
                user = getSessionResult.data.session.user;
                console.log('✅ User validated via getSession');
            } else {
                console.log('⚠️ getSession also failed:', getSessionResult.error?.message);

                // Method 3: Direct JWT decode and manual validation
                console.log('🔍 Trying direct JWT decode and validation...');
                try {
                    // Extract and decode JWT token manually
                    const tokenParts = authToken.split('.');
                    if (tokenParts.length === 3) {
                        try {
                            // Handle URL-safe base64 encoding
                            const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
                            // Add padding if needed
                            const pad = base64.length % 4;
                            const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;

                            const jsonPayload = Buffer.from(paddedBase64, 'base64').toString();
                            const payload = JSON.parse(jsonPayload);

                            console.log('🔍 JWT payload decoded:', {
                                sub: payload.sub,
                                email: payload.email,
                                exp: payload.exp
                            });

                            // Check if token is expired
                            const now = Math.floor(Date.now() / 1000);
                            if (payload.exp && payload.exp < now) {
                                console.log('❌ Token has expired');
                            } else if (payload.sub) {
                                // Create a minimal user object from the token data
                                user = {
                                    id: payload.sub,
                                    email: payload.email || 'unknown',
                                    aud: payload.aud || 'authenticated',
                                    app_metadata: payload.app_metadata || {},
                                    user_metadata: payload.user_metadata || {},
                                };
                                console.log('✅ User validated via JWT payload');

                                // Try to use admin API as well if available
                                try {
                                    const admin = supabaseAdmin();
                                    if (admin) {
                                        const { data: userData } = await admin.auth.admin.getUserById(payload.sub);
                                        if (userData?.user) {
                                            user = userData.user;
                                            console.log('✅ Enhanced user data via admin API');
                                        }
                                    }
                                } catch (adminErr) {
                                    // Continue with the minimal user object
                                    console.log('⚠️ Could not enhance user data:', adminErr.message || adminErr);
                                }
                            }
                        } catch (e) {
                            console.log('❌ Failed to decode token:', e.message || e);
                        }
                    } else {
                        console.log('❌ Invalid JWT format: token should have 3 parts');
                    }
                } catch (decodeError) {
                    console.log('❌ JWT decode error:', decodeError.message || decodeError);
                }
            }
        }
    } catch (e) {
        console.error('💥 Unexpected error during auth check:', e);
    }

    console.log('🔍 User validation result:');
    console.log('  - User found:', !!user);
    console.log('  - User ID:', user?.id || 'none');
    console.log('  - User email:', user?.email || 'none');
    console.log('  - Error:', userError?.message || 'none');

    return { user, error: !user ? 'User not authenticated' : null };
}

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all user documents
 *     description: Retrieve all documents uploaded by the authenticated user
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Get all documents for authenticated user
router.get('/', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const supabase = createUserClient(authToken);

        const { data: documents, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Ensure documents are unique by id (not storage_object_id since it might be null)
        const uniqueDocuments = Array.from(
            new Map(documents.map(doc => [doc.id, doc])).values()
        );

        res.json({ documents: uniqueDocuments });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Storage Upload - Uses Admin API to handle UUID/bigint conversion
router.post('/admin-storage-upload', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 Admin Storage Upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);
        console.log('  - Token preview:', authToken ? authToken.substring(0, 30) + '...' : 'none');
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);
        console.log('  - File type:', req.file?.mimetype);

        // Validate user
        const { user, error: userError } = await validateUser(authToken);

        if (userError) {
            console.log('❌ User authentication failed:', userError);
            return res.status(401).json({ error: userError });
        }

        if (!user) {
            console.log('❌ No user returned from validation');
            return res.status(401).json({ error: 'User authentication failed' });
        }

        if (!user.id) {
            console.log('❌ User object missing ID field:', user);
            return res.status(401).json({ error: 'User ID not found' });
        }

        console.log('✅ User authenticated successfully:');
        console.log('  - User ID:', user.id);
        console.log('  - User email:', user.email || 'unknown');
        console.log('  - User aud:', user.aud || 'unknown');

        if (!req.file) {
            console.log('❌ No file provided');
            return res.status(400).json({ error: 'No file provided' });
        }

        console.log('✅ User authenticated, proceeding with admin storage upload');

        // Get the admin client
        const admin = supabaseAdmin();
        if (!admin) {
            console.error('❌ Failed to create admin client');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Generate unique IDs
        const documentId = randomUUID();
        const storageId = randomUUID(); // We'll use a UUID as a string for storage_object_id

        console.log('🆔 Generated IDs:');
        console.log('  - Document ID:', documentId);
        console.log('  - Storage ID:', storageId);

        // Create a unique file path
        const filePath = `${documentId}/${req.file.originalname}`;
        console.log('📂 File path:', filePath);

        // First, upload the file to storage using admin client
        console.log('📤 Uploading file to storage via admin API...');
        try {
            // Ensure we have the file buffer
            if (!req.file.buffer) {
                console.error('❌ File buffer is missing');
                return res.status(400).json({ error: 'File buffer is missing' });
            }

            console.log('📊 File buffer size:', req.file.buffer.length);

            const { data: uploadData, error: uploadError } = await admin.storage
                .from('documents')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false,
                });

            if (uploadError) {
                console.error('❌ Admin storage upload error:', uploadError);
                return res.status(400).json({ error: uploadError.message });
            }

            console.log('✅ File uploaded successfully to storage');

            // Get the public URL
            const { data: urlData } = await admin.storage
                .from('documents')
                .getPublicUrl(filePath);

            const publicUrl = urlData?.publicUrl;
            console.log('🔗 Public URL:', publicUrl);

            // Now create the document record with the storage reference
            // We store the storage_object_id as a string to avoid type issues
            console.log('📝 Creating document record...');
            const { data: document, error: docError } = await admin
                .from('documents')
                .insert({
                    id: documentId,
                    name: req.file.originalname,
                    storage_object_id: storageId, // Use string UUID instead of bigint
                    storage_object_path: filePath,
                    created_by: user.id,
                    file_type: req.file.mimetype,
                    file_extension: req.file.originalname.split('.').pop().toLowerCase(),
                    status: 'uploaded',
                    public_url: publicUrl
                })
                .select()
                .single();

            if (docError) {
                console.error('❌ Document creation error:', docError);
                // Try to clean up the uploaded file
                await admin.storage.from('documents').remove([filePath]);
                return res.status(400).json({ error: docError.message });
            }

            console.log('✅ Document record created successfully');

            // Also store content in document_content as a backup
            console.log('📝 Storing document content as backup...');
            try {
                const fileContent = req.file.buffer.toString('base64');

                const { error: contentError } = await admin
                    .from('document_content')
                    .insert({
                        document_id: documentId,
                        content: fileContent,
                        content_type: req.file.mimetype
                    });

                if (contentError) {
                    console.log('⚠️ Failed to store backup content:', contentError.message);
                    // This is not critical, so we don't fail the request
                } else {
                    console.log('✅ Backup content stored successfully');
                }
            } catch (contentError) {
                console.log('⚠️ Error storing backup content:', contentError.message);
                // Not critical, continue
            }

            // Automatically process the document
            try {
                console.log('🔄 Starting document processing...');
                const processUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/process`;

                const processResponse = await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ document_id: documentId })
                });

                if (!processResponse.ok) {
                    console.log('⚠️ Processing request failed:', processResponse.status);
                    const errorText = await processResponse.text();
                    console.log('⚠️ Processing error:', errorText);
                } else {
                    console.log('✅ Processing started successfully');
                }
            } catch (processError) {
                console.error('⚠️ Error starting processing:', processError);
                // Don't block the upload response
            }

            // Return success with document info
            document.processing_started = true;
            res.json({ document, redirect_to: `/chat?document_id=${documentId}` });

        } catch (storageError) {
            console.error('❌ Unexpected storage error:', storageError);
            return res.status(500).json({ error: 'Storage operation failed: ' + storageError.message });
        }
    } catch (error) {
        console.error('❌ Admin storage upload error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

/**
 * @swagger
 * /documents/upload:
 *   post:
 *     summary: Upload a new document
 *     description: Upload a document file (PDF, PowerPoint, Markdown, or Text) for processing and analysis
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Document file to upload
 *           encoding:
 *             file:
 *               contentType: application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation, application/vnd.ms-powerpoint, text/markdown, text/plain
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   $ref: '#/components/schemas/Document'
 *                 redirect_to:
 *                   type: string
 *                   description: Suggested URL to redirect to after upload
 *                   example: "/chat?document_id=doc_123"
 *                 processing_started:
 *                   type: boolean
 *                   description: Whether automatic processing was started
 *       400:
 *         description: Bad request - no file provided or invalid file type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Upload a new document
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 Upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);
        console.log('  - Token preview:', authToken ? authToken.substring(0, 30) + '...' : 'none');
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);
        console.log('  - File type:', req.file?.mimetype);

        if (!authToken) {
            console.log('❌ No authorization token provided');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!req.file) {
            console.log('❌ No file provided');
            return res.status(400).json({ error: 'No file provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);

        if (userError) {
            console.log('❌ User authentication failed:', userError);
            return res.status(401).json({ error: userError });
        }

        if (!user) {
            console.log('❌ No user returned from validation');
            return res.status(401).json({ error: 'User authentication failed' });
        }

        if (!user.id) {
            console.log('❌ User object missing ID field:', user);
            return res.status(401).json({ error: 'User ID not found' });
        }

        console.log('✅ User authenticated successfully:');
        console.log('  - User ID:', user.id);
        console.log('  - User email:', user.email || 'unknown');
        console.log('  - User aud:', user.aud || 'unknown');

        console.log('✅ User authenticated, proceeding with upload');

        // Generate unique IDs
        const documentId = randomUUID();
        console.log('🆔 Generated document ID:', documentId);

        // Create a unique file path
        const filePath = `${user.id}/${documentId}/${req.file.originalname}`;
        console.log('📂 File path:', filePath);

        // First, create the document record BEFORE uploading to storage
        // This ensures the created_by field is set properly
        console.log('📝 Creating document record first...');

        // Use admin client to bypass RLS for initial creation
        const admin = supabaseAdmin();
        if (!admin) {
            console.error('❌ Failed to create admin client');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // ---------------------------------------------------------------------------------
        // Ensure a corresponding record exists in the public.users table so the
        // foreign-key constraint (documents.created_by → users.id) is satisfied.
        // Some Supabase projects rely solely on the built-in auth.users table and do not
        // automatically mirror rows into a public.users table. If that mirror is absent
        // we create (or upsert) a minimal record with the authenticated userʼs id/email
        // before inserting the document. Using the admin client bypasses RLS.
        // ---------------------------------------------------------------------------------
        try {
            const { count, error: userSelectError } = await admin
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('id', user.id);

            if (userSelectError) {
                console.log('⚠️ Could not verify user presence in public.users:', userSelectError.message);
            }

            if (count === 0) {
                console.log('👤 No matching row in public.users – inserting minimal profile');
                const { error: userInsertError } = await admin
                    .from('users')
                    .insert({ id: user.id, email: user.email || null });

                if (userInsertError) {
                    console.log('⚠️ Failed to insert user row (non-fatal):', userInsertError.message);
                } else {
                    console.log('✅ public.users row created');
                }
            }
        } catch (ensureUserErr) {
            console.log('⚠️ Unexpected error while ensuring user row:', ensureUserErr.message || ensureUserErr);
        }

        const documentData = {
            id: documentId,
            name: req.file.originalname,
            created_by: user.id,
            file_type: req.file.mimetype,
            file_extension: req.file.originalname.split('.').pop().toLowerCase(),
            status: 'uploading',
            processed: false
        };

        console.log('📝 Document data to insert:', JSON.stringify(documentData, null, 2));

        const { data: document, error: docError } = await admin
            .from('documents')
            .insert(documentData)
            .select()
            .single();

        if (docError) {
            console.error('❌ Document creation error:', docError);
            return res.status(400).json({ error: 'Document creation failed: ' + docError.message });
        }

        console.log('✅ Document record created successfully');

        // Update optional columns if they exist (storage_object_path, public_url)
        try {
            const { error: colCheck } = await admin
                .from('documents')
                .select('storage_object_path, public_url')
                .limit(1);

            if (!colCheck) {
                await admin
                    .from('documents')
                    .update({
                        storage_object_path: filePath,
                        public_url: filePath
                    })
                    .eq('id', documentId);
                console.log('✅ Optional path/url columns updated');
            }
        } catch (e) {
            console.log('⚠️ Optional columns not present, skipping update');
        }

        // Now upload file to storage
        console.log('📤 Uploading file to Supabase Storage...');
        try {
            if (!req.file.buffer) {
                console.error('❌ File buffer is missing');
                // Clean up document record
                await admin.from('documents').delete().eq('id', documentId);
                return res.status(400).json({ error: 'File buffer is missing' });
            }

            console.log('📊 File buffer size:', req.file.buffer.length);

            // Use admin client for storage upload to avoid permission issues
            const { data: uploadData, error: uploadError } = await admin.storage
                .from('documents')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false,
                });

            if (uploadError) {
                console.error('❌ Storage upload error:', uploadError);
                // Clean up document record if storage upload fails
                await admin.from('documents').delete().eq('id', documentId);
                return res.status(400).json({ error: 'Storage upload failed: ' + uploadError.message });
            }

            console.log('✅ File uploaded successfully to storage');
            console.log('📊 Upload data:', uploadData);

            // Automatically process the document
            try {
                console.log('🔄 Starting document processing...');
                const processUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/process`;

                const processResponse = await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ document_id: documentId })
                });

                if (!processResponse.ok) {
                    console.log('⚠️ Processing request failed:', processResponse.status);
                    const errorText = await processResponse.text();
                    console.log('⚠️ Processing error details:', errorText);

                    // Update document status
                    await admin
                        .from('documents')
                        .update({ status: 'processing_failed' })
                        .eq('id', documentId);
                } else {
                    console.log('✅ Processing started successfully');

                    // Update document status
                    await admin
                        .from('documents')
                        .update({ status: 'processing' })
                        .eq('id', documentId);
                }
            } catch (processError) {
                console.error('⚠️ Error starting processing:', processError);
                // Don't block the upload response
            }

            // Return success with document info
            const finalDocument = {
                ...document,
                storage_object_id: uploadData.id,
                storage_object_path: filePath,
                public_url: filePath,
                processing_started: true,
                storage_uploaded: true
            };

            res.json({ document: finalDocument, redirect_to: `/chat?document_id=${documentId}` });

        } catch (storageError) {
            console.error('❌ Unexpected storage error:', storageError);
            // Clean up document record
            await admin.from('documents').delete().eq('id', documentId);
            return res.status(500).json({ error: 'Storage operation failed: ' + storageError.message });
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Direct upload route that bypasses Supabase Storage
router.post('/upload-direct', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 Direct upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);
        console.log('  - Token preview:', authToken ? authToken.substring(0, 30) + '...' : 'none');
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);
        console.log('  - File type:', req.file?.mimetype);

        if (!authToken) {
            console.log('❌ No authorization token provided');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!req.file) {
            console.log('❌ No file provided');
            return res.status(400).json({ error: 'No file provided' });
        }

        const supabase = createUserClient(authToken);

        // Get current user
        console.log('🔍 Validating user with Supabase...');

        // Try different methods to validate the user
        let user = null;
        let userError = null;

        try {
            // Method 1: Try getUser
            const getUserResult = await supabase.auth.getUser();
            if (getUserResult.data?.user) {
                user = getUserResult.data.user;
                console.log('✅ User validated via getUser');
            } else {
                userError = getUserResult.error;
                console.log('⚠️ getUser failed:', userError?.message);

                // Method 2: Try getSession
                console.log('🔍 Trying getSession...');
                const getSessionResult = await supabase.auth.getSession();
                if (getSessionResult.data?.session?.user) {
                    user = getSessionResult.data.session.user;
                    console.log('✅ User validated via getSession');
                } else {
                    console.log('⚠️ getSession also failed:', getSessionResult.error?.message);

                    // Method 3: Direct JWT decode and manual validation
                    console.log('🔍 Trying direct JWT decode and validation...');
                    try {
                        // Extract and decode JWT token manually
                        const tokenParts = authToken.split('.');
                        if (tokenParts.length === 3) {
                            try {
                                // Handle URL-safe base64 encoding
                                const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
                                // Add padding if needed
                                const pad = base64.length % 4;
                                const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;

                                const jsonPayload = Buffer.from(paddedBase64, 'base64').toString();
                                const payload = JSON.parse(jsonPayload);

                                console.log('🔍 JWT payload decoded:', {
                                    sub: payload.sub,
                                    email: payload.email,
                                    exp: payload.exp
                                });

                                // Check if token is expired
                                const now = Math.floor(Date.now() / 1000);
                                if (payload.exp && payload.exp < now) {
                                    console.log('❌ Token has expired');
                                } else if (payload.sub) {
                                    // Create a minimal user object from the token data
                                    user = {
                                        id: payload.sub,
                                        email: payload.email || 'unknown',
                                        aud: payload.aud || 'authenticated',
                                        app_metadata: payload.app_metadata || {},
                                        user_metadata: payload.user_metadata || {},
                                    };
                                    console.log('✅ User validated via JWT payload');

                                    // Try to use admin API as well if available
                                    try {
                                        const { supabaseAdmin } = await import('../lib/supabase.js');
                                        const admin = supabaseAdmin();
                                        if (admin) {
                                            const { data: userData } = await admin.auth.admin.getUserById(payload.sub);
                                            if (userData?.user) {
                                                user = userData.user;
                                                console.log('✅ Enhanced user data via admin API');
                                            }
                                        }
                                    } catch (adminErr) {
                                        // Continue with the minimal user object
                                        console.log('⚠️ Could not enhance user data:', adminErr.message || adminErr);
                                    }
                                }
                            } catch (e) {
                                console.log('❌ Failed to decode token:', e.message || e);
                            }
                        } else {
                            console.log('❌ Invalid JWT format: token should have 3 parts');
                        }
                    } catch (decodeError) {
                        console.log('❌ JWT decode error:', decodeError.message || decodeError);
                    }
                }
            }
        } catch (e) {
            console.error('💥 Unexpected error during auth check:', e);
        }

        console.log('🔍 Supabase user validation result:');
        console.log('  - User found:', !!user);
        console.log('  - User ID:', user?.id || 'none');
        console.log('  - User email:', user?.email || 'none');
        console.log('  - Error:', userError?.message || 'none');

        if (!user) {
            console.log('❌ User authentication failed');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        console.log('✅ User authenticated, proceeding with direct upload');

        // Generate unique ID for the document
        const documentId = randomUUID();
        console.log('🆔 Generated document ID:', documentId);

        // Create document record directly without storage_object_id
        console.log('🆕 Creating document record directly with ID:', documentId);
        try {
            // First, create the document record
            const { data: newDocument, error: docError } = await supabase
                .from('documents')
                .insert({
                    id: documentId, // Use the generated UUID
                    name: req.file.originalname,
                    created_by: user.id,
                    file_type: req.file.mimetype,
                    file_extension: req.file.originalname.split('.').pop().toLowerCase(),
                    status: 'uploaded_direct', // Mark as directly uploaded
                    processed: false
                })
                .select()
                .single();

            if (docError) {
                console.error('❌ Document creation error:', docError);
                return res.status(400).json({ error: docError.message });
            }

            console.log('✅ Document record created:', newDocument.id);

            // Store the file content in document_content table
            console.log('📝 Storing document content...');
            try {
                // Convert buffer to string for storage
                // For binary files like PDFs, we use base64 encoding
                const fileContent = req.file.buffer.toString('base64');
                console.log(`📊 Encoded content length: ${fileContent.length}`);

                const { data: contentData, error: contentError } = await supabase
                    .from('document_content')
                    .insert({
                        document_id: newDocument.id,
                        content: fileContent,
                        content_type: req.file.mimetype
                    })
                    .select();

                if (contentError) {
                    console.error('❌ Failed to store document content:', contentError);
                    // Clean up the document record if content storage fails
                    await supabase.from('documents').delete().eq('id', newDocument.id);
                    return res.status(500).json({ error: 'Failed to store document content: ' + contentError.message });
                }

                console.log('✅ Document content stored successfully');
                console.log('🆔 Content record ID:', contentData?.[0]?.id || 'unknown');
            } catch (contentError) {
                console.error('❌ Error storing document content:', contentError);
                // Clean up the document record if content storage fails
                await supabase.from('documents').delete().eq('id', newDocument.id);
                return res.status(500).json({ error: 'Failed to store document content: ' + contentError.message });
            }

            // Automatically process the document after upload
            try {
                console.log('🔄 Automatically processing document:', newDocument.id);

                // Start processing the document
                const processUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/process`;
                console.log('🔄 Sending process request to:', processUrl);

                const processResponse = await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ document_id: newDocument.id })
                });

                if (!processResponse.ok) {
                    console.log('⚠️ Auto-processing started but returned error:', processResponse.status);
                    const errorText = await processResponse.text();
                    console.log('⚠️ Processing error details:', errorText);

                    // Don't fail the upload if processing fails
                    // Just mark the document as needing manual processing
                    await supabase
                        .from('documents')
                        .update({
                            status: 'processing_failed',
                            processed: false
                        })
                        .eq('id', newDocument.id);

                    console.log('⚠️ Document marked as processing_failed');
                } else {
                    const processResult = await processResponse.json();
                    console.log('✅ Auto-processing started successfully:', processResult);
                }
            } catch (processError) {
                console.error('⚠️ Error starting auto-processing:', processError);
                // Don't block the upload response, just log the processing error
            }

            // Add processing status to the response
            newDocument.processing_started = true;

            res.json({ document: newDocument, redirect_to: `/chat?document_id=${newDocument.id}` });
        } catch (insertError) {
            console.error('❌ Unexpected error during document creation:', insertError);
            return res.status(500).json({ error: 'Failed to create document: ' + insertError.message });
        }
    } catch (error) {
        console.error('Direct upload error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Simple upload - Store file directly in database without Supabase Storage
router.post('/upload-simple', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 Simple upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);

        if (userError || !user || !user.id) {
            console.log('❌ User validation failed:', userError || 'No user');
            return res.status(401).json({ error: userError || 'User not authenticated' });
        }

        console.log('✅ User authenticated:', {
            id: user.id,
            email: user.email || 'unknown'
        });

        // Use user's own client to ensure proper RLS
        const supabase = createUserClient(authToken);

        // Generate document ID
        const documentId = randomUUID();
        console.log('🆔 Generated document ID:', documentId);

        // Create document record first
        console.log('📝 Creating document record...');
        const { data: document, error: docError } = await supabase
            .from('documents')
            .insert({
                id: documentId,
                name: req.file.originalname,
                created_by: user.id,
                file_type: req.file.mimetype,
                file_extension: req.file.originalname.split('.').pop().toLowerCase(),
                status: 'uploaded',
                processed: false
            })
            .select()
            .single();

        if (docError) {
            console.error('❌ Document creation error:', docError);
            return res.status(400).json({ error: 'Document creation failed: ' + docError.message });
        }

        console.log('✅ Document record created');

        // Store file content
        console.log('📝 Storing file content...');
        const fileContent = req.file.buffer.toString('base64');

        const { error: contentError } = await supabase
            .from('document_content')
            .insert({
                document_id: documentId,
                content: fileContent,
                content_type: req.file.mimetype
            });

        if (contentError) {
            console.error('❌ Failed to store content:', contentError);
            // Clean up document record
            await supabase.from('documents').delete().eq('id', documentId);
            return res.status(500).json({ error: 'Failed to store file content: ' + contentError.message });
        }

        console.log('✅ File content stored');

        // Skip automatic processing here – it will be started from the client after a successful upload to avoid duplicate runs

        res.json({
            document: {
                ...document,
                processing_started: true,
                storage_method: 'database'
            },
            redirect_to: `/chat?document_id=${documentId}`
        });

    } catch (error) {
        console.error('❌ Simple upload error:', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// Upload with RPC - Uses database function to handle storage properly
router.post('/upload-rpc', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 RPC Upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);
        console.log('  - File size MB:', (req.file?.size / 1024 / 1024).toFixed(2) + ' MB');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);

        if (userError || !user || !user.id) {
            console.log('❌ User validation failed:', userError || 'No user');
            return res.status(401).json({ error: userError || 'User not authenticated' });
        }

        console.log('✅ User authenticated:', {
            id: user.id,
            email: user.email || 'unknown'
        });

        // Use admin client
        const admin = supabaseAdmin();
        if (!admin) {
            return res.status(500).json({ error: 'Admin client not available' });
        }

        const documentId = randomUUID();
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = `uploads/${user.id}/${documentId}/${fileName}`;

        console.log('📝 Upload details:', {
            documentId,
            fileName,
            filePath,
            userId: user.id
        });

        // First create the document record with all required fields
        console.log('📝 Creating document record first...');
        const { data: document, error: docError } = await admin
            .from('documents')
            .insert({
                id: documentId,
                name: req.file.originalname,
                created_by: user.id,
                file_type: req.file.mimetype,
                file_extension: req.file.originalname.split('.').pop().toLowerCase(),
                status: 'uploading',
                processed: false
            })
            .select()
            .single();

        if (docError) {
            console.error('❌ Document creation failed:', docError);
            return res.status(400).json({ error: 'Failed to create document: ' + docError.message });
        }

        console.log('✅ Document created successfully');

        // Upload to storage with a different approach
        try {
            // Create a new bucket if needed or use a different bucket
            const bucketName = 'documents'; // Try a different bucket name

            // Check if bucket exists
            const { data: buckets } = await admin.storage.listBuckets();
            const bucketExists = buckets?.some(b => b.name === bucketName);

            if (!bucketExists) {
                console.log('📦 Creating new bucket:', bucketName);
                const { error: createBucketError } = await admin.storage.createBucket(bucketName, {
                    public: false,
                    fileSizeLimit: 52428800 // 50MB
                });

                if (createBucketError) {
                    console.log('⚠️ Could not create bucket:', createBucketError.message);
                }
            }

            // Upload to the bucket
            console.log('📤 Uploading to bucket:', bucketName);
            console.log('📊 File details:');
            console.log('  - Buffer size:', req.file.buffer.length);
            console.log('  - File path:', filePath);
            console.log('  - Content type:', req.file.mimetype);

            const { data: uploadData, error: uploadError } = await admin.storage
                .from('documents')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('❌ Storage upload error:', uploadError);
                console.error('  - Error code:', uploadError.statusCode);
                console.error('  - Error message:', uploadError.message);

                // Fall back to storing in database
                console.log('⚠️ Falling back to database storage');

                const { error: contentError } = await admin
                    .from('document_content')
                    .insert({
                        document_id: documentId,
                        content: req.file.buffer.toString('base64'),
                        content_type: req.file.mimetype
                    });

                if (contentError) {
                    await admin.from('documents').delete().eq('id', documentId);
                    return res.status(500).json({ error: 'Failed to store file: ' + contentError.message });
                }

                // Update document status
                await admin
                    .from('documents')
                    .update({
                        status: 'uploaded',
                        storage_object_id: null,
                        storage_object_path: null
                    })
                    .eq('id', documentId);

            } else {
                console.log('✅ File uploaded to storage successfully');
                console.log('📊 Upload result:', JSON.stringify(uploadData, null, 2));

                // List files in the bucket to confirm
                console.log('📋 Listing files in bucket to confirm upload...');
                const { data: files, error: listError } = await admin.storage
                    .from('documents')
                    .list(path.dirname(filePath), {
                        limit: 10,
                        offset: 0
                    });

                if (!listError && files) {
                    console.log('📁 Files in directory:', files.map(f => f.name).join(', '));
                } else {
                    console.log('⚠️ Could not list files:', listError?.message);
                }

                // Get public URL
                const { data: urlData } = await admin.storage
                    .from('documents')
                    .getPublicUrl(filePath);

                console.log('🔗 Public URL:', urlData?.publicUrl);

                // Also store in document_content as backup
                console.log('📝 Storing backup in document_content...');
                const { error: backupError } = await admin
                    .from('document_content')
                    .insert({
                        document_id: documentId,
                        content: req.file.buffer.toString('base64'),
                        content_type: req.file.mimetype
                    });

                if (backupError) {
                    console.log('⚠️ Backup storage failed:', backupError.message);
                } else {
                    console.log('✅ Backup stored successfully');
                }

                // Update document with storage info
                const updateData = {
                    status: 'uploaded',
                    storage_object_id: uploadData.path || uploadData.id || filePath,
                    storage_object_path: filePath
                };

                // Try to add public_url if column exists
                try {
                    const { error: checkError } = await admin
                        .from('documents')
                        .select('public_url')
                        .limit(1);

                    if (!checkError) {
                        updateData.public_url = urlData?.publicUrl;
                    }
                } catch (e) {
                    console.log('⚠️ public_url column may not exist');
                }

                const { error: updateError } = await admin
                    .from('documents')
                    .update(updateData)
                    .eq('id', documentId);

                if (updateError) {
                    console.log('⚠️ Failed to update document:', updateError.message);
                } else {
                    console.log('✅ Document updated with storage info');
                }
            }

            // Start processing
            try {
                const processUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/process`;
                const processResponse = await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ document_id: documentId })
                });

                if (processResponse.ok) {
                    console.log('✅ Processing started');
                }
            } catch (processError) {
                console.error('⚠️ Processing error:', processError);
            }

            res.json({
                document: {
                    ...document,
                    storage_object_path: filePath,
                    processing_started: true
                },
                redirect_to: `/chat?document_id=${documentId}`
            });

        } catch (storageError) {
            console.error('❌ Storage error:', storageError);
            await admin.from('documents').delete().eq('id', documentId);
            return res.status(500).json({ error: 'Storage failed: ' + storageError.message });
        }

    } catch (error) {
        console.error('❌ RPC upload error:', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// Local file upload - stores files in frontend public folder
router.post('/upload-local', upload.single('file'), async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('📤 Local upload request received');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - File provided:', !!req.file);
        console.log('  - File name:', req.file?.originalname);
        console.log('  - File size:', req.file?.size);
        console.log('  - File type:', req.file?.mimetype);

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: userError || 'User authentication failed' });
        }

        console.log('✅ User authenticated:', user.id);

        // Generate unique IDs
        const documentId = randomUUID();
        const timestamp = Date.now();
        const safeFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeFileName}`;

        // Create upload directory path in frontend public folder
        const uploadDir = path.join(process.cwd(), '..', 'public', 'uploads', user.id, documentId);
        const filePath = path.join(uploadDir, fileName);
        const publicPath = `/uploads/${user.id}/${documentId}/${fileName}`;

        console.log('📁 Creating upload directory:', uploadDir);

        // Create directory if it doesn't exist
        await fsPromises.mkdir(uploadDir, { recursive: true });

        // Write file to disk
        console.log('💾 Writing file to disk:', filePath);
        await fsPromises.writeFile(filePath, req.file.buffer);

        console.log('✅ File saved successfully');

        // Use admin client to create document record
        const admin = supabaseAdmin();
        if (!admin) {
            // Clean up file
            await fsPromises.unlink(filePath);
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Ensure user exists in public.users table
        try {
            const { count } = await admin
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('id', user.id);

            if (count === 0) {
                console.log('👤 Creating user record in public.users');
                await admin
                    .from('users')
                    .insert({ id: user.id, email: user.email || null });
            }
        } catch (err) {
            console.log('⚠️ Error checking/creating user:', err.message);
        }

        // Create document record
        const documentData = {
            id: documentId,
            name: req.file.originalname,
            created_by: user.id,
            file_type: req.file.mimetype,
            file_extension: req.file.originalname.split('.').pop().toLowerCase(),
            status: 'uploaded',
            processed: false
        };

        console.log('📝 Creating document record:', documentData);

        const { data: document, error: docError } = await admin
            .from('documents')
            .insert(documentData)
            .select()
            .single();

        if (docError) {
            console.error('❌ Document creation error:', docError);
            // Clean up file
            await fsPromises.unlink(filePath);
            return res.status(400).json({ error: 'Document creation failed: ' + docError.message });
        }

        console.log('✅ Document record created successfully');

        // Update optional columns if they exist (storage_object_path, public_url)
        try {
            const { error: colCheck } = await admin
                .from('documents')
                .select('storage_object_path, public_url')
                .limit(1);

            if (!colCheck) {
                await admin
                    .from('documents')
                    .update({
                        storage_object_path: publicPath,
                        public_url: publicPath
                    })
                    .eq('id', documentId);
                console.log('✅ Optional path/url columns updated');
            }
        } catch (e) {
            console.log('⚠️ Optional columns not present, skipping update');
        }

        // Also store content in document_content as backup
        try {
            const fileContent = req.file.buffer.toString('base64');
            await admin
                .from('document_content')
                .insert({
                    document_id: documentId,
                    content: fileContent,
                    content_type: req.file.mimetype
                });
            console.log('✅ Backup content stored in database');
        } catch (err) {
            console.log('⚠️ Failed to store backup content:', err.message);
        }

        // Skip automatic processing here – it will be started from the client after a successful upload to avoid duplicate runs

        // Return success
        res.json({
            document: {
                ...document,
                local_storage: true,
                file_path: publicPath
            },
            redirect_to: `/chat?document_id=${documentId}`
        });

    } catch (error) {
        console.error('❌ Local upload error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get a specific document
router.get('/:id', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const supabase = createUserClient(authToken);

        const { data: document, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document });
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a document
router.delete('/:id', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const supabase = createUserClient(authToken);

        // First get the document record
        const { data: document, error: fetchError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchError) {
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log('🗑️ Deleting document:', document.id, document.name, 'Storage ID:', document.storage_object_id);

        // Get the storage object ID
        const storageObjectId = document.storage_object_id;
        console.log('📄 Storage object ID:', storageObjectId);

        // First, delete the document record from the database
        // This is important to do first to break the foreign key relationship
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', req.params.id);

        if (deleteError) {
            console.error('❌ Failed to delete document record:', deleteError);
            return res.status(400).json({ error: deleteError.message });
        }

        console.log('✅ Document record deleted successfully');

        // Now try to clean up the storage object if possible
        // We'll try multiple approaches since direct deletion by ID isn't available

        try {
            // First, try to find all storage objects and delete any that match our document
            const { data: storageObjects } = await supabase.storage
                .from('files')
                .list('', { limit: 100 });

            console.log(`📁 Found ${storageObjects?.length || 0} storage objects to check`);

            if (storageObjects && storageObjects.length > 0) {
                // Look for folders that might contain our file
                for (const item of storageObjects) {
                    if (item.id === storageObjectId || (item.metadata && item.metadata.id === storageObjectId)) {
                        console.log('🎯 Found exact match by ID:', item.name);
                        const { error } = await supabase.storage
                            .from('files')
                            .remove([item.name]);

                        if (error) {
                            console.log('⚠️ Failed to delete matched file:', error.message);
                        } else {
                            console.log('✅ Successfully deleted exact match');
                        }
                    }

                    // Check if it's a folder
                    if (item.id !== storageObjectId && !item.metadata) {
                        console.log('📂 Checking folder:', item.name);
                        // List contents of this folder
                        const { data: folderContents } = await supabase.storage
                            .from('files')
                            .list(item.name, { limit: 100 });

                        if (folderContents && folderContents.length > 0) {
                            for (const fileItem of folderContents) {
                                const fullPath = `${item.name}/${fileItem.name}`;
                                console.log('📄 Checking file:', fullPath);

                                // Try to delete this file as a best effort
                                const { error } = await supabase.storage
                                    .from('files')
                                    .remove([fullPath]);

                                if (!error) {
                                    console.log('✅ Successfully deleted file:', fullPath);
                                }
                            }
                        }
                    }
                }
            }
        } catch (storageError) {
            console.error('💥 Error during storage cleanup:', storageError);
            // Continue since we already deleted the document record
        }

        // Return success even if storage deletion failed
        // The document record is gone which is what matters most
        return res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('💥 Delete document error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint to verify authentication and database connectivity
router.get('/test-auth', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('🧪 Test auth endpoint called');
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Test user validation
        const { user, error: userError } = await validateUser(authToken);

        if (userError) {
            console.log('❌ User validation failed:', userError);
            return res.status(401).json({ error: userError });
        }

        if (!user || !user.id) {
            console.log('❌ No valid user found');
            return res.status(401).json({ error: 'Invalid user data' });
        }

        console.log('✅ User validation successful:', {
            id: user.id,
            email: user.email || 'unknown'
        });

        // Test admin client
        const admin = supabaseAdmin();
        if (!admin) {
            return res.status(500).json({ error: 'Admin client not available' });
        }

        // Test database connectivity
        const { data: testData, error: testError } = await admin
            .from('documents')
            .select('id')
            .limit(1);

        if (testError) {
            console.log('❌ Database test failed:', testError);
            return res.status(500).json({ error: 'Database connectivity failed: ' + testError.message });
        }

        console.log('✅ Database test successful');

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email || 'unknown',
                aud: user.aud || 'unknown'
            },
            database: 'connected',
            admin_client: 'available'
        });

    } catch (error) {
        console.error('❌ Test auth error:', error);
        res.status(500).json({ error: 'Test failed: ' + error.message });
    }
});

export default router;
