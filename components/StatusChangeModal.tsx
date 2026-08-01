
import React, { useState } from 'react';
import { X, AlertCircle, MessageSquare } from 'lucide-react';
import { EventStatus } from '../types';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  currentStatus: EventStatus;
  newStatus: EventStatus;
}

const StatusChangeModal: React.FC<StatusChangeModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentStatus, 
  newStatus 
}) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!comment.trim()) {
      setError(true);
      return;
    }
    onConfirm(comment);
    setComment('');
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in duration-200" role="dialog" aria-modal="true" aria-label="Confirmar alteração de status">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            Confirmar Alteração de Status
          </h3>
          <button onClick={onClose} className="app-icon-button text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-center flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status Atual</p>
              <span className="text-sm font-semibold text-slate-600">{currentStatus}</span>
            </div>
            <div className="px-4 text-blue-500">→</div>
            <div className="text-center flex-1">
              <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Novo Status</p>
              <span className="text-sm font-bold text-blue-700">{newStatus}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Comentário/Justificativa <span className="text-red-500">*</span></label>
            <textarea 
              autoFocus
              className={`w-full p-3 bg-slate-50 border rounded-xl outline-none transition-all resize-none text-sm ${error ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200 focus:ring-2 focus:ring-blue-500'}`}
              placeholder="Descreva o motivo desta mudança..."
              rows={4}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-medium">
                <AlertCircle size={12} /> O comentário é obrigatório para auditoria.
              </p>
            )}
          </div>
        </div>

        <div className="app-form-actions p-4">
          <button onClick={onClose} className="min-h-10 px-4 text-sm font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
          <button onClick={handleConfirm} className="app-btn-primary px-6">
            Confirmar Mudança
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusChangeModal;
