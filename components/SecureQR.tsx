import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertTriangle } from 'lucide-react';

export const SecureQR: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verify-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Нууц үг буруу байна');
      }

      // If successful, redirect to the original /r/:id
      // The server will now see the cookie and allow access
      window.location.href = `/r/${id}`;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-xl p-8 border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-full mb-6">
          <Lock size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Хамгаалагдсан холбоос</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Энэхүү QR код нь нууц үгээр хамгаалагдсан байна. Цааш нэвтрэхийн тулд нууц үгээ оруулна уу.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Нууц үг"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-center text-lg tracking-widest"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Нэвтрэх'}
          </button>
        </form>
      </div>
    </div>
  );
};
