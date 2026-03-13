
export type QRDataType = 'url' | 'text' | 'wifi' | 'file' | 'bio';

export interface BioLink {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

export interface BioData {
  profile_image_url?: string;
  name: string;
  position?: string;
  company?: string;
  bio: string;
  links: BioLink[];
  theme_color: string;
  text_color: string;
  background_color: string;
  button_color: string;
  button_text_color: string;
}

export type DotsStyle = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type CornerStyle = 'square' | 'dot' | 'extra-rounded';

export interface QRConfig {
  value: string;
  size: number;
  fgColor: string;
  bgColor: string;
  level: 'L' | 'M' | 'Q' | 'H';
  includeMargin: boolean;
  logoSrc?: string;
  logoSize?: number;
  excavate?: boolean;
  dotsStyle: DotsStyle;
  cornersStyle: CornerStyle;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  qr_limit: number;
  qr_count?: number;
}

export interface QRCodeData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  target_url: string;
  config: QRConfig;
  expires_at: string | null;
  scan_count: number;
  created_at: string;
  type: QRDataType;
  qr_image_url?: string;
  file_url?: string;
  file_type?: string;
  bio_data?: BioData;
}

export interface GeneratedHistory {
  id: string;
  url: string;
  type: QRDataType;
  date: string;
}
