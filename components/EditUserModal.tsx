import React, { useState } from 'react';
import { UserProfile, QRDataType } from '../types';
import { X, Save, Loader2, Calendar, Hash } from 'lucide-react';

interface EditUserModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (id: string, data: Partial<UserProfile>) => Promise<void>;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
  const [qrLimit, setQrLimit] = useState(user.qr_limit);
  const [expiresAt, setExpiresAt] = useState(user.expires_at ? new Date(user.expires_at).toISOString().split('T')[0] : '');
  const [allowedQrTypes, setAllowedQrTypes] = useState<QRDataType[]>(
    user.allowed_qr_types || ['url', 'text', 'wifi', 'file', 'bio', 'vcard', 'app', 'event']
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(user.id, {
        qr_limit: qrLimit,
        expires_at: expiresAt || null,
        allowed_qr_types: allowedQrTypes
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Хэрэглэгч засах</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="editUserForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase ml-1">QR Лимит</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    required
                    disabled={user.role === 'admin'}
                    min="1"
                    value={user.role === 'admin' ? '' : qrLimit}
                    onChange={(e) => setQrLimit(parseInt(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder={user.role === 'admin' ? 'Хязгааргүй' : '10'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase ml-1">Хүчинтэй хугацаа</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Хоосон орхивол хугацаагүй байна.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase ml-1">Зөвшөөрөгдсөн QR төрлүүд</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'url', label: 'Холбоос' },
                  { id: 'text', label: 'Текст' },
                  { id: 'wifi', label: 'WiFi' },
                  { id: 'file', label: 'Файл' },
                  { id: 'bio', label: 'Bio Link' },
                  { id: 'vcard', label: 'Нэрийн хуудас' },
                  { id: 'app', label: 'Апп татах' },
                  { id: 'event', label: 'Арга хэмжээ' }
                ].map(type => (
                  <label key={type.id} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={allowedQrTypes.includes(type.id as any)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedQrTypes([...allowedQrTypes, type.id as any]);
                        } else {
                          setAllowedQrTypes(allowedQrTypes.filter(t => t !== type.id));
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-slate-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</p>}
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            form="editUserForm"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 text-sm shadow-lg shadow-blue-100"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
};
