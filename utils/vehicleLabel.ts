const PLACEHOLDER_BRANDS = new Set(['a definir', 'a definir.', 'indefinido', 'n/a', 'na', '-', '—', '–', '']);
const PLACEHOLDER_MODELS = new Set([
  'cadastro rapido',
  'cadastro rápido',
  'cadastro-rapido',
  'a definir',
  'indefinido',
  'n/a',
  'na',
  '-',
  '—',
  '–',
  '',
]);

const clean = (value?: string | null) => String(value || '').trim();

const stripAccents = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const isPlaceholderBrand = (brand?: string | null) =>
  PLACEHOLDER_BRANDS.has(clean(brand).toLowerCase());

export const isPlaceholderModel = (model?: string | null) =>
  PLACEHOLDER_MODELS.has(stripAccents(clean(model).toLowerCase()));

export type VehicleLabelInput = {
  brand?: string | null;
  model?: string | null;
  plate?: string | null;
  year_fab?: string | null;
  year_model?: string | null;
  yearFab?: string | null;
  yearModel?: string | null;
};

/** Rótulo amigável: evita "A DEFINIR CADASTRO RÁPIDO - PLACA". */
export function formatVehicleLabel(vehicle?: VehicleLabelInput | null): string {
  if (!vehicle) return '—';

  const plate = clean(vehicle.plate).toUpperCase();
  const brand = isPlaceholderBrand(vehicle.brand) ? '' : clean(vehicle.brand).toUpperCase();
  let model = isPlaceholderModel(vehicle.model) ? '' : clean(vehicle.model).toUpperCase();
  // Se o "modelo" for so a placa, nao duplica
  if (model && plate && model === plate) model = '';
  const year = clean(vehicle.year_model || vehicle.yearModel || vehicle.year_fab || vehicle.yearFab);

  const name = [brand, model].filter(Boolean).join(' ').trim();
  if (name && plate) return year ? `${name} (${year}) — ${plate}` : `${name} — ${plate}`;
  if (name) return year ? `${name} (${year})` : name;
  if (plate) return plate;
  return '—';
}

/** Modelo curto para tabelas (sem placa). */
export function formatVehicleModelShort(vehicle?: VehicleLabelInput | null): string {
  if (!vehicle) return '—';
  const brand = isPlaceholderBrand(vehicle.brand) ? '' : clean(vehicle.brand).toUpperCase();
  let model = isPlaceholderModel(vehicle.model) ? '' : clean(vehicle.model).toUpperCase();
  const plate = clean(vehicle.plate).toUpperCase();
  if (model && plate && model === plate) model = '';
  const name = [brand, model].filter(Boolean).join(' ').trim();
  return name || 'Placa cadastrada';
}

export function formatDateTimeBr(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
