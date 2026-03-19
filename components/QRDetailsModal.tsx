
import React, { useState, useEffect } from 'react';
import { 
  X, 
  BarChart3, 
  Calendar, 
  ExternalLink, 
  QrCode, 
  Clock, 
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Lock
} from 'lucide-react';
import { QRCodeData } from '../types';
import { supabase } from '../services/supabaseClient';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// ... existing code ...

interface QRDetailsModalProps {
  qr: QRCodeData;
  onClose: () => void;
}

export const QRDetailsModal: React.FC<QRDetailsModalProps> = ({ qr, onClose }) => {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`/api/qr-codes/${qr.id}/analytics`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [qr.id]);

  const processData = () => {
    const counts: Record<string, number> = {};
    analytics.forEach((log: any) => {
      const date = new Date(log.scanned_at);
      const key = viewMode === 'day' 
        ? date.toISOString().split('T')[0]
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    // Fill in gaps
    const data = [];
    const now = new Date();
    if (viewMode === 'day') {
      for (let i = 14; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        data.push({
          date: d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }),
          count: counts[key] || 0
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        data.push({
          date: key, // Format: 2026-03
          count: counts[key] || 0
        });
      }
    }
    return data;
  };

  const chartData = processData();
  const isExpired = qr.expires_at && new Date(qr.expires_at) < new Date();

  const getDeviceData = () => {
    const counts: Record<string, number> = {};
    analytics.forEach((log: any) => {
      const type = log.device_type || 'desktop';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const getOSData = () => {
    const counts: Record<string, number> = {};
    analytics.forEach((log: any) => {
      const os = log.os_name || 'Unknown';
      counts[os] = (counts[os] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
  const deviceData = getDeviceData();
  const osData = getOSData();

  const handleDownload = async () => {
    if (!qr.qr_image_url) return;
    try {
      const response = await fetch(qr.qr_image_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${qr.title || 'qr-code'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('Татаж авахад алдаа гарлаа');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <QrCode size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{qr.title || 'Гарчиггүй'}</h2>
              <p className="text-xs text-slate-500 font-medium">QR кодын дэлгэрэнгүй мэдээлэл болон статистик</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-200 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center border border-slate-100">
                {qr.qr_image_url ? (
                  <img 
                    src={qr.qr_image_url} 
                    alt={qr.title} 
                    className="w-48 h-48 object-contain bg-white rounded-2xl p-2 shadow-sm mb-6" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-48 h-48 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-200 mb-6">
                    <QrCode size={64} />
                  </div>
                )}
                
                <div className="w-full space-y-2">
                  <button 
                    onClick={handleDownload}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                  >
                    <Download size={16} /> QR Татах
                  </button>
                  <button 
                    onClick={() => {
                      const redirectUrl = `${window.location.origin}/r/${qr.id}`;
                      navigator.clipboard.writeText(redirectUrl);
                      alert('Холбоос хуулагдлаа');
                    }}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Copy size={16} /> Холбоос хуулах
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isExpired ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {isExpired ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                    <span className="text-sm font-bold text-slate-600">Төлөв</span>
                  </div>
                  <span className={`text-xs font-black uppercase ${isExpired ? 'text-red-500' : 'text-green-500'}`}>
                    {isExpired ? 'Дууссан' : 'Идэвхтэй'}
                  </span>
                </div>

                {qr.has_password && (
                  <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Lock size={16} />
                      </div>
                      <span className="text-sm font-bold text-slate-600">Хамгаалалт</span>
                    </div>
                    <span className="text-xs font-black uppercase text-blue-600">
                      Нууц үгтэй
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <BarChart3 size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Нийт уншилт</span>
                  </div>
                  <span className="text-lg font-black text-slate-900">{qr.scan_count || 0}</span>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                      <ExternalLink size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Target URL</span>
                  </div>
                  <p className="text-xs text-slate-500 break-all font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {qr.type === 'file' ? 'Файл' : qr.type === 'vcard' ? 'Нэрийн хуудас' : qr.type === 'app' ? 'Апп татах' : qr.type === 'event' ? 'Арга хэмжээ' : qr.target_url}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Analytics */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" size={20} />
                    Уншилтын статистик
                  </h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setViewMode('day')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Өдрөөр
                    </button>
                    <button 
                      onClick={() => setViewMode('month')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Сараар
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-[300px] w-full">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <p className="text-sm font-medium">Статистик ачаалж байна...</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#2563eb" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorCount)" 
                          name="Уншилт"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-900 mb-0.5">Мэдээлэл</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                      Энэхүү график нь таны QR кодыг хэзээ, хэдэн удаа уншуулсныг харуулна. Та өдөр болон сараар шүүж харах боломжтой.
                    </p>
                  </div>
                </div>

                {/* New Analytics Charts */}
                {!loading && analytics.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Төхөөрөмж</h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {deviceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Үйлдлийн систем</h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={osData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {osData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Scans List */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="text-blue-600" size={20} />
                    Сүүлийн уншилтууд
                  </h3>
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                    {analytics.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        Уншилт одоогоор алга.
                      </div>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-2">Хэзээ</th>
                              <th className="px-4 py-2">IP / Байршил</th>
                              <th className="px-4 py-2">Төхөөрөмж / OS / Browser</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[...analytics].reverse().slice(0, 10).map((log, i) => (
                              <tr key={i} className="hover:bg-white transition-colors">
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                  {new Date(log.scanned_at).toLocaleString('mn-MN')}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  <div className="flex flex-col">
                                    <span className="font-mono text-[10px]">{log.ip_address || '0.0.0.0'}</span>
                                    <span className="font-bold">{log.country || 'Unknown'}</span>
                                    <span className="text-[10px] opacity-70">{log.city || 'Unknown'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-400">
                                  <div className="flex flex-col">
                                    <span className="capitalize font-bold text-slate-600">{log.device_type || 'desktop'}</span>
                                    <span className="text-[10px] opacity-70">{log.os_name || 'Unknown'}</span>
                                    <span className="text-[10px] opacity-70 italic">{log.browser_name || 'Unknown'}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
