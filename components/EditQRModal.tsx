
import React, { useState, useEffect } from 'react';
import { X, Save, Link, FileText, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { QRCodeData } from '../types';
import { supabase } from '../services/supabaseClient';

interface EditQRModalProps {
  qr: QRCodeData;
  onClose: () => void;
  onSaved: () => void;
}

export const EditQRModal: React.FC<EditQRModalProps> = ({ qr, onClose, onSaved }) => {
  const [title, setTitle] = useState(qr.title);
  const [description, setDescription] = useState(qr.description);
  const [targetUrl, setTargetUrl] = useState(qr.target_url);
  const [expiresAt, setExpiresAt] = useState(qr.expires_at ? qr.expires_at.split('T')[0] : '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let updatedFileUrl = qr.file_url;
      let updatedFileType = qr.file_type;
      let finalTargetUrl = targetUrl;

      // Handle file upload if changed
      if (qr.type === 'file' && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('qrcodes')
          .upload(`files/${fileName}`, file, {
            contentType: file.type,
            upsert: true
          });

        if (uploadError) throw new Error('Файл хуулахад алдаа гарлаа: ' + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('qrcodes')
          .getPublicUrl(`files/${fileName}`);
          
        updatedFileUrl = publicUrl;
        updatedFileType = file.type;
        finalTargetUrl = publicUrl;
      }

      const response = await fetch(`/api/qr-codes/${qr.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          title,
          description,
          target_url: finalTargetUrl,
          file_url: updatedFileUrl,
          file_type: updatedFileType,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Засварлаж чадсангүй');
      }

      clearTimeout(timeoutId);
      onSaved();
      onClose();
    } catch (err: any) {
      clearTimeout(timeoutId);
      setError(err.name === 'AbortError' ? 'Холболт салсан байна (Timeout)' : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">QR Засварлах</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Гарчиг</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Тайлбар</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
            />
          </div>

          {qr.type === 'url' ? (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">URL Холбоос</label>
              <div className="relative">
                <Link className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input 
                  type="url" 
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Шинэ файл (Сонгохгүй бол хуучин хэвээр үлдэнэ)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input 
                  type="file" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Хүчинтэй хугацаа (Сонгохгүй бол хязгааргүй)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="date" 
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Цуцлах
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Хадгалах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
