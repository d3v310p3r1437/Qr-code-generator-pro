
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase Admin Client (using Service Role Key)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('⚠️ Supabase URL or Service Role Key is missing in environment variables.');
    console.warn('Backend API routes requiring admin privileges will fail.');
  }

  const supabaseAdmin = (supabaseUrl && serviceRoleKey) 
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

  // API Route for Admin to create users without session swap
  app.post('/api/admin/create-user', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }

    const { email, password, role, qr_limit } = req.body;

    try {
      // 1. Create user using Admin API (does not sign in)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Auto confirm since admin is creating
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // 2. Create/Update Profile
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

  // Get Profile (using admin client to bypass RLS)
  app.get('/api/profile/:id', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }

    const { id } = req.params;

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(404).json({ error: 'Profile not found' });
    }
  });

  // Get All Profiles (Admin only)
  app.get('/api/admin/profiles', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get All QR Codes (Admin only)
  app.get('/api/admin/qr-codes', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('qr_codes')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save QR Code (using admin client to bypass RLS)
  app.post('/api/qr-codes', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('qr_codes')
        .insert(req.body)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update QR Code (using admin client to bypass RLS)
  app.patch('/api/qr-codes/:id', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    const { id } = req.params;
    try {
      const { data, error } = await supabaseAdmin
        .from('qr_codes')
        .update(req.body)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete QR Code (using admin client to bypass RLS)
  app.delete('/api/qr-codes/:id', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    const { id } = req.params;
    try {
      const { error } = await supabaseAdmin
        .from('qr_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete Profile (using admin client to bypass RLS)
  app.delete('/api/admin/profiles/:id', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    const { id } = req.params;
    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get User QR Codes (using admin client to bypass RLS)
  app.get('/api/user/qr-codes/:userId', async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase Admin client not configured' });
    }
    const { userId } = req.params;
    try {
      const { data, error } = await supabaseAdmin
        .from('qr_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Redirect and Scan Count Increment
  app.get('/r/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!supabaseAdmin) {
      return res.status(500).send('Server configuration error');
    }

    try {
      // 1. Get QR data
      const { data: qr, error: fetchError } = await supabaseAdmin
        .from('qr_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !qr) {
        return res.status(404).send('QR code not found');
      }

      // 2. Check expiration
      if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
        return res.status(410).send('QR code has expired');
      }

      // 3. Increment scan count (using admin client to bypass RLS)
      await supabaseAdmin
        .from('qr_codes')
        .update({ scan_count: (qr.scan_count || 0) + 1 })
        .eq('id', id);

      // 4. Redirect
      res.redirect(qr.target_url);
    } catch (error) {
      console.error('Redirect error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
