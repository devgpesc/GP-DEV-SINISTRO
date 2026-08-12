import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  secondary?: string;
  keywords?: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
  required = false,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeSearch(
      `${option.label} ${option.secondary || ''} ${option.keywords || ''}`,
    ).includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      >
        <Search size={17} className="shrink-0 text-slate-400" />
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={17} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false);
                if (event.key === 'Enter' && filteredOptions.length === 1) {
                  event.preventDefault();
                  onChange(filteredOptions[0].value);
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-md bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">{emptyMessage}</p>
            ) : filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${option.value === value ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{option.label}</span>
                  {option.secondary && <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{option.secondary}</span>}
                </span>
                {option.value === value && <Check size={17} className="shrink-0 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
