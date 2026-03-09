
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const AuthView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl text-white mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Нэвтрэх</h1>
          <p className="text-slate-500 mt-2">QR Code Manager Pro системд тавтай морил</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Имэйл</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="user@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Нууц үг</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Нэвтрэх'}
          </button>
        </form>
      </div>
    </div>
  );
};
