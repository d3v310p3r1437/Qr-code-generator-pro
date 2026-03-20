
import React, { useState, useRef } from 'react';
import { X, Save, Link, FileText, Loader2, AlertCircle, Calendar, Upload, Plus, Trash2 } from 'lucide-react';
import { QRCodeData, BioData, BioLink } from '../types';
import { supabase } from '../services/supabaseClient';

interface EditQRModalProps {
  qr: QRCodeData;
  onClose: () => void;
  onSaved: (updatedQR?: QRCodeData) => void;
}

export const EditQRModal: React.FC<EditQRModalProps> = ({ qr, onClose, onSaved }) => {
  const [title, setTitle] = useState(qr.title);
  const [description, setDescription] = useState(qr.description);
  const [targetUrl, setTargetUrl] = useState(qr.type === 'url' ? qr.target_url : '');
  const [text, setText] = useState(qr.type === 'text' ? qr.target_url : '');
  
  const [wifi, setWifi] = useState(() => {
    if (qr.type === 'wifi') {
      const matchSsid = qr.target_url.match(/S:([^;]+);/);
      const matchPass = qr.target_url.match(/P:([^;]+);/);
      const matchEnc = qr.target_url.match(/T:([^;]+);/);
      return {
        ssid: matchSsid ? matchSsid[1] : '',
        password: matchPass ? matchPass[1] : '',
        encryption: matchEnc ? matchEnc[1] : 'WPA'
      };
    }
    return { ssid: '', password: '', encryption: 'WPA' };
  });

  const [bioData, setBioData] = useState<BioData>(qr.bio_data || {
    name: '',
    position: '',
    company: '',
    bio: '',
    links: [],
    theme_color: '#3b82f6',
    text_color: '#0f172a',
    background_color: '#f8fafc',
    button_color: '#ffffff',
    button_text_color: '#0f172a'
  });
  const [vcardData, setVcardData] = useState(qr.type === 'vcard' && qr.bio_data ? qr.bio_data : {
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: '',
    address: ''
  });
  const [appData, setAppData] = useState(qr.type === 'app' && qr.bio_data ? qr.bio_data : {
    iosUrl: '',
    androidUrl: '',
    fallbackUrl: ''
  });
  const [eventData, setEventData] = useState(qr.type === 'event' && qr.bio_data ? qr.bio_data : {
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: ''
  });
  const [bioImage, setBioImage] = useState<File | null>(null);
  const [bioImagePreview, setBioImagePreview] = useState<string | null>(qr.bio_data?.profile_image_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expiresAt, setExpiresAt] = useState(qr.expires_at ? qr.expires_at.split('T')[0] : '');
  const [usePassword, setUsePassword] = useState(!!qr.has_password);
  const [qrPassword, setQrPassword] = useState('');
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
      let finalTargetUrl = qr.target_url;
      let bioProfileUrl = qr.bio_data?.profile_image_url;

      if (qr.type === 'url') {
        finalTargetUrl = targetUrl;
      } else if (qr.type === 'text') {
        finalTargetUrl = text;
      } else if (qr.type === 'wifi') {
        finalTargetUrl = `WIFI:T:${wifi.encryption};S:${wifi.ssid};P:${wifi.password};;`;
      } else if (qr.type === 'bio' && bioImage) {
        const fileExt = bioImage.name.split('.').pop();
        const fileName = `bio_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('qrcodes')
          .upload(`bios/${fileName}`, bioImage, {
            contentType: bioImage.type,
            upsert: true
          });
        if (uploadError) throw new Error('Профайл зураг хуулахад алдаа гарлаа');
        const { data: { publicUrl } } = supabase.storage.from('qrcodes').getPublicUrl(`bios/${fileName}`);
        bioProfileUrl = publicUrl;
      } else if (qr.type === 'file' && file) {
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

      const updatePayload: any = {
        title,
        description,
        target_url: finalTargetUrl,
        file_url: updatedFileUrl,
        file_type: updatedFileType,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        bio_data: qr.type === 'bio' ? { ...bioData, profile_image_url: bioProfileUrl } : 
                  qr.type === 'vcard' ? vcardData :
                  qr.type === 'app' ? appData :
                  qr.type === 'event' ? eventData : null
      };

      if (usePassword && qrPassword) {
        updatePayload.config = { ...qr.config, password: qrPassword };
      } else if (!usePassword && qr.has_password) {
        const { password, ...safeConfig } = qr.config as any;
        updatePayload.config = { ...safeConfig, password: null };
      }

      const response = await fetch(`/api/qr-codes/${qr.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Засварлаж чадсангүй');
      }

      const updatedQR = await response.json();

      clearTimeout(timeoutId);
      onSaved(updatedQR);
      onClose();
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Update error:', err);
      if (err.message?.toLowerCase().includes('refresh token')) {
        setError('Таны нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.');
        await supabase.auth.signOut().catch(console.error);
      } else {
        setError(err.name === 'AbortError' ? 'Холболт салсан байна (Timeout)' : err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-8">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">QR Засварлах</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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

          {qr.type === 'url' && (
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
          )}

          {qr.type === 'text' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Текст</label>
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none"
              />
            </div>
          )}

          {qr.type === 'wifi' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Сүлжээний нэр (SSID)</label>
                <input
                  type="text"
                  value={wifi.ssid}
                  onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Нууцлал</label>
                  <select
                    value={wifi.encryption}
                    onChange={(e) => setWifi({ ...wifi, encryption: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Нууц үггүй</option>
                  </select>
                </div>
                {wifi.encryption !== 'nopass' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Нууц үг</label>
                    <input
                      type="text"
                      value={wifi.password}
                      onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {qr.type === 'file' && (
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

          {qr.type === 'bio' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div 
                  className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden bg-slate-50 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {bioImagePreview ? (
                    <img src={bioImagePreview} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <>
                      <Upload size={20} className="text-slate-300 mb-1" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Зураг</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBioImage(file);
                        setBioImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Нэр</label>
                    <input
                      type="text"
                      value={bioData.name}
                      onChange={(e) => setBioData({ ...bioData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="Таны нэр"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Албан тушаал</label>
                      <input
                        type="text"
                        value={bioData.position}
                        onChange={(e) => setBioData({ ...bioData, position: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        placeholder="Жишээ: Захирал"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Байгууллага</label>
                      <input
                        type="text"
                        value={bioData.company}
                        onChange={(e) => setBioData({ ...bioData, company: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        placeholder="Жишээ: Юнител"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Намтар</label>
                    <textarea
                      value={bioData.bio}
                      onChange={(e) => setBioData({ ...bioData, bio: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                      placeholder="Өөрийнхөө тухай товчхон..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Сошиал холбоосууд</label>
                  <button 
                    onClick={() => {
                      const newLink: BioLink = { id: Math.random().toString(36).substring(7), label: '', url: '', icon: 'globe' };
                      setBioData({ ...bioData, links: [...bioData.links, newLink] });
                    }}
                    className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Нэмэх
                  </button>
                </div>
                <div className="space-y-3">
                  {bioData.links.map((link, idx) => (
                    <div key={link.id} className="flex gap-2 items-start bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <select 
                        value={link.icon}
                        onChange={(e) => {
                          const newLinks = [...bioData.links];
                          newLinks[idx].icon = e.target.value;
                          setBioData({ ...bioData, links: newLinks });
                        }}
                        className="p-2 rounded-lg border border-slate-200 text-xs bg-white outline-none"
                      >
                        <option value="globe">Вэб</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="twitter">Twitter</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="github">GitHub</option>
                        <option value="youtube">YouTube</option>
                        <option value="phone">Утас</option>
                        <option value="mail">Имэйл</option>
                      </select>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Товчлуурын нэр"
                          value={link.label}
                          onChange={(e) => {
                            const newLinks = [...bioData.links];
                            newLinks[idx].label = e.target.value;
                            setBioData({ ...bioData, links: newLinks });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none"
                        />
                        <input
                          type="text"
                          placeholder="URL эсвэл Утас/Имэйл"
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...bioData.links];
                            newLinks[idx].url = e.target.value;
                            setBioData({ ...bioData, links: newLinks });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const newLinks = bioData.links.filter((_, i) => i !== idx);
                          setBioData({ ...bioData, links: newLinks });
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Арын өнгө</label>
                  <input type="color" value={bioData.background_color} onChange={(e) => setBioData({...bioData, background_color: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Текст өнгө</label>
                  <input type="color" value={bioData.text_color} onChange={(e) => setBioData({...bioData, text_color: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Товч өнгө</label>
                  <input type="color" value={bioData.button_color} onChange={(e) => setBioData({...bioData, button_color: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Товч текст</label>
                  <input type="color" value={bioData.button_text_color} onChange={(e) => setBioData({...bioData, button_text_color: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
              </div>
            </div>
          )}

          {qr.type === 'vcard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Овог</label>
                  <input type="text" value={vcardData.lastName} onChange={(e) => setVcardData({...vcardData, lastName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Нэр</label>
                  <input type="text" value={vcardData.firstName} onChange={(e) => setVcardData({...vcardData, firstName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Байгууллага</label>
                  <input type="text" value={vcardData.organization} onChange={(e) => setVcardData({...vcardData, organization: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Албан тушаал</label>
                  <input type="text" value={vcardData.title} onChange={(e) => setVcardData({...vcardData, title: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Утас</label>
                  <input type="tel" value={vcardData.phone} onChange={(e) => setVcardData({...vcardData, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Имэйл</label>
                  <input type="email" value={vcardData.email} onChange={(e) => setVcardData({...vcardData, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Вэб сайт</label>
                <input type="url" value={vcardData.website} onChange={(e) => setVcardData({...vcardData, website: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Хаяг</label>
                <input type="text" value={vcardData.address} onChange={(e) => setVcardData({...vcardData, address: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
          )}

          {qr.type === 'app' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">iOS App Store URL</label>
                <input type="url" value={appData.iosUrl} onChange={(e) => setAppData({...appData, iosUrl: e.target.value})} placeholder="https://apps.apple.com/..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Android Play Store URL</label>
                <input type="url" value={appData.androidUrl} onChange={(e) => setAppData({...appData, androidUrl: e.target.value})} placeholder="https://play.google.com/..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Бусад үед (Fallback URL)</label>
                <input type="url" value={appData.fallbackUrl} onChange={(e) => setAppData({...appData, fallbackUrl: e.target.value})} placeholder="https://yourwebsite.com" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
          )}

          {qr.type === 'event' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Арга хэмжээний нэр</label>
                <input type="text" value={eventData.title} onChange={(e) => setEventData({...eventData, title: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Байршил</label>
                <input type="text" value={eventData.location} onChange={(e) => setEventData({...eventData, location: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Эхлэх огноо, цаг</label>
                  <input type="datetime-local" value={eventData.startDate} onChange={(e) => setEventData({...eventData, startDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Дуусах огноо, цаг</label>
                  <input type="datetime-local" value={eventData.endDate} onChange={(e) => setEventData({...eventData, endDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Тайлбар</label>
                <textarea value={eventData.description} onChange={(e) => setEventData({...eventData, description: e.target.value})} rows={3} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" />
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

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
              <span className="text-sm font-bold text-slate-700">Нууц үгээр хамгаалах</span>
            </label>
            
            {usePassword && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Нууц үг</label>
                <input 
                  type="text" 
                  placeholder={qr.has_password ? "Шинэ нууц үг (хоосон орхивол хуучин хэвээр үлдэнэ)" : "Нууц үг оруулах"}
                  value={qrPassword}
                  onChange={(e) => setQrPassword(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
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
  );
};
