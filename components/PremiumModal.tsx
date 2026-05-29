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
  iconClassName = 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white',
  children,
  footer,
  maxWidthClass = 'max-w-3xl',
  busy = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div
        className="absolute inset-0 bg-[#0B1220]/70 backdrop-blur-md"
        onClick={() => !busy && onClose()}
      />
      <div
        className={`relative w-full ${maxWidthClass} bg-white md:rounded-[36px] rounded-t-[32px] shadow-[0_40px_120px_-30px_rgba(15,23,42,0.55)] overflow-hidden animate-in slide-in-from-bottom-6 md:zoom-in-95 duration-300 flex flex-col max-h-[94vh] md:max-h-[90vh] border border-white/60`}
      >
        <div className="relative px-6 md:px-8 pt-6 md:pt-8 pb-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {Icon && (
                <div className={`shrink-0 p-3 rounded-2xl shadow-lg shadow-blue-600/20 ${iconClassName}`}>
                  <Icon size={22} strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">
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
              className="shrink-0 p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 md:py-8 bg-[linear-gradient(180deg,#F8FAFC_0%,#FFFFFF_100%)]">
          {children}
        </div>

        {footer && (
          <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-white/95 backdrop-blur-sm sticky bottom-0">
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
    className={`relative rounded-[28px] border transition-all duration-300 ${
      locked
        ? 'border-slate-200 bg-slate-50/80 opacity-80'
        : complete
          ? 'border-emerald-200 bg-white shadow-sm shadow-emerald-100/40'
          : 'border-slate-200 bg-white shadow-sm'
    }`}
  >
    <div className="px-5 md:px-6 py-5 border-b border-slate-100 flex items-start gap-4">
      <div
        className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black ${
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
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">{title}</h4>
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
  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

export const fieldClassName =
  'w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400';

export default PremiumModal;
