
import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { motion } from 'framer-motion';
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
  Loader2,
  Layout,
  User,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Github,
  Youtube,
  Phone,
  Mail,
  ExternalLink,
  Briefcase,
  Building2,
  X,
  QrCode,
  Users
} from 'lucide-react';
import { generateSlogan } from '../services/geminiService';
import { QRConfig, QRDataType, DotsStyle, CornerStyle, UserProfile, BioData, BioLink } from '../types';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';

const THEMES = [
  { name: 'Classic', fg: '#000000', bg: '#ffffff' },
  { name: 'Midnight', fg: '#1e293b', bg: '#ffffff' },
  { name: 'Royal', fg: '#1d4ed8', bg: '#f0f9ff' },
  { name: 'Forest', fg: '#064e3b', bg: '#f0fdf4' },
  { name: 'Sunset', fg: '#9a3412', bg: '#fff7ed' },
  { name: 'Lavender', fg: '#6d28d9', bg: '#f5f3ff' },
  { name: 'Emerald', fg: '#059669', bg: '#ecfdf5' },
  { name: 'Rose', fg: '#e11d48', bg: '#fff1f2' },
  { name: 'Ocean', fg: '#0369a1', bg: '#f0f9ff' },
  { name: 'Gold', fg: '#854d0e', bg: '#fefce8' },
  { name: 'Neon', fg: '#d946ef', bg: '#fdf4ff' },
  { name: 'Mint', fg: '#0d9488', bg: '#f0fdfa' },
  { name: 'Slate', fg: '#334155', bg: '#f8fafc' },
  { name: 'Indigo', fg: '#4338ca', bg: '#eef2ff' },
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
  const [file, setFile] = useState<File | null>(null);
  const [bioData, setBioData] = useState<BioData>({
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
  const [bioImage, setBioImage] = useState<File | null>(null);
  const [bioImagePreview, setBioImagePreview] = useState<string>('');
  
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [error, setError] = useState<string>('');

  const [vcardData, setVcardData] = useState({
    firstName: '',
    lastName: '',
    organization: '',
    department: '',
    title: '',
    phone: '',
    personalPhone: '',
    email: '',
    website: '',
    address: ''
  });

  const [appData, setAppData] = useState({
    iosUrl: '',
    androidUrl: '',
    fallbackUrl: ''
  });

  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: ''
  });
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [qrPassword, setQrPassword] = useState('');
  
  const [slogan, setSlogan] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [showBioPreview, setShowBioPreview] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin' && user.allowed_qr_types && user.allowed_qr_types.length > 0) {
      if (!user.allowed_qr_types.includes(activeTab)) {
        setActiveTab(user.allowed_qr_types[0]);
      }
    }
  }, [user.allowed_qr_types, user.role, activeTab]);

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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dataFileInputRef = useRef<HTMLInputElement>(null);

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
    if (activeTab === 'file') return `${window.location.origin}/view/preview`;
    if (activeTab === 'bio') return `${window.location.origin}/p/preview`;
    if (activeTab === 'app') return `${window.location.origin}/r/preview`;
    if (activeTab === 'vcard') return `${window.location.origin}/r/preview`;
    if (activeTab === 'event') return `${window.location.origin}/r/preview`;
    return '';
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Овог': 'Бат',
      'Нэр': 'Болд',
      'Байгууллага': 'Компани ХХК',
      'Хэлтэс': 'Мэдээллийн технологи',
      'Албан тушаал': 'Ахлах хөгжүүлэгч',
      'Ажлын утас': '99112233',
      'Хувийн утас': '88112233',
      'Цахим шуудан': 'bold@example.com',
      'Вэб хаяг': 'https://example.com',
      'Хаяг': 'Улаанбаатар, Сүхбаатар дүүрэг'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'vCard_Template');
    XLSX.writeFile(wb, 'vcard_bulk_template.xlsx');
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setBulkData(json);
      } catch (err) {
        alert('Excel файл уншихад алдаа гарлаа.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpdatePreview = () => {
    const value = getQRValue();
    if (!value) return;
    if (activeTab === 'url') setUrl(normalizedUrlValue);
    setConfig(prev => ({ ...prev, value }));
    
    if (activeTab === 'bio') {
      setShowBioPreview(true);
    }
  };

  const handleBulkSave = async () => {
    if (bulkData.length === 0) return;
    setBulkGenerating(true);
    setBulkProgress(0);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const items = bulkData.map(row => ({
        lastName: row['Овог'] || '',
        firstName: row['Нэр'] || '',
        organization: row['Байгууллага'] || '',
        department: row['Хэлтэс'] || '',
        title: row['Албан тушаал'] || '',
        phone: row['Ажлын утас'] || '',
        personalPhone: row['Хувийн утас'] || '',
        email: row['Цахим шуудан'] || '',
        website: row['Вэб хаяг'] || '',
        address: row['Хаяг'] || ''
      }));

      // We can send all items to the backend and let it handle the generation
      const response = await fetch('/api/qr-codes/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items,
          config
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Бөөнөөр үүсгэхэд алдаа гарлаа');
      }

      setBulkProgress(100);
      alert(`${items.length} ширхэг QR код амжилттай үүслээ!`);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleSave = async () => {
    let targetUrl = getQRValue();
    if (!targetUrl && activeTab !== 'file') {
      alert('Мэдээллээ оруулна уу');
      return;
    }
    if (activeTab === 'file' && !file) {
      alert('Файлаа оруулна уу');
      return;
    }
    if (activeTab === 'file' && file) {
      const maxSize = 30 * 1024 * 1024; // 30MB
      const blockedExtensions = ['.exe', '.zip', '.rar', '.bat', '.sh', '.bin', '.dll', '.msi'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (file.size > maxSize) {
        alert('Файлын хэмжээ 30MB-аас ихгүй байх ёстой.');
        return;
      }
      if (blockedExtensions.includes(fileExt)) {
        alert('Энэ төрлийн файлыг хуулахыг хориглосон байна (.exe, .zip, .rar гэх мэт).');
        return;
      }
    }
    if (!title) {
      alert('Гарчиг оруулна уу');
      return;
    }

    setSaving(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for uploads
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      let uploadedFileUrl = '';
      let uploadedFileType = '';
      let bioProfileUrl = '';

      // Handle Bio Profile Image
      if (activeTab === 'bio' && bioImage) {
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
      }

      if (activeTab === 'file' && file) {
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
          
        uploadedFileUrl = publicUrl;
        uploadedFileType = file.type;
        targetUrl = publicUrl; // Temporary, will be replaced by redirect URL
      }

      // 1. Insert into DB first to get the ID
      const response = await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          user_id: user.id,
          title,
          description,
          target_url: targetUrl,
          config: usePassword && qrPassword ? { ...config, password: qrPassword } : config,
          expires_at: expiresAt || null,
          type: activeTab,
          file_url: uploadedFileUrl || null,
          file_type: uploadedFileType || null,
          bio_data: activeTab === 'bio' ? { ...bioData, profile_image_url: bioProfileUrl || bioData.profile_image_url } : 
                    activeTab === 'vcard' ? vcardData :
                    activeTab === 'app' ? appData :
                    activeTab === 'event' ? eventData : null
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
      // Use redirect URL for 'url', 'file', 'bio', and 'app' types
      const qrValue = (activeTab === 'url' || activeTab === 'file' || activeTab === 'bio' || activeTab === 'app' || activeTab === 'vcard' || activeTab === 'event') 
        ? `${window.location.origin}${activeTab === 'bio' ? '/p/' : '/r/'}${qrData.id}` 
        : targetUrl;
      
      // Update the QR instance with the correct value before generating the blob
      if (qrCodeInstance.current) {
        qrCodeInstance.current.update({
          data: qrValue
        });
      }

      const blob = await qrCodeInstance.current?.getRawData('png');
      if (!blob) throw new Error('QR код үүсгэж чадсангүй');

      // 3. Upload image to Storage
      const qrFileName = `${qrData.id}.png`;
      const { error: qrUploadError } = await supabase.storage
        .from('qrcodes')
        .upload(qrFileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (qrUploadError) {
        console.error('Storage upload error:', qrUploadError);
      } else {
        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('qrcodes')
          .getPublicUrl(qrFileName);

        // 5. Update DB with image URL and correct target_url for bio/file/app/vcard/event
        const updateData: any = { qr_image_url: publicUrl };
        if (activeTab === 'bio' || activeTab === 'file' || activeTab === 'app' || activeTab === 'vcard' || activeTab === 'event') {
          updateData.target_url = qrValue;
        }

        await fetch(`/api/qr-codes/${qrData.id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal,
          body: JSON.stringify(updateData)
        });
      }
      
      clearTimeout(timeoutId);
      alert('QR код амжилттай хадгалагдлаа');
      onSaved();
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Save error:', err);
      if (err.message?.includes('Refresh Token')) {
        alert('Таны нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.');
        await supabase.auth.signOut();
      } else {
        alert('Алдаа: ' + (err.name === 'AbortError' ? 'Холболт салсан байна (Timeout)' : err.message));
      }
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
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input 
                  type="checkbox" 
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-700">Нууц үгээр хамгаалах</span>
              </label>
              
              {usePassword && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Нууц үг</label>
                  <input
                    type="text"
                    placeholder="Нууц үгээ оруулна уу"
                    value={qrPassword}
                    onChange={(e) => setQrPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1 ml-1">Энэхүү QR кодыг уншуулахад нууц үг шаардах болно.</p>
                </div>
              )}
            </div>
          </section>

          {/* Tabs */}
          <section className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'url', icon: LinkIcon, label: 'Вэб сайт' },
              { id: 'text', icon: FileText, label: 'Текст' },
              { id: 'wifi', icon: Wifi, label: 'Wi-Fi' },
              { id: 'file', icon: Upload, label: 'Файл/Зураг' },
              { id: 'bio', icon: Layout, label: 'Mini-Web' },
              { id: 'vcard', icon: User, label: 'Нэрийн хуудас' },
              { id: 'app', icon: Monitor, label: 'App Store' },
              { id: 'event', icon: Calendar, label: 'Арга хэмжээ' },
              { id: 'vcard_bulk', icon: Users, label: 'Бөөнөөр (Excel)' },
            ].filter(tab => user.role === 'admin' || !user.allowed_qr_types || user.allowed_qr_types.includes(tab.id as QRDataType) || (tab.id === 'vcard_bulk' && user.allowed_qr_types.includes('vcard'))).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as QRDataType)}
                className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={16} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
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
            {activeTab === 'file' && (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer" onClick={() => dataFileInputRef.current?.click()}>
                <input
                  type="file"
                  ref={dataFileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const selectedFile = e.target.files[0];
                      const maxSize = 30 * 1024 * 1024; // 30MB
                      const blockedExtensions = ['.exe', '.zip', '.rar', '.bat', '.sh', '.bin', '.dll', '.msi'];
                      const fileExt = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
                      
                      if (selectedFile.size > maxSize) {
                        alert('Файлын хэмжээ 30MB-аас ихгүй байх ёстой.');
                        e.target.value = '';
                        return;
                      }
                      
                      if (blockedExtensions.includes(fileExt)) {
                        alert('Энэ төрлийн файлыг хуулахыг хориглосон байна (.exe, .zip, .rar гэх мэт).');
                        e.target.value = '';
                        return;
                      }
                      
                      setFile(selectedFile);
                    }
                  }}
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                />
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Файл хуулах</h3>
                <p className="text-slate-500 text-sm mb-4">Зураг, Бичлэг эсвэл PDF файл сонгоно уу</p>
                {file && (
                  <div className="bg-blue-50 text-blue-700 p-3 rounded-xl inline-flex items-center gap-2 font-medium">
                    <CheckCircle2 size={18} />
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'bio' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div 
                    className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden bg-slate-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {bioImagePreview ? (
                      <img src={bioImagePreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <>
                        <Upload size={24} className="text-slate-300 mb-1" />
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

            {activeTab === 'vcard' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Овог</label>
                    <input type="text" value={vcardData.lastName} onChange={(e) => setVcardData({...vcardData, lastName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Нэр</label>
                    <input type="text" value={vcardData.firstName} onChange={(e) => setVcardData({...vcardData, firstName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Байгууллага</label>
                    <input type="text" value={vcardData.organization} onChange={(e) => setVcardData({...vcardData, organization: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Хэлтэс</label>
                    <input type="text" value={vcardData.department || ''} onChange={(e) => setVcardData({...vcardData, department: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Албан тушаал</label>
                  <input type="text" value={vcardData.title} onChange={(e) => setVcardData({...vcardData, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Ажлын утас</label>
                    <input type="tel" value={vcardData.phone} onChange={(e) => setVcardData({...vcardData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Хувийн утас</label>
                    <input type="tel" value={vcardData.personalPhone || ''} onChange={(e) => setVcardData({...vcardData, personalPhone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Имэйл</label>
                  <input type="email" value={vcardData.email} onChange={(e) => setVcardData({...vcardData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Вэб сайт</label>
                  <input type="url" value={vcardData.website} onChange={(e) => setVcardData({...vcardData, website: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Хаяг</label>
                  <input type="text" value={vcardData.address} onChange={(e) => setVcardData({...vcardData, address: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            )}

            {activeTab === 'app' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">iOS App Store URL</label>
                  <input type="url" value={appData.iosUrl} onChange={(e) => setAppData({...appData, iosUrl: e.target.value})} placeholder="https://apps.apple.com/..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Android Play Store URL</label>
                  <input type="url" value={appData.androidUrl} onChange={(e) => setAppData({...appData, androidUrl: e.target.value})} placeholder="https://play.google.com/..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Бусад үед (Fallback URL)</label>
                  <input type="url" value={appData.fallbackUrl} onChange={(e) => setAppData({...appData, fallbackUrl: e.target.value})} placeholder="https://yourwebsite.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            )}

            {activeTab === 'event' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Арга хэмжээний нэр</label>
                  <input type="text" value={eventData.title} onChange={(e) => setEventData({...eventData, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Байршил</label>
                  <input type="text" value={eventData.location} onChange={(e) => setEventData({...eventData, location: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Эхлэх огноо, цаг</label>
                    <input type="datetime-local" value={eventData.startDate} onChange={(e) => setEventData({...eventData, startDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Дуусах огноо, цаг</label>
                    <input type="datetime-local" value={eventData.endDate} onChange={(e) => setEventData({...eventData, endDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Тайлбар</label>
                  <textarea value={eventData.description} onChange={(e) => setEventData({...eventData, description: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>
              </div>
            )}

            {activeTab === 'vcard_bulk' && (
              <div className="space-y-4">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm">
                  <p className="font-bold mb-2">Excel файлаас бөөнөөр үүсгэх</p>
                  <p className="mb-3">Та доорх загвар файлыг татаж аваад мэдээллээ бөглөөд буцааж оруулна уу.</p>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold shadow-sm hover:shadow transition-all text-xs flex items-center gap-2"
                  >
                    <Download size={14} /> Загвар файл татах
                  </button>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase ml-1">Excel файл оруулах (.xlsx)</label>
                  <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleBulkFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                    <p className="text-sm font-medium text-slate-600">Файлаа энд чирж оруулах эсвэл дарж сонгоно уу</p>
                  </div>
                </div>

                {bulkData.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-700">Оруулсан өгөгдөл</p>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        Нийт: {bulkData.length}
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto text-xs text-slate-600 bg-white rounded-lg border border-slate-100">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 border-b">Овог</th>
                            <th className="px-3 py-2 border-b">Нэр</th>
                            <th className="px-3 py-2 border-b">Байгууллага</th>
                            <th className="px-3 py-2 border-b">Утас</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {bulkData.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{row['Овог'] || ''}</td>
                              <td className="px-3 py-2">{row['Нэр'] || ''}</td>
                              <td className="px-3 py-2">{row['Байгууллага'] || ''}</td>
                              <td className="px-3 py-2">{row['Ажлын утас'] || row['Хувийн утас'] || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {bulkData.length > 5 && (
                        <div className="text-center py-2 text-slate-400 bg-slate-50 border-t border-slate-100">
                          ... болон бусад {bulkData.length - 5} мөр
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab !== 'vcard_bulk' && (
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
            )}
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
              <div onClick={() => logoInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                <Upload className="text-slate-300 mb-2" size={32} />
                <p className="text-sm text-slate-500 font-bold">Лого оруулах</p>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
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
              {activeTab === 'vcard_bulk' ? (
                <div className="w-full text-center py-12">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users size={48} className="text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Бөөнөөр үүсгэх</h3>
                  <p className="text-sm text-slate-500 mb-8">
                    {bulkData.length > 0 
                      ? `Та ${bulkData.length} хүний мэдээлэл оруулсан байна. Доорх товчийг дарж QR кодуудыг үүсгэнэ үү.`
                      : 'Excel файлаа оруулж QR кодуудыг бөөнөөр үүсгэнэ үү.'}
                  </p>
                  
                  {bulkGenerating && (
                    <div className="w-full max-w-xs mx-auto mb-6">
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                        <span>Үүсгэж байна...</span>
                        <span>{bulkProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${bulkProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleBulkSave}
                    disabled={bulkData.length === 0 || bulkGenerating}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    {bulkGenerating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {bulkGenerating ? 'Үүсгэж байна...' : `${bulkData.length} QR код үүсгэх`}
                  </button>
                  {error && <p className="mt-4 text-red-500 text-xs font-bold">{error}</p>}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bio Preview Modal */}
      {showBioPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 ml-2">
                <Layout size={18} className="text-blue-600" />
                Mini-Web Урьдчилан харах
              </h3>
              <button 
                onClick={() => setShowBioPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div 
                className="w-full rounded-[24px] shadow-sm flex flex-col items-center py-10 px-6 min-h-[500px]"
                style={{ backgroundColor: bioData.background_color || '#f8fafc' }}
              >
                {/* Profile Image */}
                <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden mb-6 bg-white flex-shrink-0">
                  {bioImagePreview ? (
                    <img 
                      src={bioImagePreview} 
                      alt={bioData.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                      <User size={40} />
                    </div>
                  )}
                </div>

                {/* Name & Bio */}
                <div className="text-center mb-8 w-full">
                  <h1 
                    className="text-xl font-black mb-1"
                    style={{ color: bioData.text_color || '#0f172a' }}
                  >
                    {bioData.name || 'Таны нэр'}
                  </h1>

                  {(bioData.position || bioData.company) && (
                    <div 
                      className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 mb-3 text-xs font-medium opacity-70"
                      style={{ color: bioData.text_color || '#475569' }}
                    >
                      {bioData.position && (
                        <div className="flex items-center gap-1">
                          <Briefcase size={12} />
                          <span>{bioData.position}</span>
                        </div>
                      )}
                      {bioData.company && (
                        <div className="flex items-center gap-1">
                          <Building2 size={12} />
                          <span>{bioData.company}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p 
                    className="text-xs opacity-80 leading-relaxed max-w-[240px] mx-auto"
                    style={{ color: bioData.text_color || '#475569' }}
                  >
                    {bioData.bio || 'Таны намтар энд харагдана...'}
                  </p>
                </div>

                {/* Links */}
                <div className="w-full space-y-3">
                  {bioData.links.length > 0 ? bioData.links.map((link) => {
                    // Simple icon mapping for preview
                    const Icon = link.icon === 'mail' ? Mail : 
                                link.icon === 'phone' ? Phone : 
                                link.icon === 'facebook' ? Facebook :
                                link.icon === 'instagram' ? Instagram :
                                link.icon === 'twitter' ? Twitter :
                                link.icon === 'linkedin' ? Linkedin :
                                link.icon === 'github' ? Github :
                                link.icon === 'youtube' ? Youtube : Globe;

                    return (
                      <div
                        key={link.id}
                        className="flex items-center p-3 rounded-xl shadow-sm border border-white/10"
                        style={{ 
                          backgroundColor: bioData.button_color || '#ffffff',
                          color: bioData.button_text_color || '#0f172a'
                        }}
                      >
                        <div className="p-1.5 rounded-lg bg-black/5 mr-3">
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 flex flex-col">
                          <span className="font-bold text-xs">{link.label || 'Холбоос'}</span>
                          {(link.icon === 'mail' || link.icon === 'phone') && link.url && (
                            <span className="text-[9px] opacity-50 font-medium">{link.url}</span>
                          )}
                        </div>
                        <ExternalLink size={14} className="opacity-30" />
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
                      Холбоос нэмээгүй байна
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-white flex justify-center">
              <button 
                onClick={() => setShowBioPreview(false)}
                className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md"
              >
                Болсон
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
