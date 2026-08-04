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
        className={`relative flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-300 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)] animate-in slide-in-from-bottom-6 duration-200 md:max-h-[92vh] md:rounded-2xl md:zoom-in-95 ${maxWidthClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="relative border-b border-slate-200 bg-white px-5 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {Icon && (
                <div className={`shrink-0 p-2.5 rounded-lg ${iconClassName}`}>
                  <Icon size={22} strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-slate-950 md:text-xl">
                  {title}
                </h3>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
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

        <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 md:px-6 md:py-5">
          {children}
        </div>

        {footer && (
          <div className="app-form-actions sticky bottom-0 px-5 py-3 md:px-6">
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
    className={`relative overflow-hidden rounded-lg border transition-colors ${
      locked
        ? 'border-slate-200 bg-slate-50 opacity-75'
        : complete
          ? 'border-emerald-200 bg-white'
          : 'border-slate-200 bg-white'
    }`}
  >
    <div className="grid md:grid-cols-[190px_minmax(0,1fr)]">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 md:border-b-0 md:border-r md:px-5">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
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
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {description && <p className="mt-1 text-xs leading-snug text-slate-500">{description}</p>}
      </div>
      </div>
      <div className={`p-4 md:p-5 ${locked ? 'pointer-events-none select-none' : ''}`}>{children}</div>
    </div>
  </section>
);

export const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="mb-1.5 block text-xs font-bold text-slate-700">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

export const fieldClassName =
  'w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500';

export default PremiumModal;
