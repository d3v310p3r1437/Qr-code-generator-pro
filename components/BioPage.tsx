
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeData } from '../types';
import { supabase, publicSupabase } from '../services/supabaseClient';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Github, 
  Globe, 
  Mail, 
  Phone, 
  Youtube,
  ExternalLink,
  Loader2,
  AlertCircle,
  QrCode,
  Briefcase,
  Building2,
  UserPlus,
  Layout
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  github: Github,
  globe: Globe,
  mail: Mail,
  phone: Phone,
  youtube: Youtube,
};

const ContactLink = ({ href, icon, label, value, bio_data }: { href: string, icon: string, label: string, value: string, bio_data: any }) => {
  const Icon = ICON_MAP[icon] || Globe;
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-between p-4 rounded-2xl shadow-sm border border-slate-100 transition-all group"
      style={{ 
        backgroundColor: bio_data.button_color || '#ffffff',
        color: bio_data.button_text_color || '#0f172a'
      }}
    >
      <div className="flex items-center gap-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 group-hover:bg-blue-50 transition-colors"
          style={{ color: bio_data.theme_color || '#3b82f6' }}
        >
          <Icon size={20} />
        </div>
        <div className="text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-50">{DOMPurify.sanitize(label, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</div>
          <div className="text-sm font-bold">{DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</div>
        </div>
      </div>
      <ExternalLink size={16} className="opacity-20 group-hover:opacity-100 transition-opacity" />
    </motion.a>
  );
};

export const BioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [qr, setQr] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBio = async () => {
      if (!id || id === 'preview') {
        setLoading(false);
        return;
      }

      // Validate UUID format to prevent Supabase/Postgres error
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        setError('Буруу хаяг байна');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/qr-codes/${id}`);
        
        if (response.status === 401) {
          const data = await response.json();
          if (data.require_password) {
            window.location.href = `/secure/${id}`;
            return;
          }
        }
        
        if (!response.ok) throw new Error('Хуудас олдсонгүй');
        const data = await response.json();
        
        if (data.type !== 'bio' && data.type !== 'mini_web_contact') throw new Error('Энэ QR код мини-вэб биш байна');
        if (!data.bio_data) throw new Error('Өгөгдөл олдсонгүй');

        setQr(data);
        
        // Track scan
        fetch(`/api/scan/${id}`, { method: 'POST' }).catch(console.error);
      } catch (err: any) {
        console.error('Bio fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBio();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (id === 'preview') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <QrCode className="text-blue-600 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Урьдчилан харах</h1>
        <p className="text-slate-500 mb-6">Энэ бол таны мини-вэбсайтын урьдчилан харах хуудас юм. Хадгалсны дараа таны QR код идэвхжинэ.</p>
        <button onClick={() => window.close()} className="text-blue-600 font-bold hover:underline">Хаах</button>
      </div>
    );
  }

  if (error || !qr || !qr.bio_data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <AlertCircle className="text-red-500 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Алдаа гарлаа</h1>
        <p className="text-slate-500 mb-6">{error || 'Хуудас олдсонгүй'}</p>
        <a href="/" className="text-blue-600 font-bold hover:underline">Нүүр хуудас руу буцах</a>
      </div>
    );
  }

  const { bio_data } = qr;

  const downloadVCard = () => {
    if (qr.type !== 'mini_web_contact') return;
    
    const v = qr.bio_data;
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${v.name}`,
      `N:;${v.name};;;`,
      v.company ? `ORG:${v.company}${v.department ? ';' + v.department : ''}` : '',
      v.position ? `TITLE:${v.position}` : '',
      v.phone ? `TEL;TYPE=WORK,VOICE:${v.phone}` : '',
      v.personalPhone ? `TEL;TYPE=CELL,VOICE:${v.personalPhone}` : '',
      v.email ? `EMAIL;TYPE=PREF,INTERNET:${v.email}` : '',
      v.website ? `URL:${v.website}` : '',
      v.address ? `ADR;TYPE=WORK:;;${v.address};;;;` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${v.name.replace(/\s/g, '_')}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center py-12 px-6"
      style={{ backgroundColor: bio_data.background_color || '#f8fafc' }}
    >
      <div className="max-w-md w-full flex flex-col items-center">
        {/* Profile Image */}
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden mb-6 bg-white"
        >
          {bio_data.profile_image_url ? (
            <img 
              src={bio_data.profile_image_url} 
              alt={bio_data.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
              <Globe size={48} />
            </div>
          )}
        </motion.div>

        {/* Name & Bio */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-10"
        >
          <h1 
            className="text-2xl font-black mb-2"
            style={{ color: bio_data.text_color || '#0f172a' }}
          >
            {DOMPurify.sanitize(bio_data.name, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
          </h1>

          {(bio_data.position || bio_data.company || bio_data.department) && (
            <div 
              className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 mb-4 text-sm font-medium opacity-70"
              style={{ color: bio_data.text_color || '#475569' }}
            >
              {bio_data.position && (
                <div className="flex items-center gap-1.5 max-w-[280px]">
                  <Briefcase size={14} className="flex-shrink-0" />
                  <span className="text-center">{DOMPurify.sanitize(bio_data.position, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</span>
                </div>
              )}
              {bio_data.company && (
                <div className="flex items-center gap-1.5 max-w-[280px]">
                  <Building2 size={14} className="flex-shrink-0" />
                  <span className="text-center">
                    {DOMPurify.sanitize(bio_data.company, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                  </span>
                </div>
              )}
              {bio_data.department && (
                <div className="flex items-center gap-1.5 max-w-[280px]">
                  <Layout size={14} className="flex-shrink-0" />
                  <span className="text-center">
                    {DOMPurify.sanitize(bio_data.department, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                  </span>
                </div>
              )}
            </div>
          )}

          <p 
            className="text-sm opacity-80 leading-relaxed max-w-sm mx-auto px-4"
            style={{ color: bio_data.text_color || '#475569' }}
          >
            {DOMPurify.sanitize(bio_data.bio, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
          </p>

          {qr.type === 'mini_web_contact' && (
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={downloadVCard}
              className="mt-6 flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg transition-all mx-auto"
              style={{ 
                backgroundColor: bio_data.button_color || '#3b82f6',
                color: bio_data.button_text_color || '#ffffff'
              }}
            >
              <UserPlus size={20} />
              Холбоо барих мэдээлэл хадгалах
            </motion.button>
          )}
        </motion.div>

        {/* Links */}
        <div className="w-full space-y-4">
          {/* Direct Contact Links for Mini-Web + Contact */}
          {qr.type === 'mini_web_contact' && (
            <>
              {bio_data.personalPhone && (
                <ContactLink 
                  href={`tel:${bio_data.personalPhone.replace(/\s/g, '')}`} 
                  icon="phone" 
                  label="Хувийн утас" 
                  value={bio_data.personalPhone} 
                  bio_data={bio_data}
                />
              )}
              {bio_data.email && (
                <ContactLink 
                  href={`mailto:${bio_data.email}`} 
                  icon="mail" 
                  label="Имэйл" 
                  value={bio_data.email} 
                  bio_data={bio_data}
                />
              )}
              {bio_data.website && (
                <ContactLink 
                  href={/^https?:\/\//i.test(bio_data.website) ? bio_data.website : `https://${bio_data.website}`} 
                  icon="globe" 
                  label="Вэб сайт" 
                  value={bio_data.website} 
                  bio_data={bio_data}
                />
              )}
              {bio_data.address && (
                <ContactLink 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bio_data.address)}`} 
                  icon="globe" 
                  label="Хаяг" 
                  value={bio_data.address} 
                  bio_data={bio_data}
                />
              )}
            </>
          )}

          {bio_data.links.map((link: any, index: number) => {
            const Icon = ICON_MAP[link.icon || 'globe'] || Globe;
            
            // Format URL
            let href = link.url;
            if (link.icon === 'mail' && !href.startsWith('mailto:')) {
              href = `mailto:${href}`;
            } else if (link.icon === 'phone' && !href.startsWith('tel:')) {
              href = `tel:${href.replace(/\s/g, '')}`;
            } else if (link.icon === 'facebook' && !href.includes('facebook.com') && !/^https?:\/\//i.test(href)) {
              href = `https://facebook.com/${href}`;
            } else if (link.icon === 'instagram' && !href.includes('instagram.com') && !/^https?:\/\//i.test(href)) {
              href = `https://instagram.com/${href}`;
            } else if (link.icon === 'twitter' && !href.includes('twitter.com') && !href.includes('x.com') && !/^https?:\/\//i.test(href)) {
              href = `https://twitter.com/${href}`;
            } else if (link.icon === 'linkedin' && !href.includes('linkedin.com') && !/^https?:\/\//i.test(href)) {
              href = `https://linkedin.com/in/${href}`;
            } else if (link.icon === 'github' && !href.includes('github.com') && !/^https?:\/\//i.test(href)) {
              href = `https://github.com/${href}`;
            } else if (link.icon === 'youtube' && !href.includes('youtube.com') && !/^https?:\/\//i.test(href)) {
              href = `https://youtube.com/@${href}`;
            } else if (link.icon !== 'mail' && link.icon !== 'phone' && !/^https?:\/\//i.test(href)) {
              href = `https://${href}`;
            }

            // Sanitize URL to prevent XSS
            href = DOMPurify.sanitize(href, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
            // DOMPurify might return empty string if it's a javascript: link, so we fallback to #
            if (!href) href = '#';

            return (
              <motion.a
                key={link.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center p-4 rounded-2xl shadow-sm border border-white/10 transition-all group"
                style={{ 
                  backgroundColor: bio_data.button_color || '#ffffff',
                  color: bio_data.button_text_color || '#0f172a'
                }}
              >
                <div className="p-2 rounded-xl bg-black/5 mr-4 group-hover:bg-black/10 transition-colors">
                  <Icon size={20} />
                </div>
                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                  <span className="font-bold text-sm whitespace-nowrap">{DOMPurify.sanitize(link.label, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</span>
                  {(link.icon === 'mail' || link.icon === 'phone') && link.url && (
                    <span className="text-xs opacity-70 font-medium truncate">{DOMPurify.sanitize(link.url, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</span>
                  )}
                </div>
                <ExternalLink size={16} className="opacity-30 group-hover:opacity-100 transition-opacity" />
              </motion.a>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full">
            <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white">
              <Globe size={12} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">QR Manager Pro</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
