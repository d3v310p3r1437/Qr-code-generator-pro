
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeData } from '../types';
import { supabase, publicSupabase } from '../services/supabaseClient';
import { motion } from 'framer-motion';
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
  Building2
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
        const { data, error } = await publicSupabase
          .from('qr_codes')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Хуудас олдсонгүй');
        if (data.type !== 'bio' || !data.bio_data) throw new Error('Энэ QR код мини-вэб биш байна');

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
            {bio_data.name}
          </h1>

          {(bio_data.position || bio_data.company) && (
            <div 
              className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 mb-4 text-sm font-medium opacity-70"
              style={{ color: bio_data.text_color || '#475569' }}
            >
              {bio_data.position && (
                <div className="flex items-center gap-1.5">
                  <Briefcase size={14} />
                  <span>{bio_data.position}</span>
                </div>
              )}
              {bio_data.company && (
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>{bio_data.company}</span>
                </div>
              )}
            </div>
          )}

          <p 
            className="text-sm opacity-80 leading-relaxed max-w-xs mx-auto"
            style={{ color: bio_data.text_color || '#475569' }}
          >
            {bio_data.bio}
          </p>
        </motion.div>

        {/* Links */}
        <div className="w-full space-y-4">
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
                  <span className="font-bold text-sm whitespace-nowrap">{link.label}</span>
                  {(link.icon === 'mail' || link.icon === 'phone') && link.url && (
                    <span className="text-xs opacity-70 font-medium truncate">{link.url}</span>
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
