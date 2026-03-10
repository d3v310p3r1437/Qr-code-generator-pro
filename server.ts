
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Admin Client (using Service Role Key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ CRITICAL ERROR: Supabase configuration missing!');
  console.error('URL present:', !!supabaseUrl);
  console.error('Service Role Key present:', !!serviceRoleKey);
}

let supabaseAdmin: any = null;
try {
  if (supabaseUrl && serviceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase Admin client initialized successfully');
  }
} catch (err) {
  console.error('❌ Failed to initialize Supabase Admin client:', err);
}

// API Request Logger
app.use('/api', (req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'not_tested';
  let dbError = null;

  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('profiles').select('count', { count: 'exact', head: true });
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
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// API Route for Admin to create users
app.post('/api/admin/create-user', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase Admin client not configured' });
  }

  const { email, password, role, qr_limit } = req.body;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    const { error: profileError } = await supabaseAdmin
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
app.get('/api/profile/:id', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase Admin client not configured. Check your environment variables.' });
  }

  const { id } = req.params;

  try {
    console.log(`[Profile] Fetching profile for ID: ${id}`);
    let { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.log(`[Profile] Initial fetch error for ${id}:`, error.message);
    }

    if (error && (error.code === 'PGRST116' || error.message.includes('JSON object'))) {
      console.log(`[Profile] Profile missing for ${id}, checking Auth...`);
      const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
      
      if (!authError && user) {
        console.log(`[Profile] User found in Auth, creating profile for ${id}...`);
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'user',
            qr_limit: 10
          })
          .select()
          .single();
        
        if (!createError) {
          console.log(`[Profile] Successfully created profile for ${id}`);
          data = newProfile;
        } else {
          console.error(`[Profile] Failed to auto-create profile for ${id}:`, createError.message);
        }
      }
    }

    if (!data) {
      throw new Error(`Profile ${id} not found in database or Auth`);
    }
    
    res.json(data);
  } catch (error: any) {
    console.error(`[Profile] Final error for ${id}:`, error.message);
    res.status(404).json({ 
      error: error.message || 'Profile not found',
      code: error.code || 'NOT_FOUND'
    });
  }
});

// ... (remaining routes stay the same, but I'll include them for completeness in the chunk)
// Get All Profiles
app.get('/api/admin/profiles', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get All QR Codes
app.get('/api/admin/qr-codes', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await supabaseAdmin.from('qr_codes').select('*, profiles(email)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save QR Code
app.post('/api/qr-codes', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await supabaseAdmin.from('qr_codes').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update QR Code
app.patch('/api/qr-codes/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin.from('qr_codes').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete QR Code
app.delete('/api/qr-codes/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('qr_codes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Profile
app.delete('/api/admin/profiles/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get User QR Codes
app.get('/api/user/qr-codes/:userId', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { userId } = req.params;
  try {
    const { data, error } = await supabaseAdmin.from('qr_codes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// QR Redirect
app.get('/r/:id', async (req, res) => {
  const { id } = req.params;
  if (!supabaseAdmin) return res.status(500).send('Server configuration error');
  try {
    const { data: qr, error: fetchError } = await supabaseAdmin.from('qr_codes').select('*').eq('id', id).single();
    if (fetchError || !qr) return res.status(404).send('QR code not found');
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) return res.status(410).send('QR code has expired');
    await supabaseAdmin.from('qr_codes').update({ scan_count: (qr.scan_count || 0) + 1 }).eq('id', id);
    res.redirect(qr.target_url);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

export default app;
