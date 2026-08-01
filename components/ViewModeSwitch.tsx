import React from 'react';
import { Columns3, LayoutGrid, List, type LucideIcon } from 'lucide-react';

export type ViewMode = 'list' | 'cards' | 'matrix';

interface ViewModeSwitchProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  modes?: ViewMode[];
  className?: string;
}

const modeMeta: Record<ViewMode, { label: string; icon: LucideIcon }> = {
  list: { label: 'Lista', icon: List },
  cards: { label: 'Cards', icon: LayoutGrid },
  matrix: { label: 'Matriz', icon: Columns3 },
};

const ViewModeSwitch: React.FC<ViewModeSwitchProps> = ({
  value,
  onChange,
  modes = ['list', 'cards'],
  className = '',
}) => (
  <div className={`app-segmented inline-flex items-center gap-1 p-1 ${className}`} aria-label="Modo de visualização">
    {modes.map((mode) => {
      const { label, icon: Icon } = modeMeta[mode];
      const active = value === mode;
      return (
        <button
          key={mode}
          type="button"
          aria-pressed={active}
          title={`Visualizar em ${label.toLowerCase()}`}
          onClick={() => onChange(mode)}
          className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors ${
            active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          }`}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      );
    })}
  </div>
);

export default ViewModeSwitch;
