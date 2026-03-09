
export type QRDataType = 'url' | 'text' | 'wifi';

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
}

export interface GeneratedHistory {
  id: string;
  url: string;
  type: QRDataType;
  date: string;
}
