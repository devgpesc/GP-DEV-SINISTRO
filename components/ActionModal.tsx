
import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info, Trash2 } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  type?: 'danger' | 'success' | 'info' | 'warning';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({ 
  isOpen, onClose, onConfirm, title, description, 
  type = 'info', confirmText = 'Confirmar', cancelText = 'Cancelar', showCancel = true 
}) => {
  if (!isOpen) return null;

  const styles = {
    danger: { bg: 'bg-red-50', icon: 'text-red-500', btn: 'bg-red-500 hover:bg-red-600', Icon: Trash2 },
    success: { bg: 'bg-green-50', icon: 'text-green-500', btn: 'bg-green-600 hover:bg-green-700', Icon: CheckCircle2 },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-500', btn: 'bg-amber-500 hover:bg-amber-600', Icon: AlertTriangle },
    info: { bg: 'bg-blue-50', icon: 'text-blue-500', btn: 'bg-blue-600 hover:bg-blue-700', Icon: Info },
  };

  const currentStyle = styles[type];
  const IconComponent = currentStyle.Icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-sm rounded-[20px] border border-slate-200 bg-white p-6 text-center shadow-2xl animate-in zoom-in duration-200" role="alertdialog" aria-modal="true" aria-label={title}>
        
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${currentStyle.bg} ${currentStyle.icon}`}>
          <IconComponent size={28} />
        </div>

        <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
          {description}
        </p>

        <div className={`grid ${showCancel ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
          {showCancel && (
            <button 
              onClick={onClose} 
              className="min-h-11 rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={async () => {
              if (onConfirm) await onConfirm();
              onClose();
            }} 
            className={`min-h-11 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-sm ${currentStyle.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;
