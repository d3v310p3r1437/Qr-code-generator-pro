
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  UserPlus, 
  Users, 
  Shield, 
  Trash2, 
  Loader2, 
  Mail, 
  Lock, 
  Hash, 
  QrCode, 
  Plus, 
  ExternalLink, 
  User as UserIcon,
  BarChart3,
  Calendar,
  Copy,
  Download
} from 'lucide-react';
import { UserProfile, QRCodeData } from '../types';
import { QRGenerator } from './QRGenerator';

export const AdminDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'qrs' | 'create'>('qrs');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allQrs, setAllQrs] = useState<(QRCodeData & { profiles: { email: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create User Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [qrLimit, setQrLimit] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const response = await fetch('/api/admin/profiles');
        if (!response.ok) throw new Error('Failed to fetch profiles');
        const data = await response.json();
        setUsers(data);
      } else if (activeTab === 'qrs') {
        const response = await fetch('/api/admin/qr-codes');
        if (!response.ok) throw new Error('Failed to fetch QR codes');
        const data = await response.json();
        setAllQrs(data);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, qr_limit: qrLimit }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Хэрэглэгч үүсгэж чадсангүй');

      setEmail('');
      setPassword('');
      setQrLimit(10);
      setRole('user');
      fetchData();
      alert('Хэрэглэгч амжилттай бүртгэгдлээ');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteQR = async (id: string, imageUrl?: string) => {
    if (!window.confirm('Та энэ QR кодыг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      // 1. Delete from DB
      const response = await fetch(`/api/qr-codes/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Устгаж чадсангүй');
      }

      // 2. Delete from Storage if exists
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('qrcodes').remove([fileName]);
        }
      }

      fetchData();
    } catch (err: any) {
      alert('Устгахад алдаа гарлаа: ' + err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Та энэ хэрэглэгчийг устгахдаа итгэлтэй байна уу? (Түүний бүх QR кодууд хамт устгагдана)')) return;
    try {
      const response = await fetch(`/api/admin/profiles/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Хэрэглэгчийг устгаж чадсангүй');
      }
      fetchData();
    } catch (err: any) {
      alert('Алдаа: ' + err.message);
    }
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
      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={18} /> Хэрэглэгчид
        </button>
        <button
          onClick={() => setActiveTab('qrs')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'qrs' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <QrCode size={18} /> Бүх QR Кодууд
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'create' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Plus size={18} /> Шинэ QR үүсгэх
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <UserPlus className="text-blue-600" size={24} />
              Шинэ хэрэглэгч бүртгэх
            </h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Имэйл</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Нууц үг</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Эрх</label>
                <select
                  value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none bg-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">QR Лимит</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number" required disabled={role === 'admin'} min="1"
                    value={role === 'admin' ? '' : qrLimit} onChange={(e) => setQrLimit(parseInt(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder={role === 'admin' ? 'Хязгааргүй' : '10'}
                  />
                </div>
              </div>
              <button
                type="submit" disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-lg shadow-blue-100"
              >
                {creating ? <Loader2 className="animate-spin" size={18} /> : 'Бүртгэх'}
              </button>
            </form>
            {error && <p className="mt-4 text-red-500 text-xs font-medium">{error}</p>}
          </section>

          <section className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="text-blue-600" size={24} />
                Хэрэглэгчдийн жагсаалт
              </h2>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                Нийт: {users.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Имэйл</th>
                    <th className="px-6 py-4">Эрх</th>
                    <th className="px-6 py-4">QR Лимит</th>
                    <th className="px-6 py-4 text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={32} /></td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Хэрэглэгч олдсонгүй.</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-700">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {u.role === 'admin' && <Shield size={10} />}
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-500">
                          {u.role === 'admin' ? <span className="text-purple-600 font-bold">Хязгааргүй</span> : u.qr_limit}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'qrs' && (
        <section className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="text-blue-600" size={24} />
              Бүх QR Кодууд
            </h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              Нийт: {allQrs.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Зураг</th>
                  <th className="px-6 py-4">Гарчиг / Үүсгэгч</th>
                  <th className="px-6 py-4">URL</th>
                  <th className="px-6 py-4">Статистик</th>
                  <th className="px-6 py-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={32} /></td></tr>
                ) : allQrs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">QR код олдсонгүй.</td></tr>
                ) : (
                  allQrs.map((qr) => (
                    <tr key={qr.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {qr.qr_image_url ? (
                          <img src={qr.qr_image_url} alt="" className="w-10 h-10 rounded-lg border border-slate-100 object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300"><QrCode size={16} /></div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{qr.title}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                          <UserIcon size={10} /> {qr.profiles?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-500 truncate max-w-[200px] font-mono" title={qr.target_url}>{qr.target_url}</div>
                        <button 
                          onClick={() => {
                            const redirectUrl = `${window.location.origin}/r/${qr.id}`;
                            navigator.clipboard.writeText(redirectUrl);
                            alert('Redirect холбоос хуулагдлаа');
                          }}
                          className="text-[10px] text-blue-500 font-bold hover:underline mt-1 flex items-center gap-1"
                        >
                          <Copy size={10} /> Redirect Link хуулах
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                            <BarChart3 size={14} className="text-blue-500" /> {qr.scan_count}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                            <Calendar size={14} /> {new Date(qr.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {qr.qr_image_url && (
                            <button 
                              onClick={() => handleDownload(qr.qr_image_url!, qr.title)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Татах"
                            >
                              <Download size={18} />
                            </button>
                          )}
                          <a href={qr.target_url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Нээх">
                            <ExternalLink size={18} />
                          </a>
                          <button 
                            onClick={() => handleDeleteQR(qr.id, qr.qr_image_url)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Устгах"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'create' && (
        <QRGenerator 
          user={profile} 
          onBack={() => setActiveTab('qrs')} 
          onSaved={() => setActiveTab('qrs')} 
        />
      )}
    </div>
  );
};
