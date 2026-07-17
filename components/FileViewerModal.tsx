import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { getAttachmentKind } from '../services/attachmentService';

interface FileViewerModalProps {
  file: { name: string; type: string; url: string } | null;
  onClose: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({ file, onClose }) => {
  if (!file) return null;

  const kind = getAttachmentKind(file.type || '', file.name);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-5xl max-h-[92vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{file.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{kind}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={file.url} download={file.name} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" title="Baixar">
              <Download size={18} />
            </a>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" title="Abrir em nova aba">
              <ExternalLink size={18} />
            </a>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4 flex items-center justify-center min-h-[320px]">
          {kind === 'image' && (
            <img src={file.url} alt={file.name} className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-lg" />
          )}
          {kind === 'video' && (
            <video src={file.url} controls autoPlay className="max-w-full max-h-[70vh] rounded-2xl shadow-lg bg-black" />
          )}
          {kind === 'pdf' && (
            <iframe src={file.url} title={file.name} className="w-full h-[70vh] rounded-2xl border border-slate-200 bg-white" />
          )}
          {(kind === 'word' || kind === 'file') && (
            <div className="text-center p-10">
              <p className="text-sm font-bold text-slate-600 mb-4">Visualização direta indisponível para este formato.</p>
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest">
                <ExternalLink size={16} /> Abrir / Baixar arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
