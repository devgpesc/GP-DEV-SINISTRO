
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
      <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 animate-in zoom-in duration-200 text-center border border-slate-100">
        
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${currentStyle.bg} ${currentStyle.icon}`}>
          <IconComponent size={40} />
        </div>

        <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
          {description}
        </p>

        <div className={`grid ${showCancel ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {showCancel && (
            <button 
              onClick={onClose} 
              className="py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={async () => {
              if (onConfirm) await onConfirm();
              onClose();
            }} 
            className={`py-3.5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${currentStyle.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;
