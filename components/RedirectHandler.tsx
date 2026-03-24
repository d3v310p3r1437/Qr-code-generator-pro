
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AlertTriangle, Loader2, Home } from 'lucide-react';

export const RedirectHandler: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!id) return;

      try {
        const { data: qr, error: fetchError } = await supabase
          .from('qr_codes')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !qr) {
          setError('QR код олдсонгүй.');
          setLoading(false);
          return;
        }

        // Check expiration
        if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
          setError('Энэхүү QR кодын хүчинтэй хугацаа дууссан байна.');
          setLoading(false);
          return;
        }

        // Increment scan count
        await supabase
          .from('qr_codes')
          .update({ scan_count: (qr.scan_count || 0) + 1 })
          .eq('id', id);

        // Redirect
        if (qr.type === 'bio' || qr.type === 'mini_web_contact') {
          navigate(`/p/${id}`);
        } else {
          let targetUrl = qr.target_url;
          if (/^javascript:/i.test(targetUrl)) {
            targetUrl = '#';
          }
          window.location.href = targetUrl;
        }
      } catch (err) {
        console.error(err);
        setError('Алдаа гарлаа. Дахин оролдоно уу.');
        setLoading(false);
      }
    };

    handleRedirect();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-600 font-medium">Шилжүүлж байна, түр хүлээнэ үү...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-xl p-8 border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-red-50 text-red-600 rounded-full mb-6">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Уучлаарай</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline"
        >
          <Home size={18} /> Нүүр хуудас руу буцах
        </button>
      </div>
    </div>
  );
};
