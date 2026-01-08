
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

export interface GeneratedHistory {
  id: string;
  url: string;
  type: QRDataType;
  date: string;
}
