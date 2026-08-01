import React from 'react';
import { X, Loader2, LucideIcon } from 'lucide-react';

type PremiumModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  busy?: boolean;
};

const PremiumModal: React.FC<PremiumModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'bg-blue-600 text-white',
  children,
  footer,
  maxWidthClass = 'max-w-3xl',
  busy = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-5">
      <div
        className="absolute inset-0 bg-[#0B1220]/62 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />
      <div
        className={`relative w-full ${maxWidthClass} bg-white rounded-t-[20px] md:rounded-[20px] shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)] overflow-hidden animate-in slide-in-from-bottom-6 md:zoom-in-95 duration-200 flex flex-col max-h-[96vh] md:max-h-[92vh] border border-slate-300`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="relative px-5 md:px-7 py-5 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {Icon && (
                <div className={`shrink-0 p-2.5 rounded-lg ${iconClassName}`}>
                  <Icon size={22} strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="app-icon-button shrink-0 text-slate-400 hover:text-slate-700 disabled:opacity-40"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 md:py-6 bg-white">
          {children}
        </div>

        {footer && (
          <div className="app-form-actions sticky bottom-0 px-5 py-4 md:px-7">
            {footer}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
      </div>
    </div>
  );
};

export const FormSection: React.FC<{
  step: number;
  title: string;
  description?: string;
  locked?: boolean;
  complete?: boolean;
  children: React.ReactNode;
}> = ({ step, title, description, locked, complete, children }) => (
  <section
    className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
      locked
        ? 'border-slate-200 bg-slate-50 opacity-75'
        : complete
          ? 'border-emerald-200 bg-white'
          : 'border-slate-200 bg-white'
    }`}
  >
    <div className="px-5 md:px-6 py-5 border-b border-slate-100 flex items-start gap-4">
      <div
        className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold ${
          complete
            ? 'bg-emerald-500 text-white'
            : locked
              ? 'bg-slate-200 text-slate-500'
              : 'bg-blue-600 text-white'
        }`}
      >
        {step}
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {description && <p className="text-xs text-slate-500 font-medium mt-1">{description}</p>}
      </div>
    </div>
    <div className={`p-5 md:p-6 ${locked ? 'pointer-events-none select-none' : ''}`}>{children}</div>
  </section>
);

export const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="block text-xs font-bold text-slate-600 mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

export const fieldClassName =
  'w-full min-h-11 px-3.5 py-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400';

export default PremiumModal;
