
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { QRCodeData, UserProfile } from '../types';
import { QRDetailsModal } from './QRDetailsModal';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  BarChart3, 
  Loader2, 
  QrCode,
  AlertCircle,
  Clock,
  CheckCircle2,
  Download,
  Copy,
  Edit3,
  Lock
} from 'lucide-react';
import { EditQRModal } from './EditQRModal';

interface UserDashboardProps {
  profile: UserProfile;
  onNewQR: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ profile, onNewQR }) => {
  const [qrs, setQrs] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<QRCodeData | null>(null);
  const [editingQR, setEditingQR] = useState<QRCodeData | null>(null);

  const fetchQRs = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/user/qr-codes/${profile.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Failed to fetch QR codes');
      const data = await response.json();
      setQrs(data);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', err);
      if (err.message?.toLowerCase().includes('refresh token')) {
        alert('Таны нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.');
        await supabase.auth.signOut().catch(console.error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRs();

    const channel = supabase
      .channel('user-qrs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qr_codes',
          filter: `user_id=eq.${profile.id}`
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setQrs((prev) => [payload.new as QRCodeData, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setQrs((prev) => prev.map(qr => qr.id === payload.new.id ? { ...qr, ...payload.new } : qr));
          } else if (payload.eventType === 'DELETE') {
            setQrs((prev) => prev.filter(qr => qr.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const handleDelete = async (id: string, imageUrl?: string) => {
    if (!window.confirm('Та энэ QR кодыг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Delete from DB (Server will handle storage deletion)
      const response = await fetch(`/api/qr-codes/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Устгаж чадсангүй');
      }

      setQrs(prev => prev.filter(qr => qr.id !== id));
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('refresh token')) {
        alert('Таны нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.');
        await supabase.auth.signOut().catch(console.error);
      } else {
        alert('Устгахад алдаа гарлаа: ' + err.message);
      }
    }
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title || 'qr-code'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      alert('Зургийг татаж авахад алдаа гарлаа');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Миний QR Кодууд</h1>
          <p className="text-slate-500 mt-1">Таны үүсгэсэн болон удирдаж буй QR кодуудын жагсаалт</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Лимит</p>
              <p className="text-sm font-bold text-slate-700">
                {qrs.length} / {profile.role === 'admin' ? '∞' : profile.qr_limit}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <QrCode size={20} />
            </div>
          </div>
          <button
            onClick={onNewQR}
            disabled={profile.role !== 'admin' && qrs.length >= profile.qr_limit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
          >
            <Plus size={20} /> Шинэ QR
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-[32px] p-20 flex flex-col items-center justify-center border border-slate-100">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="text-slate-400 font-medium">Ачаалж байна...</p>
        </div>
      ) : qrs.length === 0 ? (
        <div className="bg-white rounded-[32px] p-20 flex flex-col items-center justify-center border border-slate-100 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
            <QrCode size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Одоогоор QR код алга</h3>
          <p className="text-slate-500 max-w-xs mx-auto mb-8">
            Та "Шинэ QR" товчийг дарж анхны QR кодоо үүсгээрэй.
          </p>
          <button
            onClick={onNewQR}
            className="text-blue-600 font-bold hover:underline flex items-center gap-2"
          >
            <Plus size={18} /> Анхны QR-аа үүсгэх
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {qrs.map((qr) => {
            const expired = isExpired(qr.expires_at);
            return (
              <div 
                key={qr.id} 
                className="bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer"
                onClick={() => setSelectedQR(qr)}
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${expired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {expired ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                      {expired ? 'Хугацаа дууссан' : 'Идэвхтэй'}
                    </div>
                    <div className="flex items-center gap-2">
                      {profile.role === 'admin' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingQR(qr);
                          }}
                          className="text-slate-300 hover:text-blue-500 transition-colors p-1"
                          title="Засварлах"
                        >
                          <Edit3 size={18} />
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(qr.id, qr.qr_image_url);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Устгах"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mb-4">
                    {qr.qr_image_url && (
                      <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 p-1.5 flex-shrink-0 shadow-sm relative">
                        <img 
                          src={qr.qr_image_url} 
                          alt={qr.title} 
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                        {qr.has_password && (
                          <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-md" title="Нууц үгээр хамгаалагдсан">
                            <Lock size={12} />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 mb-1 truncate">{qr.title || 'Гарчиггүй'}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">{qr.description || 'Тайлбар байхгүй.'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t border-slate-50">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <BarChart3 size={16} />
                        <span>Уншуулсан:</span>
                      </div>
                      <span className="font-bold text-slate-700">{qr.scan_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={16} />
                        <span>Дуусах:</span>
                      </div>
                      <span className={`font-medium ${expired ? 'text-red-500' : 'text-slate-700'}`}>
                        {qr.expires_at ? new Date(qr.expires_at).toLocaleDateString('mn-MN') : 'Хязгааргүй'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px]" title={qr.type === 'file' ? 'Файл' : qr.type === 'vcard' ? 'Нэрийн хуудас' : qr.type === 'app' ? 'Апп татах' : qr.type === 'event' ? 'Арга хэмжээ' : qr.target_url}>
                    <QrCode size={12} /> {qr.type === 'file' ? 'Файл' : qr.type === 'vcard' ? 'Нэрийн хуудас' : qr.type === 'app' ? 'Апп татах' : qr.type === 'event' ? 'Арга хэмжээ' : qr.target_url}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button 
                      onClick={() => {
                        const redirectUrl = `${window.location.origin}/r/${qr.id}`;
                        navigator.clipboard.writeText(redirectUrl);
                        alert('Холбоос хуулагдлаа');
                      }}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title="Redirect холбоос хуулах"
                    >
                      <Copy size={18} />
                    </button>
                    {qr.qr_image_url && (
                      <button 
                        onClick={() => handleDownload(qr.qr_image_url!, qr.title)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="Татах"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <a 
                      href={qr.type === 'file' ? `/view/${qr.id}` : qr.type === 'bio' ? `/p/${qr.id}` : qr.type === 'vcard' || qr.type === 'app' || qr.type === 'event' ? `/r/${qr.id}` : qr.target_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedQR && (
        <QRDetailsModal 
          qr={selectedQR} 
          onClose={() => setSelectedQR(null)} 
        />
      )}

      {editingQR && (
        <EditQRModal 
          qr={editingQR} 
          onClose={() => setEditingQR(null)} 
          onSaved={(updatedQR) => {
            if (updatedQR) {
              setQrs(prev => prev.map(q => q.id === updatedQR.id ? { ...q, ...updatedQR } : q));
            } else {
              fetchQRs();
            }
            setEditingQR(null);
          }} 
        />
      )}
    </div>
  );
};
