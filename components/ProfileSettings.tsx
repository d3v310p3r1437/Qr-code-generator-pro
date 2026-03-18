
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { Shield, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileSettingsProps {
  profile: UserProfile;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ profile }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Нууц үгүүд таарахгүй байна.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Нууц үг амжилттай солигдлоо.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.message?.includes('Refresh Token')) {
        setMessage({ type: 'error', text: 'Таны нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.' });
        await supabase.auth.signOut();
      } else {
        setMessage({ type: 'error', text: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Хэрэглэгчийн тохиргоо</h1>
        <p className="text-slate-500 mt-1">Та өөрийн бүртгэлийн мэдээлэл болон нууц үгээ эндээс удирдана уу.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Бүртгэлийн мэдээлэл</h3>
          <p className="text-sm text-slate-500">Таны системд бүртгэлтэй үндсэн мэдээллүүд.</p>
        </div>
        
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
              <Shield size={32} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Имэйл хаяг</p>
              <p className="text-lg font-bold text-slate-700">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${profile.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                  {profile.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Нууц үг солих</h3>
          <p className="text-sm text-slate-500">Аюулгүй байдлын үүднээс нууц үгээ тогтмол сольж байхыг зөвлөж байна.</p>
        </div>
        
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            {message && (
              <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Шинэ нууц үг</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3.5 pl-12 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Нууц үг давтах</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3.5 pl-12 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
              Нууц үг шинэчлэх
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
