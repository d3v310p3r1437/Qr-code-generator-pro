
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
import { UserProfile } from './types';
import { AuthView } from './components/AuthView';
import { RedirectHandler } from './components/RedirectHandler';

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const UserDashboard = React.lazy(() => import('./components/UserDashboard').then(module => ({ default: module.UserDashboard })));
const QRGenerator = React.lazy(() => import('./components/QRGenerator').then(module => ({ default: module.QRGenerator })));
const ProfileSettings = React.lazy(() => import('./components/ProfileSettings').then(module => ({ default: module.ProfileSettings })));
const FileViewer = React.lazy(() => import('./components/FileViewer').then(module => ({ default: module.FileViewer })));
const BioPage = React.lazy(() => import('./components/BioPage').then(module => ({ default: module.BioPage })));
const SecureQR = React.lazy(() => import('./components/SecureQR').then(module => ({ default: module.SecureQR })));
import { 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  User as UserIcon,
  Shield,
  Loader2,
  QrCode,
  AlertTriangle,
  X,
  PlusCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const profileRef = React.useRef<UserProfile | null>(null);
  const fetchingRef = React.useRef(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'generator' | 'settings'>('dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 30000));
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        if (!mounted) return;
        
        if (result.error) {
          console.error('[Auth] Session error:', result.error.message);
          if (result.error.message?.toLowerCase().includes('refresh token')) {
            await supabase.auth.signOut().catch(console.error);
          }
        }
        
        const session = result.data?.session;
        setSession(session);
        if (session) {
          await fetchProfile(session.user.id, session.access_token);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          if (err.message?.includes('Settings')) setConfigError(err.message);
          if (err.message?.toLowerCase().includes('refresh token')) {
            await supabase.auth.signOut().catch(console.error);
          }
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (!mounted) return;
      
      setSession(session);
      if (session) {
        // Only set loading to true if we don't have a profile yet
        if (!profileRef.current) {
          setLoading(true);
          await fetchProfile(session.user.id, session.access_token);
        } else if (event === 'SIGNED_IN') {
          // Refresh profile on explicit sign in
          await fetchProfile(session.user.id, session.access_token);
        }
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, token: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    try {
      setProfileError(null);
      const url = `/api/profile/${userId}`;
      console.log(`[App] Fetching profile from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errorMsg = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
          if (errorData.code) errorMsg += ` (${errorData.code})`;
        } catch (e) {
          // JSON parsing failed, likely returned HTML (e.g. 404 page)
          console.error('Failed to parse error JSON:', e);
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setProfile(data);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[App] Profile fetch timed out after 30s');
        setProfileError('Холболт салсан байна (Timeout)');
      } else {
        console.error('[App] Error fetching profile:', error);
        setProfileError(`Fetch error: ${error.message}`);
      }
      setProfile(null);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(console.error);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl mb-6">
          <Settings size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Тохиргоо дутуу байна</h1>
        <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
          {configError}
        </p>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-left w-full max-w-md">
          <h3 className="font-bold text-slate-800 mb-2">Хэрхэн тохируулах вэ?</h3>
          <ol className="list-decimal list-inside text-sm text-slate-500 space-y-2">
            <li>Зүүн доод буланд байх <b>Settings</b> цэс рүү орно.</li>
            <li><b>Environment Variables</b> хэсэгт очно.</li>
            <li><code>VITE_SUPABASE_URL</code> болон <code>VITE_SUPABASE_ANON_KEY</code> утгуудыг нэмнэ.</li>
            <li>Хадгалаад хуудсаа дахин ачаална.</li>
          </ol>
        </div>
      </div>
    );
  }

  if (location.pathname === '/qr-error') {
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get('type');
    let message = 'Алдаа гарлаа.';
    if (type === 'not_found') message = 'QR код олдсонгүй.';
    if (type === 'expired') message = 'Энэхүү QR кодын хүчинтэй хугацаа дууссан байна.';
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[32px] shadow-xl p-8 border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-red-50 text-red-600 rounded-full mb-6">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Уучлаарай</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">{message}</p>
          <button
            onClick={() => {
              window.close();
              // Fallback for browsers that block window.close()
              window.location.href = 'about:blank';
            }}
            className="inline-flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 hover:underline"
          >
            <X size={18} /> Гарах
          </button>
        </div>
      </div>
    );
  }

  // Redirect Handler is now handled by the server for better reliability and scan tracking
  /*
  if (location.pathname.startsWith('/r/')) {
    return (
      <Routes>
        <Route path="/r/:id" element={<RedirectHandler />} />
      </Routes>
    );
  }
  */

  if (location.pathname.startsWith('/view/')) {
    return (
      <Routes>
        <Route path="/view/:id" element={
          <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <FileViewer />
          </React.Suspense>
        } />
      </Routes>
    );
  }

  if (location.pathname.startsWith('/p/')) {
    return (
      <Routes>
        <Route path="/p/:id" element={
          <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <BioPage />
          </React.Suspense>
        } />
      </Routes>
    );
  }

  if (location.pathname.startsWith('/secure/')) {
    return (
      <Routes>
        <Route path="/secure/:id" element={
          <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <SecureQR />
          </React.Suspense>
        } />
      </Routes>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <Shield className="text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Хандах эрхгүй</h1>
        <p className="text-slate-500 mb-2">Таны профайл мэдээлэл олдсонгүй.</p>
        {profileError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-mono mb-6 max-w-md">
            Error: {profileError}
          </div>
        )}
        <p className="text-slate-400 text-sm mb-6">Админтай холбогдож бүртгэлээ шалгуулна уу.</p>
        <button onClick={handleLogout} className="text-blue-600 font-bold hover:underline">Гарах</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <QrCode size={24} />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tight hidden sm:block">QR Manager Pro</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 mr-4">
                <button 
                  onClick={() => setView('dashboard')}
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 px-3 ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                  title="Хянах самбар"
                >
                  <LayoutDashboard size={20} />
                  <span className="text-xs font-bold hidden md:block">Хянах самбар</span>
                </button>
                <button 
                  onClick={() => setView('generator')}
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 px-3 ${view === 'generator' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                  title="Шинэ QR"
                >
                  <PlusCircle size={20} />
                  <span className="text-xs font-bold hidden md:block">Шинэ QR</span>
                </button>
                <button 
                  onClick={() => setView('settings')}
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 px-3 ${view === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                  title="Тохиргоо"
                >
                  <Settings size={20} />
                  <span className="text-xs font-bold hidden md:block">Тохиргоо</span>
                </button>
              </div>

              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900">{profile.email}</span>
                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${profile.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                  {profile.role}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Гарах"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <React.Suspense fallback={
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        }>
          {view === 'dashboard' && (
            profile.role === 'admin' ? (
              <AdminDashboard profile={profile} />
            ) : (
              <UserDashboard 
                profile={profile} 
                onNewQR={() => setView('generator')} 
              />
            )
          )}
          {view === 'generator' && (
            <QRGenerator 
              user={profile} 
              onBack={() => setView('dashboard')} 
              onSaved={() => setView('dashboard')}
            />
          )}
          {view === 'settings' && (
            <ProfileSettings profile={profile} />
          )}
        </React.Suspense>
      </main>

      <footer className="py-8 text-center text-slate-400 text-[10px] tracking-widest uppercase">
        Designed for Excellence • Powered by Supabase • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
