
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { UAParser } from 'ua-parser-js';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cookieParser());

// Trust proxy to get real client IP behind Nginx/Cloud Run
// Setting to 1 instead of true to avoid express-rate-limit ValidationError
app.set('trust proxy', 1);

// Rate limiting for scan and redirect endpoints
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per `window` (here, per 1 minute)
  message: { error: 'Хэт олон хандалт хийсэн байна. Түр хүлээнэ үү.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple in-memory cache to prevent double-logging from the same IP within a short window
const recentScans = new Map<string, number>();
const CLEANUP_INTERVAL = 60000; // 1 minute
const DEBOUNCE_WINDOW = 2000; // 2 seconds

setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentScans.entries()) {
    if (now - time > DEBOUNCE_WINDOW) {
      recentScans.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Increase payload limit for large QR logos
app.use(express.json({ limit: '30mb' }));

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

// Ping route for testing
apiRouter.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Middleware to verify Supabase JWT
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[Auth] Checking auth for ${req.method} ${req.url}`);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn(`[Auth] Missing auth header for ${req.url}`);
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const admin = getSupabaseAdmin();
  
  if (!admin) {
    console.error('[Auth] Supabase Admin not configured');
    return res.status(500).json({ error: 'Supabase Admin client not configured' });
  }

  try {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) {
      console.warn(`[Auth] Invalid token for ${req.url}:`, error?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.log(`[Auth] User authenticated: ${user.email}`);
    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error(`[Auth] Exception during auth for ${req.url}:`, err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const admin = getSupabaseAdmin();
  try {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

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
apiRouter.post('/admin/create-user', requireAuth, requireAdmin, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Supabase Admin client not configured' });
  }

  const { email, password, role, qr_limit, allowed_qr_types } = req.body;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    const profileData: any = {
      id: authData.user.id,
      email,
      role: role || 'user',
      qr_limit: role === 'admin' ? 999999 : (qr_limit || 10)
    };

    if (allowed_qr_types) {
      profileData.allowed_qr_types = allowed_qr_types;
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert(profileData);

    if (profileError) throw profileError;

    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get Profile
apiRouter.get('/profile/:id', requireAuth, async (req, res) => {
  console.log(`[API] Profile request for ID: ${req.params.id}`);
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
apiRouter.get('/admin/profiles', requireAuth, requireAdmin, async (req, res) => {
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
apiRouter.get('/admin/qr-codes', requireAuth, requireAdmin, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const { data, error } = await admin.from('qr_codes').select('*, profiles(email)').order('created_at', { ascending: false });
    if (error) throw error;

    // Strip password hash
    const safeData = data.map((qr: any) => {
      if (qr.config && qr.config.password) {
        const { password, ...safeConfig } = qr.config;
        return { ...qr, config: safeConfig, has_password: true };
      }
      return { ...qr, has_password: false };
    });

    res.json(safeData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save QR Code
apiRouter.post('/qr-codes', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  try {
    const user = (req as any).user;
    const { data: profile } = await admin.from('profiles').select('role, allowed_qr_types, expires_at, qr_limit').eq('id', user.id).single();
    
    if (profile && profile.role !== 'admin') {
      if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
        return res.status(403).json({ error: 'Your account has expired. Please contact the administrator.' });
      }
      if (profile.allowed_qr_types && profile.allowed_qr_types.length > 0) {
        if (!profile.allowed_qr_types.includes(req.body.type)) {
          return res.status(403).json({ error: 'You are not allowed to create this type of QR code.' });
        }
      }
      const { count } = await admin.from('qr_codes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count || 0) >= profile.qr_limit) {
        return res.status(403).json({ error: 'QR кодын лимит хэтэрсэн байна.' });
      }
    }

    const qrData = { ...req.body };
    if (qrData.config && qrData.config.password) {
      const bcrypt = await import('bcrypt');
      const salt = await bcrypt.genSalt(10);
      qrData.config.password = await bcrypt.hash(qrData.config.password, salt);
    }

    const { data, error } = await admin.from('qr_codes').insert(qrData).select().single();
    if (error) throw error;
    
    // Strip password hash from response
    if (data.config && data.config.password) {
      const { password, ...safeConfig } = data.config;
      data.config = safeConfig;
      data.has_password = true;
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk Save vCard QR Codes
apiRouter.post('/qr-codes/bulk', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  
  try {
    const user = (req as any).user;
    const { data: profile } = await admin.from('profiles').select('role, allowed_qr_types, expires_at, qr_limit').eq('id', user.id).single();
    
    if (profile && profile.role !== 'admin') {
      if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
        return res.status(403).json({ error: 'Your account has expired. Please contact the administrator.' });
      }
      if (profile.allowed_qr_types && profile.allowed_qr_types.length > 0) {
        if (!profile.allowed_qr_types.includes('vcard')) {
          return res.status(403).json({ error: 'You are not allowed to create this type of QR code.' });
        }
      }
    }

    const { items, config } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    let processedConfig = { ...config };
    if (processedConfig.password) {
      const bcrypt = await import('bcrypt');
      const salt = await bcrypt.genSalt(10);
      processedConfig.password = await bcrypt.hash(processedConfig.password, salt);
    }

    if (profile && profile.role !== 'admin') {
      const { count } = await admin.from('qr_codes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const currentCount = count || 0;
      if (currentCount + items.length > profile.qr_limit) {
        return res.status(403).json({ error: `QR кодын лимит хэтэрлээ. Таны үлдэгдэл: ${profile.qr_limit - currentCount}` });
      }
    }

    const results = [];
    
    for (const item of items) {
      const vcardString = `BEGIN:VCARD\nVERSION:3.0\nN:${item.lastName || ''};${item.firstName || ''};;;\nFN:${item.firstName || ''} ${item.lastName || ''}\nORG:${item.organization || ''}${item.department ? ';' + item.department : ''}\nTITLE:${item.title || ''}\nTEL;TYPE=WORK,VOICE:${item.phone || ''}\nTEL;TYPE=CELL,VOICE:${item.personalPhone || ''}\nEMAIL;TYPE=PREF,INTERNET:${item.email || ''}\nURL:${item.website || ''}\nADR;TYPE=WORK:;;${item.address || ''};;;;\nEND:VCARD`;
      
      // Insert DB record first to get ID
      const qrRecord = {
        user_id: user.id,
        title: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'vCard',
        type: 'vcard',
        value: vcardString,
        bio_data: item,
        config: processedConfig
      };
      
      const { data: insertedQr, error: insertError } = await admin.from('qr_codes').insert(qrRecord).select().single();
      if (insertError) throw insertError;
      
      // Generate QR Image
      const targetUrl = `${req.protocol}://${req.get('host')}/r/${insertedQr.id}`;
      const qrBuffer = await QRCode.toBuffer(targetUrl, {
        errorCorrectionLevel: config?.level || 'M',
        margin: 2,
        width: 1024,
        color: {
          dark: config?.fgColor || '#000000',
          light: config?.bgColor || '#ffffff'
        }
      });
      
      // Upload to Supabase Storage
      const fileName = `${user.id}/${insertedQr.id}.png`;
      const { error: uploadError } = await admin.storage
        .from('qrcodes')
        .upload(fileName, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = admin.storage
        .from('qrcodes')
        .getPublicUrl(fileName);
        
      // Update record with image URL and target URL
      const { data: updatedQr, error: updateError } = await admin.from('qr_codes')
        .update({ qr_image_url: publicUrl, target_url: targetUrl })
        .eq('id', insertedQr.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      
      if (updatedQr.config && updatedQr.config.password) {
        const { password, ...safeConfig } = updatedQr.config;
        updatedQr.config = safeConfig;
        updatedQr.has_password = true;
      }
      
      results.push(updatedQr);
    }
    
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    console.error('Bulk generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update QR Code
apiRouter.patch('/qr-codes/:id', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const { data: qr, error: fetchError } = await admin.from('qr_codes').select('user_id').eq('id', id).single();
    if (fetchError || !qr) return res.status(404).json({ error: 'QR code not found' });

    if (qr.user_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized to update this QR code' });
      }
    }

    const updateData = { ...req.body };
    if (updateData.config && updateData.config.password) {
      const bcrypt = await import('bcrypt');
      const salt = await bcrypt.genSalt(10);
      updateData.config.password = await bcrypt.hash(updateData.config.password, salt);
    }

    const { data, error } = await admin.from('qr_codes').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    
    // Strip password hash from response
    if (data.config && data.config.password) {
      const { password, ...safeConfig } = data.config;
      data.config = safeConfig;
      data.has_password = true;
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete QR Code
apiRouter.delete('/qr-codes/:id', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const { data: qr, error: fetchError } = await admin.from('qr_codes').select('user_id, qr_image_url').eq('id', id).single();
    if (fetchError || !qr) throw new Error('QR code not found');

    if (qr.user_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized to delete this QR code' });
      }
    }

    // Delete from Storage if exists
    if (qr.qr_image_url) {
      const fileName = qr.qr_image_url.split('/').pop();
      if (fileName) {
        await admin.storage.from('qrcodes').remove([fileName]);
      }
    }

    const { error } = await admin.from('qr_codes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Profile
apiRouter.patch('/admin/profiles/:id', requireAuth, requireAdmin, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  const { qr_limit, allowed_qr_types, expires_at } = req.body;

  try {
    const updateData: any = {};
    if (qr_limit !== undefined) updateData.qr_limit = qr_limit;
    if (allowed_qr_types !== undefined) updateData.allowed_qr_types = allowed_qr_types;
    if (expires_at !== undefined) updateData.expires_at = expires_at;

    const { data, error } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Profile
apiRouter.delete('/admin/profiles/:id', requireAuth, requireAdmin, async (req, res) => {
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
apiRouter.get('/user/qr-codes/:userId', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { userId } = req.params;
  try {
    const { data, error } = await admin.from('qr_codes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    
    // Strip password hash
    const safeData = data.map((qr: any) => {
      if (qr.config && qr.config.password) {
        const { password, ...safeConfig } = qr.config;
        return { ...qr, config: safeConfig, has_password: true };
      }
      return { ...qr, has_password: false };
    });
    
    res.json(safeData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Analytics for a QR Code
apiRouter.get('/qr-codes/:id/analytics', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { data, error } = await admin
      .from('scan_logs')
      .select('scanned_at, ip_address, user_agent, device_type, os_name, browser_name, country, city')
      .eq('qr_code_id', id)
      .order('scanned_at', { ascending: true });
    
    if (error) {
      // If table doesn't exist yet, return empty array instead of erroring
      // 42P01 is the standard Postgres error for "relation does not exist"
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message.includes('relation "scan_logs" does not exist')) {
        console.log(`[API] scan_logs table not found for QR ${id}, returning empty analytics`);
        return res.json([]);
      }
      throw error;
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Scan Counts with Logs
apiRouter.post('/admin/sync-counts', requireAuth, requireAdmin, async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  
  try {
    // 1. Get all QR codes
    const { data: qrCodes, error: qrError } = await admin.from('qr_codes').select('id');
    if (qrError) throw qrError;

    const results = [];
    for (const qr of qrCodes) {
      // 2. Count actual logs
      const { count, error: countError } = await admin
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .eq('qr_code_id', qr.id);
      
      if (countError) {
        if (countError.code === '42P01') break; // Table doesn't exist
        continue;
      }

      // 3. Update scan_count to match logs
      await admin
        .from('qr_codes')
        .update({ scan_count: count || 0 })
        .eq('id', qr.id);
      
      results.push({ id: qr.id, new_count: count });
    }

    res.json({ success: true, synced: results.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Public QR Code Details (for view page)
apiRouter.get('/public/qr-codes/:id', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });
  const { id } = req.params;
  try {
    const { data, error } = await admin
      .from('qr_codes')
      .select('id, title, description, type, file_url, file_type, target_url, bio_data, config')
      .eq('id', id)
      .single();
    if (error) throw error;

    if (data.config && data.config.password) {
      const cookieName = `qr_unlocked_${id}`;
      if (!req.cookies || req.cookies[cookieName] !== 'true') {
        return res.status(401).json({ error: 'Password required', require_password: true });
      }
    }

    // Strip config before sending
    const { config, ...safeData } = data;
    res.json(safeData);
  } catch (error: any) {
    res.status(404).json({ error: 'QR code not found' });
  }
});

// Simple in-memory cache for Geo IP lookups to avoid hitting rate limits
const geoCache = new Map<string, { country: string, city: string, timestamp: number }>();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Helper to clean IP address
function cleanIP(ip: any): string {
  if (!ip || typeof ip !== 'string') return '0.0.0.0';
  let cleaned = ip.split(',')[0].trim();
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7);
  }
  return cleaned;
}

// Track scan for Mini-Web (Bio) pages
apiRouter.post('/scan/:id', scanLimiter, async (req, res) => {
  const { id } = req.params;
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Server configuration error' });
  
  try {
    // Try to use RPC for atomic increment, fallback to standard update
    const { error: rpcError } = await admin.rpc('increment_scan_count', { qr_id: id });
    if (rpcError) {
      const { data: qr, error: fetchError } = await admin.from('qr_codes').select('scan_count').eq('id', id).single();
      if (fetchError || !qr) return res.status(404).json({ error: 'QR code not found' });
      await admin.from('qr_codes').update({ scan_count: (qr.scan_count || 0) + 1 }).eq('id', id);
    }

    const rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
    const ip = cleanIP(rawIp);
    const userAgent = req.headers['user-agent'];
    
    const scanLogData: any = { 
      qr_code_id: id,
      ip_address: ip,
      user_agent: userAgent
    };

    if (userAgent) {
      const parser = new UAParser(userAgent as string);
      const result = parser.getResult();
      scanLogData.device_type = result.device.type || 'desktop';
      scanLogData.os_name = result.os.name || 'Unknown';
      scanLogData.browser_name = result.browser.name || 'Unknown';
    }

    // Get Location
    if (scanLogData.ip_address && scanLogData.ip_address !== '::1' && scanLogData.ip_address !== '127.0.0.1' && !scanLogData.ip_address.startsWith('10.') && !scanLogData.ip_address.startsWith('192.168.')) {
      const cachedGeo = geoCache.get(scanLogData.ip_address);
      if (cachedGeo && Date.now() - cachedGeo.timestamp < GEO_CACHE_TTL) {
        scanLogData.country = cachedGeo.country;
        scanLogData.city = cachedGeo.city;
      } else {
        try {
          const fetchFn = (globalThis as any).fetch;
          if (typeof fetchFn === 'function') {
            // 1. Try ipapi.co
            try {
              const geoRes = await fetchFn(`https://ipapi.co/${scanLogData.ip_address}/json/`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (!geoData.error) {
                  scanLogData.country = geoData.country_name || 'Unknown';
                  scanLogData.city = geoData.city || 'Unknown';
                }
              }
            } catch (e) { /* ignore */ }
            
            // 2. Try ipinfo.io if still unknown
            if (!scanLogData.country || scanLogData.country === 'Unknown') {
              try {
                const infoRes = await fetchFn(`https://ipinfo.io/${scanLogData.ip_address}/json`);
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  scanLogData.country = infoData.country || 'Unknown';
                  scanLogData.city = infoData.city || 'Unknown';
                }
              } catch (e) { /* ignore */ }
            }

            // 3. Fallback to ip-api.com if still unknown
            if (!scanLogData.country || scanLogData.country === 'Unknown') {
              try {
                const fallbackRes = await fetchFn(`http://ip-api.com/json/${scanLogData.ip_address}`);
                if (fallbackRes.ok) {
                  const fallbackData = await fallbackRes.json();
                  if (fallbackData.status === 'success') {
                    scanLogData.country = fallbackData.country || 'Unknown';
                    scanLogData.city = fallbackData.city || 'Unknown';
                  }
                }
              } catch (e) { /* ignore */ }
            }

            if (scanLogData.country && scanLogData.country !== 'Unknown') {
              geoCache.set(scanLogData.ip_address, {
                country: scanLogData.country,
                city: scanLogData.city || 'Unknown',
                timestamp: Date.now()
              });
            }
          }
        } catch (e) {
          console.error('[Scan] Geo lookup error:', e);
        }
      }
    }

    await admin.from('scan_logs').insert(scanLogData).catch(console.error);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify QR Password
apiRouter.post('/verify-qr', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) return res.status(400).json({ error: 'ID and password are required' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Supabase Admin client not configured' });

  try {
    const { data: qr, error } = await admin.from('qr_codes').select('config').eq('id', id).single();
    if (error || !qr) return res.status(404).json({ error: 'QR code not found' });

    if (!qr.config || !qr.config.password) {
      return res.json({ success: true }); // No password required
    }

    const bcrypt = await import('bcrypt');
    const isValid = await bcrypt.compare(password, qr.config.password);

    if (isValid) {
      // Set a cookie to remember the unlock for 1 hour
      res.cookie(`qr_unlocked_${id}`, 'true', { 
        maxAge: 60 * 60 * 1000, // 1 hour
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Нууц үг буруу байна' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mount API Router
app.use('/api', apiRouter);

// QR Redirect (outside /api)
// This handles the short URLs like /r/123
app.get('/r/:id', scanLimiter, async (req, res, next) => {
  const { id } = req.params;
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).send('Server configuration error');
  try {
    const { data: qr, error: fetchError } = await admin.from('qr_codes').select('*').eq('id', id).single();
    if (fetchError || !qr) {
      console.error(`[Redirect] QR code ${id} not found:`, fetchError);
      return res.redirect('/qr-error?type=not_found');
    }
    
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
      return res.redirect('/qr-error?type=expired');
    }

    // Check for password protection
    if (qr.config && qr.config.password) {
      const cookieName = `qr_unlocked_${id}`;
      if (req.cookies && req.cookies[cookieName] === 'true') {
        // Already unlocked, proceed
      } else {
        // Redirect to secure page
        return res.redirect(`/secure/${id}`);
      }
    }

    // Increment scan count and log scan asynchronously
    const rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
    const ip = cleanIP(rawIp);
    const userAgent = req.headers['user-agent'];
    const purpose = req.headers['purpose'] || req.headers['sec-purpose'];
    
    console.log(`[Redirect] Request for QR ${id} from IP ${ip}, Purpose: ${purpose}, UA: ${userAgent}`);
    
    // Skip logging for prefetch requests
    if (purpose === 'prefetch' || purpose === 'preview') {
      console.log(`[Redirect] Skipping log for prefetch/preview request for QR ${id}`);
      const redirectPath = qr.type === 'file' ? `/view/${id}` : (qr.type === 'bio' ? `/p/${id}` : qr.target_url);
      return res.redirect(redirectPath);
    }

    // Debounce: prevent double logging from the same IP within 2 seconds
    const scanKey = `${ip}-${id}`;
    const now = Date.now();
    if (recentScans.has(scanKey)) {
      const lastScan = recentScans.get(scanKey)!;
      if (now - lastScan < DEBOUNCE_WINDOW) {
        console.log(`[Redirect] Skipping duplicate scan for QR ${id} from IP ${ip} (within ${DEBOUNCE_WINDOW}ms)`);
        const redirectPath = qr.type === 'file' ? `/view/${id}` : (qr.type === 'bio' ? `/p/${id}` : qr.target_url);
        return res.redirect(redirectPath);
      }
    }
    recentScans.set(scanKey, now);

    const scanLogData: any = { 
      qr_code_id: id,
      ip_address: ip,
      user_agent: userAgent
    };

    // Parse User Agent
    if (userAgent) {
      const parser = new UAParser(userAgent as string);
      const result = parser.getResult();
      
      scanLogData.device_type = result.device.type || 'desktop';
      scanLogData.os_name = result.os.name || 'Unknown';
      scanLogData.browser_name = result.browser.name || 'Unknown';
    }

    // Get Location (Simple IP-based lookup)
    const fetchLocation = async () => {
      try {
        const ipToLookup = scanLogData.ip_address;
        if (ipToLookup && ipToLookup !== '::1' && ipToLookup !== '127.0.0.1' && !ipToLookup.startsWith('10.') && !ipToLookup.startsWith('192.168.')) {
          const cachedGeo = geoCache.get(ipToLookup);
          if (cachedGeo && Date.now() - cachedGeo.timestamp < GEO_CACHE_TTL) {
            scanLogData.country = cachedGeo.country;
            scanLogData.city = cachedGeo.city;
            return;
          }

          // Use globalThis.fetch if available (Node 18+) or fallback
          const fetchFn = (globalThis as any).fetch;
          if (typeof fetchFn === 'function') {
            // 1. Try ipapi.co (HTTPS)
            try {
              const geoRes = await fetchFn(`https://ipapi.co/${ipToLookup}/json/`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (!geoData.error) {
                  scanLogData.country = geoData.country_name || 'Unknown';
                  scanLogData.city = geoData.city || 'Unknown';
                  console.log(`[Redirect] ipapi.co success for ${ipToLookup}: ${scanLogData.country}`);
                  geoCache.set(ipToLookup, { country: scanLogData.country, city: scanLogData.city, timestamp: Date.now() });
                  return;
                }
              }
            } catch (e) {
              console.warn('[Redirect] ipapi.co failed');
            }

            // 2. Try ipinfo.io (HTTPS) - Free tier works without token for limited requests
            try {
              const geoRes = await fetchFn(`https://ipinfo.io/${ipToLookup}/json`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                scanLogData.country = geoData.country || 'Unknown'; // Note: ipinfo returns country code (e.g. MN)
                scanLogData.city = geoData.city || 'Unknown';
                console.log(`[Redirect] ipinfo.io success for ${ipToLookup}: ${scanLogData.country}`);
                geoCache.set(ipToLookup, { country: scanLogData.country, city: scanLogData.city, timestamp: Date.now() });
                return;
              }
            } catch (e) {
              console.warn('[Redirect] ipinfo.io failed');
            }

            // 3. Fallback to ip-api.com
            try {
              const geoRes = await fetchFn(`http://ip-api.com/json/${ipToLookup}`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.status === 'success') {
                  scanLogData.country = geoData.country || 'Unknown';
                  scanLogData.city = geoData.city || 'Unknown';
                  console.log(`[Redirect] ip-api.com success for ${ipToLookup}: ${scanLogData.country}`);
                  geoCache.set(ipToLookup, { country: scanLogData.country, city: scanLogData.city, timestamp: Date.now() });
                  return;
                }
              }
            } catch (e) {
              console.error('[Redirect] ip-api.com error:', e);
            }
          }
        }
      } catch (e) {
        console.error('[Redirect] Geo lookup error:', e);
      }
    };

    // Use a more reliable way to update count by fetching the latest value
    // Note: Still not perfectly atomic without RPC, but better than using the stale 'qr' object
    const updateScanCount = async () => {
      try {
        const { error: rpcError } = await admin.rpc('increment_scan_count', { qr_id: id });
        if (rpcError) {
          // Fetch current count directly from DB to minimize race condition window
          const { data: latestQR } = await admin.from('qr_codes').select('scan_count').eq('id', id).single();
          const currentCount = latestQR?.scan_count || 0;
          
          await admin.from('qr_codes')
            .update({ scan_count: currentCount + 1 })
            .eq('id', id);
        }
      } catch (err) {
        console.error(`[Redirect] Failed to increment scan count for ${id}:`, err);
      }
    };

    const logScan = async () => {
      try {
        await fetchLocation();
        const { error } = await admin.from('scan_logs').insert(scanLogData);
        if (error) {
          if (error.code === '42P01' || error.message.includes('relation "scan_logs" does not exist')) {
            console.log(`[Redirect] scan_logs table not found, skipping detailed log for ${id}`);
          } else {
            console.error(`[Redirect] Failed to log scan for ${id}:`, error);
          }
        } else {
          console.log(`[Redirect] Successfully logged scan for QR ${id}`);
        }
      } catch (err) {
        console.error(`[Redirect] Exception logging scan for ${id}:`, err);
      }
    };

    // Run updates in background
    // Use a simple flag on the request object to prevent double-execution if middleware or other factors cause it
    if (!(req as any)._scanLogged) {
      (req as any)._scanLogged = true;
      updateScanCount();
      logScan();
    }

    if (qr.type === 'file') {
      return res.redirect(`/view/${id}`);
    }

    if (qr.type === 'bio') {
      return res.redirect(`/p/${id}`);
    }

    if (qr.type === 'app' && qr.bio_data) {
      const isIOS = /iPad|iPhone|iPod/.test(userAgent || '');
      const isAndroid = /android/i.test(userAgent || '');
      const appData = qr.bio_data as any;
      
      if (isIOS && appData.iosUrl) {
        return res.redirect(appData.iosUrl);
      } else if (isAndroid && appData.androidUrl) {
        return res.redirect(appData.androidUrl);
      } else if (appData.fallbackUrl) {
        return res.redirect(appData.fallbackUrl);
      } else {
        return res.status(404).send('App URL not found for your device.');
      }
    }

    if (qr.type === 'vcard') {
      if (qr.bio_data) {
        const vcardData = qr.bio_data as any;
        const vcardString = `BEGIN:VCARD\nVERSION:3.0\nN:${vcardData.lastName || ''};${vcardData.firstName || ''};;;\nFN:${vcardData.firstName || ''} ${vcardData.lastName || ''}\nORG:${vcardData.organization || ''}${vcardData.department ? ';' + vcardData.department : ''}\nTITLE:${vcardData.title || ''}\nTEL;TYPE=WORK,VOICE:${vcardData.phone || ''}\nTEL;TYPE=CELL,VOICE:${vcardData.personalPhone || ''}\nEMAIL;TYPE=PREF,INTERNET:${vcardData.email || ''}\nURL:${vcardData.website || ''}\nADR;TYPE=WORK:;;${vcardData.address || ''};;;;\nEND:VCARD`;
        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="contact.vcf"`);
        return res.send(vcardString);
      } else {
        return res.status(404).send('vCard data not found.');
      }
    }

    if (qr.type === 'event') {
      if (qr.bio_data) {
        const eventData = qr.bio_data as any;
        const formatDT = (dt: string) => dt ? dt.replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z' : '';
        const start = formatDT(eventData.startDate ? new Date(eventData.startDate).toISOString() : '');
        const end = formatDT(eventData.endDate ? new Date(eventData.endDate).toISOString() : '');
        const eventString = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${eventData.title || ''}\nDESCRIPTION:${eventData.description || ''}\nLOCATION:${eventData.location || ''}\nDTSTART:${start}\nDTEND:${end}\nEND:VEVENT\nEND:VCALENDAR`;
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="event.ics"`);
        return res.send(eventString);
      } else {
        return res.status(404).send('Event data not found.');
      }
    }

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
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  setupServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is strictly listening on 0.0.0.0:${PORT}`);
      console.log(`🔗 App URL: ${process.env.APP_URL || 'Not set'}`);
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
