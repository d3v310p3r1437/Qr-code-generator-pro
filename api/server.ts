
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Increase payload limit for large QR logos
app.use(express.json({ limit: '10mb' }));

// Custom JSON error handler for malformed JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next();
});

// Supabase Admin Client (using Service Role Key)
let _supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase configuration missing in getSupabaseAdmin');
    return null;
  }

  try {
    _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase Admin client initialized');
    return _supabaseAdmin;
  } catch (err) {
    console.error('❌ Failed to initialize Supabase Admin client:', err);
    return null;
  }
}

const apiRouter = express.Router();

// API Request Logger
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
apiRouter.get('/health', async (req, res) => {
  const admin = getSupabaseAdmin();
  let dbStatus = 'not_configured';
  let dbError = null;

  if (admin) {
    try {
      const { error } = await admin.from('profiles').select('count', { count: 'exact', head: true });
      dbStatus = error ? 'error' : 'connected';
      dbError = error ? error.message : null;
    } catch (err: any) {
      dbStatus = 'exception';
      dbError = err.message;
    }
  }

  res.json({
    status: 'ok',
    db: { status: dbStatus, error: dbError },
    config: {
      hasUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY),
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
  });
});

// API Route for Admin to create users
apiRouter.post('/admin/create-user', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Supabase Admin client not configured' });
  }

  const { email, password, role, qr_limit } = req.body;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        role: role || 'user',
        qr_limit: role === 'admin' ? 999999 : (qr_limit || 10)
      });

    if (profileError) throw profileError;

    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get Profile
apiRouter.get('/profile/:id', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Supabase Admin client not configured' });
  }

  const { id } = req.params;

  try {
    let { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error && (error.code === 'PGRST116' || error.message.includes('JSON object'))) {
      const { data: { user }, error: authError } = await admin.auth.admin.getUserById(id);
      
      if (!authError && user) {
        const { data: newProfile, error: createError } = await admin
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'user',
            qr_limit: 10
          })
          .select()
          .single();
        
        if (!createError) data = newProfile;
      }
    }

    if (!data) throw new Error(`Profile ${id} not found`);
    res.json(data);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get All Profiles with QR counts
apiRouter.get('/admin/profiles', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    // Fetch profiles
    const { data: profiles, error: profileError } = await admin.from('profiles').select('*').order('created_at', { ascending: false });
    if (profileError) throw profileError;

    // Fetch QR counts for each user
    const { data: qrCounts, error: qrError } = await admin.from('qr_codes').select('user_id');
    if (qrError) throw qrError;

    const countsMap: Record<string, number> = {};
    qrCounts.forEach((qr: any) => {
      countsMap[qr.user_id] = (countsMap[qr.user_id] || 0) + 1;
    });

    const profilesWithCounts = profiles.map((p: any) => ({
      ...p,
      qr_count: countsMap[p.id] || 0
    }));

    res.json(profilesWithCounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get All QR Codes
apiRouter.get('/admin/qr-codes', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await admin.from('qr_codes').select('*, profiles(email)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save QR Code
apiRouter.post('/qr-codes', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await admin.from('qr_codes').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update QR Code
apiRouter.patch('/qr-codes/:id', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { data, error } = await admin.from('qr_codes').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete QR Code
apiRouter.delete('/qr-codes/:id', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { error } = await admin.from('qr_codes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Profile
apiRouter.delete('/admin/profiles/:id', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { error } = await admin.from('profiles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get User QR Codes
apiRouter.get('/user/qr-codes/:userId', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { userId } = req.params;
  try {
    const { data, error } = await admin.from('qr_codes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Analytics for a QR Code
apiRouter.get('/qr-codes/:id/analytics', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { data, error } = await admin
      .from('scan_logs')
      .select('created_at')
      .eq('qr_id', id)
      .order('created_at', { ascending: true });
    
    if (error) {
      // If table doesn't exist yet, return empty array instead of erroring
      if (error.code === 'PGRST116' || error.message.includes('relation "scan_logs" does not exist')) {
        return res.json([]);
      }
      throw error;
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mount API Router
app.use('/api', apiRouter);

// QR Redirect (outside /api)
// This handles the short URLs like /r/123
app.get('/r/:id', async (req, res) => {
  const { id } = req.params;
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).send('Server configuration error');
  try {
    const { data: qr, error: fetchError } = await admin.from('qr_codes').select('*').eq('id', id).single();
    if (fetchError || !qr) {
      console.error(`[Redirect] QR code ${id} not found:`, fetchError);
      return res.status(404).send('QR code not found');
    }
    
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
      return res.status(410).send('QR code has expired');
    }

    // Increment scan count and log scan asynchronously
    Promise.all([
      admin.from('qr_codes')
        .update({ scan_count: (qr.scan_count || 0) + 1 })
        .eq('id', id),
      admin.from('scan_logs')
        .insert({ qr_id: id })
    ]).then(([updateRes, logRes]) => {
      if (updateRes.error) console.error(`[Redirect] Failed to increment scan count for ${id}:`, updateRes.error);
      if (logRes.error) {
        // Silently fail if table doesn't exist, but log it
        if (!logRes.error.message.includes('relation "scan_logs" does not exist')) {
          console.error(`[Redirect] Failed to log scan for ${id}:`, logRes.error);
        }
      }
      console.log(`[Redirect] Successfully processed scan for ${id}`);
    });

    res.redirect(qr.target_url);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
});

// Global 404 handler for API requests
app.use((req, res, next) => {
  if (req.url.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({ 
      error: `Not Found: ${req.method} ${req.url}`,
      suggestion: 'Check if the API route is correctly defined'
    });
  }
  next();
});

async function setupServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    // Dynamic import vite only in dev to avoid production dependency issues
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files if NOT on Vercel (Vercel handles this via vercel.json)
    const distPath = path.resolve(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Initialize server setup only if NOT on Vercel
if (!process.env.VERCEL) {
  setupServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to setup server:', err);
    // Still start the server even if Vite fails, so API might work
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT} (Vite failed)`);
    });
  });
}

export default app;
