import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FileText, Download, AlertCircle } from 'lucide-react';

interface FileData {
  id: string;
  title: string;
  description: string;
  type: string;
  file_url: string;
  file_type: string;
  target_url: string;
}

export const FileViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/public/qr-codes/${id}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Файл олдсонгүй');
        const data = await response.json();
        setFileData(data);
      } catch (err: any) {
        clearTimeout(timeoutId);
        setError(err.name === 'AbortError' ? 'Холболт салсан байна' : err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error || !fileData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="text-red-500 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Алдаа гарлаа</h1>
        <p className="text-slate-500">{error || 'Файл олдсонгүй'}</p>
      </div>
    );
  }

  const isImage = fileData.file_type?.startsWith('image/');
  const isVideo = fileData.file_type?.startsWith('video/');
  const isPDF = fileData.file_type === 'application/pdf';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{fileData.title || 'Файл'}</h1>
            {fileData.description && <p className="text-slate-500 mt-1">{fileData.description}</p>}
          </div>
          <a
            href={fileData.file_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-medium"
          >
            <Download size={18} />
            Татах
          </a>
        </div>

        <div className="bg-slate-100 flex items-center justify-center min-h-[50vh] relative">
          {isImage && (
            <img
              src={fileData.file_url}
              alt={fileData.title}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}

          {isVideo && (
            <video
              src={fileData.file_url}
              controls
              className="w-full max-h-[70vh] bg-black"
            >
              Таны хөтөч бичлэг тоглуулах боломжгүй байна.
            </video>
          )}

          {isPDF && (
            <iframe
              src={`${fileData.file_url}#toolbar=0`}
              className="w-full h-[70vh]"
              title={fileData.title}
            />
          )}

          {!isImage && !isVideo && !isPDF && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <FileText size={64} className="mb-4 text-slate-400" />
              <p className="text-lg font-medium">Энэ файлыг шууд харуулах боломжгүй байна.</p>
              <p className="text-sm mt-2">Дээрх "Татах" товчийг дарж авна уу.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
