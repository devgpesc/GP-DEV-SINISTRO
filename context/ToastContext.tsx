
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto remove after 4 seconds (unless loading)
    if (type !== 'loading') {
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    }
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[150] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-slate-900/95 text-white backdrop-blur-md px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-4 min-w-[320px] max-w-[400px] animate-in slide-in-from-right-10 duration-300 pointer-events-auto border border-white/10"
          >
            <div className={`mt-0.5 p-2 rounded-xl bg-white/10 ${
                toast.type === 'success' ? 'text-green-400' :
                toast.type === 'error' ? 'text-red-400' :
                toast.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
            }`}>
               {toast.type === 'success' && <CheckCircle2 size={20} />}
               {toast.type === 'error' && <XCircle size={20} />}
               {toast.type === 'warning' && <AlertTriangle size={20} />}
               {toast.type === 'info' && <Info size={20} />}
               {toast.type === 'loading' && <Loader2 className="animate-spin" size={20} />}
            </div>
            <div className="flex-1">
               <h4 className="text-sm font-bold text-white">{toast.title}</h4>
               <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
};
