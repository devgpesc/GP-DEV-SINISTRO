export type TypographyPresetId = 'inter' | 'source-sans' | 'eb-garamond' | 'cormorant-garamond';

export interface TypographyPreset {
  id: TypographyPresetId;
  name: string;
  description: string;
  sampleClassName: string;
}

export const TYPOGRAPHY_STORAGE_KEY = 'eventscar:typography-preset';
export const DEFAULT_TYPOGRAPHY_PRESET: TypographyPresetId = 'inter';

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'inter',
    name: 'Inter',
    description: 'Interface uniforme e muito legivel',
    sampleClassName: 'font-preview-inter',
  },
  {
    id: 'eb-garamond',
    name: 'Inter + EB Garamond',
    description: 'Titulos editoriais, interface objetiva',
    sampleClassName: 'font-preview-eb-garamond',
  },
  {
    id: 'cormorant-garamond',
    name: 'Inter + Cormorant',
    description: 'Titulos marcantes e mais sofisticados',
    sampleClassName: 'font-preview-cormorant-garamond',
  },
  {
    id: 'source-sans',
    name: 'Source Sans 3',
    description: 'Tipografia anterior do sistema',
    sampleClassName: 'font-preview-source-sans',
  },
];

export const isTypographyPreset = (value: string | null): value is TypographyPresetId =>
  TYPOGRAPHY_PRESETS.some((preset) => preset.id === value);

export const getStoredTypographyPreset = (): TypographyPresetId => {
  if (typeof window === 'undefined') return DEFAULT_TYPOGRAPHY_PRESET;
  const storedPreset = window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
  return isTypographyPreset(storedPreset) ? storedPreset : DEFAULT_TYPOGRAPHY_PRESET;
};

export const applyTypographyPreset = (preset: TypographyPresetId) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.fontPreset = preset;
};

export const storeTypographyPreset = (preset: TypographyPresetId) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, preset);
  }
  applyTypographyPreset(preset);
};
