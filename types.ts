
export type QRDataType = 'url' | 'text' | 'wifi' | 'file' | 'bio' | 'vcard' | 'app' | 'event' | 'vcard_bulk' | 'phone';

export interface VCardData {
  firstName: string;
  lastName: string;
  organization?: string;
  department?: string;
  title?: string;
  phone?: string; // Work phone
  personalPhone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface AppData {
  iosUrl: string;
  androidUrl: string;
  fallbackUrl?: string;
}

export interface EventData {
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
}

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
  password?: string | null;
  scanLimit?: number | null;
  routingRules?: {
    type: 'time';
    rules: {
      startTime: string;
      endTime: string;
      url: string;
    }[];
  } | null;
  analytics?: {
    cities: Record<string, number>;
    devices: Record<string, number>;
    os: Record<string, number>;
    browsers: Record<string, number>;
    dates: Record<string, number>;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  qr_limit: number;
  qr_count?: number;
  allowed_qr_types?: QRDataType[];
  expires_at?: string | null;
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
  bio_data?: any;
  has_password?: boolean;
}

export interface GeneratedHistory {
  id: string;
  url: string;
  type: QRDataType;
  date: string;
}
