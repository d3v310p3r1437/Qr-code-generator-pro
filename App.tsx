
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
import { UserProfile } from './types';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { QRGenerator } from './components/QRGenerator';
import { RedirectHandler } from './components/RedirectHandler';
import { 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  User as UserIcon,
  Shield,
  Loader2,
  QrCode
} from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'generator'>('dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      // 1. Listen for Auth changes
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else setLoading(false);
      }).catch((err: any) => {
        if (err.message.includes('Settings')) {
          setConfigError(err.message);
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else {
          setProfile(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } catch (err: any) {
      if (err.message.includes('Settings')) {
        setConfigError(err.message);
        setLoading(false);
      } else {
        console.error(err);
      }
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile/${userId}`);
      if (!response.ok) throw new Error('Profile not found');
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

  if (!session) {
    return <AuthView />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <Shield className="text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Хандах эрхгүй</h1>
        <p className="text-slate-500 mb-6">Таны профайл мэдээлэл олдсонгүй. Админтай холбогдоно уу.</p>
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
        {profile.role === 'admin' ? (
          <AdminDashboard profile={profile} />
        ) : (
          <>
            {view === 'dashboard' ? (
              <UserDashboard 
                profile={profile} 
                onNewQR={() => setView('generator')} 
              />
            ) : (
              <QRGenerator 
                user={profile} 
                onBack={() => setView('dashboard')} 
                onSaved={() => setView('dashboard')}
              />
            )}
          </>
        )}
      </main>

      <footer className="py-8 text-center text-slate-400 text-[10px] tracking-widest uppercase">
        Designed for Excellence • Powered by Supabase • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
