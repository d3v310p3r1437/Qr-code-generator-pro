
import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { 
  Download, 
  Settings, 
  Link as LinkIcon, 
  Trash2, 
  Sparkles,
  ChevronRight,
  Maximize,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Plus,
  Minus,
  Wifi,
  FileText,
  Copy,
  Palette,
  Info,
  Layers,
  ShieldCheck,
  Globe,
  Monitor,
  Save,
  ArrowLeft,
  Calendar,
  Loader2
} from 'lucide-react';
import { generateSlogan } from '../services/geminiService';
import { QRConfig, QRDataType, DotsStyle, CornerStyle, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

const THEMES = [
  { name: 'Classic', fg: '#000000', bg: '#ffffff' },
  { name: 'Midnight', fg: '#1e293b', bg: '#ffffff' },
  { name: 'Royal', fg: '#1d4ed8', bg: '#f0f9ff' },
  { name: 'Forest', fg: '#064e3b', bg: '#f0fdf4' },
  { name: 'Sunset', fg: '#9a3412', bg: '#fff7ed' },
];

const DOT_STYLES: { id: DotsStyle; label: string }[] = [
  { id: 'square', label: 'Дөрвөлжин' },
  { id: 'rounded', label: 'Налуу' },
  { id: 'dots', label: 'Дугуй' },
  { id: 'classy', label: 'Модерн' },
  { id: 'classy-rounded', label: 'Гоёмсог' },
  { id: 'extra-rounded', label: 'Дугуйвтар' },
];

const CORNER_STYLES: { id: CornerStyle; label: string }[] = [
  { id: 'square', label: 'Дөрвөлжин' },
  { id: 'extra-rounded', label: 'Налуу' },
  { id: 'dot', label: 'Дугуй' },
];

const ERROR_LEVELS = [
  { id: 'L', label: 'L', title: 'Low', percent: '7%', desc: 'Энгийн код, хурдан уншигдана.' },
  { id: 'M', label: 'M', title: 'Medium', percent: '15%', desc: 'Стандарт, тэнцвэртэй сонголт.' },
  { id: 'Q', label: 'Q', title: 'Quartile', percent: '25%', desc: 'Бохирдолд тэсвэртэй.' },
  { id: 'H', label: 'H', title: 'High', percent: '30%', desc: 'Лого оруулахад хамгийн сайн.' },
];

interface QRGeneratorProps {
  user: UserProfile;
  onBack: () => void;
  onSaved: () => void;
}

export const QRGenerator: React.FC<QRGeneratorProps> = ({ user, onBack, onSaved }) => {
  const [activeTab, setActiveTab] = useState<QRDataType>('url');
  const [url, setUrl] = useState<string>('https://google.com');
  const [text, setText] = useState<string>('');
  const [wifi, setWifi] = useState({ ssid: '', password: '', encryption: 'WPA' });
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [slogan, setSlogan] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<QRConfig>({
    value: 'https://google.com',
    size: 400,
    fgColor: '#000000',
    bgColor: '#ffffff',
    level: 'H',
    includeMargin: true,
    logoSrc: undefined,
    logoSize: 80,
    excavate: true,
    dotsStyle: 'square',
    cornersStyle: 'square',
  });

  const qrRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedUrlValue = useMemo(() => {
    let input = url.trim();
    if (!input) return '';
    if (/^(htts|ttp|hppt|htps|hhtps|http|https):/i.test(input)) {
      input = input.replace(/^(htts|ttp|hppt|htps|hhtps|http|https):\/+/i, 'https://');
    } else if (!/^https?:\/\//i.test(input)) {
      input = 'https://' + input;
    }
    return input;
  }, [url]);

  const isLikelyUrl = useMemo(() => {
    if (activeTab !== 'url') return false;
    const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    return pattern.test(url.trim());
  }, [url, activeTab]);

  useEffect(() => {
    qrCodeInstance.current = new QRCodeStyling({
      width: config.size,
      height: config.size,
      data: config.value,
      margin: 10,
      qrOptions: { errorCorrectionLevel: config.level as any },
      dotsOptions: { color: config.fgColor, type: config.dotsStyle },
      backgroundOptions: { color: config.bgColor },
      cornersSquareOptions: { type: config.cornersStyle, color: config.fgColor },
      cornersDotOptions: { type: config.cornersStyle === 'dot' ? 'dot' : 'square', color: config.fgColor },
      imageOptions: { crossOrigin: "anonymous", margin: 5 }
    });

    if (qrRef.current) {
      qrCodeInstance.current.append(qrRef.current);
    }
  }, []);

  useEffect(() => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.update({
        width: config.size,
        height: config.size,
        data: config.value,
        image: config.logoSrc,
        qrOptions: { errorCorrectionLevel: config.level as any },
        dotsOptions: { color: config.fgColor, type: config.dotsStyle },
        backgroundOptions: { color: config.bgColor },
        cornersSquareOptions: { type: config.cornersStyle, color: config.fgColor },
        cornersDotOptions: { type: config.cornersStyle === 'dot' ? 'dot' : 'square', color: config.fgColor },
        imageOptions: {
          hideBackgroundDots: config.excavate,
          imageSize: (config.logoSize || 80) / config.size,
          margin: 5
        }
      });
    }
  }, [config]);

  const getQRValue = () => {
    if (activeTab === 'url') return normalizedUrlValue;
    if (activeTab === 'text') return text;
    if (activeTab === 'wifi') return `WIFI:S:${wifi.ssid};T:${wifi.encryption};P:${wifi.password};;`;
    return '';
  };

  const handleUpdatePreview = () => {
    const value = getQRValue();
    if (!value) return;
    if (activeTab === 'url') setUrl(normalizedUrlValue);
    setConfig(prev => ({ ...prev, value }));
  };

  const handleSave = async () => {
    const targetUrl = getQRValue();
    if (!targetUrl) {
      alert('Мэдээллээ оруулна уу');
      return;
    }
    if (!title) {
      alert('Гарчиг оруулна уу');
      return;
    }

    setSaving(true);
    try {
      // 1. Insert into DB first to get the ID
      const response = await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title,
          description,
          target_url: targetUrl,
          config: config,
          expires_at: expiresAt || null,
          type: activeTab
        })
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errData = await response.json();
          throw new Error(errData.error || 'QR код хадгалж чадсангүй');
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
          throw new Error(`Серверийн алдаа (${response.status}). Хариулт JSON биш байна.`);
        }
      }
      
      const qrData = await response.json();

      // 2. Generate the QR code image blob
      // Only use redirect URL for 'url' type to maintain native functionality for Wi-Fi and Text
      const qrValue = activeTab === 'url' ? `${window.location.origin}/r/${qrData.id}` : targetUrl;
      
      // Update the QR instance with the correct value before generating the blob
      if (qrCodeInstance.current) {
        qrCodeInstance.current.update({
          data: qrValue
        });
      }

      const blob = await qrCodeInstance.current?.getRawData('png');
      if (!blob) throw new Error('QR код үүсгэж чадсангүй');

      // 3. Upload image to Storage
      const fileName = `${qrData.id}.png`;
      const { error: uploadError } = await supabase.storage
        .from('qrcodes')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      } else {
        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('qrcodes')
          .getPublicUrl(fileName);

        // 5. Update DB with image URL
        await fetch(`/api/qr-codes/${qrData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qr_image_url: publicUrl })
        });
      }
      
      alert('QR код амжилттай хадгалагдлаа');
      onSaved();
    } catch (err: any) {
      alert('Алдаа: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAISlogan = async () => {
    setLoadingAI(true);
    const value = getQRValue();
    const result = await generateSlogan(value);
    setSlogan(result);
    setLoadingAI(false);
  };

  const downloadPNG = () => qrCodeInstance.current?.download({ name: `qr-code-${activeTab}`, extension: 'png' });
  const downloadSVG = () => qrCodeInstance.current?.download({ name: `qr-code-${activeTab}`, extension: 'svg' });

  const copyToClipboard = async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            alert("QR код түр санах ой руу хуулагдлаа!");
          } catch (err) { console.error(err); }
        }
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (upload) => setConfig(prev => ({ ...prev, logoSrc: upload.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const logoPercentage = Math.round(((config.logoSize || 0) / config.size) * 100);
  const isTooLarge = logoPercentage > 25;

  return (
    <div className="max-w-6xl mx-auto">
      <style>{`
        .qr-preview-box canvas, .qr-preview-box svg {
          max-width: 100% !important;
          height: auto !important;
          display: block;
        }
      `}</style>

      <div className="mb-8 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors">
          <ArrowLeft size={20} /> Буцах
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Шинэ QR Код Үүсгэх</h1>
        <div className="w-20" /> {/* Spacer */}
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {/* Info Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-blue-500" />
              Үндсэн мэдээлэл
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Гарчиг</label>
                <input
                  type="text"
                  placeholder="Жишээ: Манай вэб сайт"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Дуусах хугацаа</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Тайлбар</label>
              <textarea
                placeholder="QR кодын талаарх нэмэлт тайлбар..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
              />
            </div>
          </section>

          {/* Tabs */}
          <section className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
            {[
              { id: 'url', icon: LinkIcon, label: 'Вэб сайт' },
              { id: 'text', icon: FileText, label: 'Текст' },
              { id: 'wifi', icon: Wifi, label: 'Wi-Fi' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as QRDataType)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </section>

          {/* Input Area */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            {activeTab === 'url' && (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Жишээ: ayli-travel.vercel.app"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={`w-full px-4 py-3 pr-24 rounded-xl border ${isLikelyUrl ? 'border-green-200' : 'border-slate-200'} focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
                  />
                  {isLikelyUrl && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold border border-green-100 uppercase">
                      <CheckCircle2 size={12} /> Вэб сайт
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'text' && (
              <textarea
                placeholder="Мэдээллээ энд бичнэ үү..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
              />
            )}
            {activeTab === 'wifi' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Wi-Fi Нэр (SSID)"
                  value={wifi.ssid}
                  onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                  className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="password"
                  placeholder="Нууц үг"
                  value={wifi.password}
                  onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                  className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
            
            <div className="mt-4 flex flex-col md:flex-row gap-3">
              <button
                onClick={handleUpdatePreview}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Урьдчилан харах <ChevronRight size={18} />
              </button>
              <button
                onClick={handleAISlogan}
                disabled={loadingAI}
                className="px-6 py-3 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Sparkles size={18} />
                {loadingAI ? 'AI...' : 'AI Уриа'}
              </button>
            </div>
          </section>

          {/* Design Stylings */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Layers size={20} className="text-blue-500" />
              Дүрс загвар
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Цэгүүдийн хэлбэр</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {DOT_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setConfig({ ...config, dotsStyle: style.id })}
                      className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all ${
                        config.dotsStyle === style.id ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Булангийн хэлбэр</label>
                <div className="grid grid-cols-3 gap-2">
                  {CORNER_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setConfig({ ...config, cornersStyle: style.id })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                        config.cornersStyle === style.id ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Colors & Size */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Palette size={20} className="text-blue-500" />
              Өнгө & Хэмжээ
            </h2>
            <div className="flex flex-wrap gap-3 mb-6">
              {THEMES.map(theme => (
                <button
                  key={theme.name}
                  onClick={() => setConfig({ ...config, fgColor: theme.fg, bgColor: theme.bg })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 hover:border-blue-200 transition-all text-sm font-medium"
                >
                  <div className="flex -space-x-1">
                    <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: theme.fg }} />
                    <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: theme.bg }} />
                  </div>
                  {theme.name}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                Татах хэмжээ (Resolution) <span className="text-blue-600 font-mono">{config.size}x{config.size}px</span>
              </label>
              <input
                type="range" min="128" max="1024" step="8" value={config.size}
                onChange={(e) => setConfig({ ...config, size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </section>

          {/* Logo Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ImageIcon size={20} className="text-purple-500" />
              Төв лого
            </h2>
            {!config.logoSrc ? (
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                <Upload className="text-slate-300 mb-2" size={32} />
                <p className="text-sm text-slate-500 font-bold">Лого оруулах</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-20 h-20 bg-white rounded-xl border p-1 flex items-center justify-center overflow-hidden">
                  <img src={config.logoSrc} className="max-w-full max-h-full object-contain" alt="Logo" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Логоны хэмжээ</span>
                    <span className="text-xs font-bold text-blue-600">{logoPercentage}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setConfig(p => ({ ...p, logoSize: Math.max(20, (p.logoSize || 0) - 5) }))} className="p-1.5 bg-white border rounded shadow-sm hover:bg-slate-50"><Minus size={14} /></button>
                    <input type="range" min="20" max={config.size / 3} value={config.logoSize} onChange={(e) => setConfig({ ...config, logoSize: parseInt(e.target.value) })} className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none accent-purple-600" />
                    <button onClick={() => setConfig(p => ({ ...p, logoSize: Math.min(config.size/3, (p.logoSize || 0) + 5) }))} className="p-1.5 bg-white border rounded shadow-sm hover:bg-slate-50"><Plus size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                     <input type="checkbox" id="excavate" checked={config.excavate} onChange={(e) => setConfig({ ...config, excavate: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                     <label htmlFor="excavate" className="text-xs font-bold text-slate-500">Логоны арын цэгүүдийг нуух</label>
                  </div>
                  <button onClick={() => setConfig(p => ({ ...p, logoSrc: undefined }))} className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1"><Trash2 size={12} /> Лого устгах</button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-8 space-y-6">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-slate-200/60 border border-slate-50 flex flex-col items-center">
              <div className="relative group w-full mb-6">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                  Preview
                </div>
                <div 
                  className="qr-preview-box w-full aspect-square bg-white rounded-3xl shadow-inner border border-slate-100 flex justify-center items-center overflow-hidden p-6"
                  style={{ maxWidth: '400px', margin: '0 auto' }}
                >
                  <div ref={qrRef} className="w-full h-full flex items-center justify-center" />
                </div>
              </div>

              <div className="w-full bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                    <Globe size={12} /> QR доторх өгөгдөл
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                    <Monitor size={10} /> {config.size}px
                  </div>
                </div>
                <p className="text-[11px] font-mono text-slate-600 break-all leading-relaxed bg-white p-2 rounded-lg border border-slate-50">
                  {config.value}
                </p>
              </div>

              {slogan && (
                <div className="mb-6 px-4 py-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center w-full">
                  <p className="text-slate-700 italic font-medium leading-relaxed">"{slogan}"</p>
                </div>
              )}

              <div className="w-full space-y-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Системд Хадгалах
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={downloadPNG} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    <Download size={18} /> PNG
                  </button>
                  <button onClick={copyToClipboard} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    <Copy size={18} /> Хуулах
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
