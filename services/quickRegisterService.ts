import { supabase } from './supabaseClient';
import { isValidVehiclePlate, lookupService, normalizeVehiclePlate } from './lookupService';
import { Vehicle } from '../types';

const hasRepeatedDigits = (value: string) => /^(\d)\1+$/.test(value);

const isValidCpf = (value: string) => {
  if (value.length !== 11 || hasRepeatedDigits(value)) return false;
  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10]);
};

const isValidCnpj = (value: string) => {
  if (value.length !== 14 || hasRepeatedDigits(value)) return false;
  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(`${value.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(value[12]) && second === Number(value[13]);
};

export const normalizeOptionalDocument = (document?: string) => {
  const digits = (document || '').replace(/\D/g, '');
  if (!digits) return null;
  if (!isValidCpf(digits) && !isValidCnpj(digits)) {
    throw new Error('Informe um CPF ou CNPJ válido, ou deixe o campo em branco.');
  }
  return digits;
};

export async function quickCreateAssociate(input: {
  name: string;
  document?: string;
  type?: 'PF' | 'PJ';
}) {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome do associado.');

  const docToUse = normalizeOptionalDocument(input.document);
  const type = input.type || (docToUse?.length === 14 ? 'PJ' : 'PF');

  let resolvedName = name;
  if (type === 'PJ' && docToUse?.length === 14) {
    const cnpjData = await lookupService.fetchCNPJ(docToUse);
    if (cnpjData?.name || cnpjData?.fantasy) {
      resolvedName = cnpjData.fantasy || cnpjData.name || name;
    }
  }

  const { data: existing } = docToUse
    ? await supabase.from('associates').select('id').eq('document', docToUse).maybeSingle()
    : { data: null };

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('associates')
    .insert([{ name: resolvedName, document: docToUse, type, created_at: new Date().toISOString() }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function quickCreateVehicle(input: {
  plate: string;
  associateId: string;
  vehicleData?: Partial<Vehicle>;
}) {
  const cleanPlate = normalizeVehiclePlate(input.plate);
  if (!isValidVehiclePlate(cleanPlate)) throw new Error('Informe uma placa brasileira válida.');

  const { data: existing } = await supabase
    .from('vehicles')
    .select('*')
    .eq('plate', cleanPlate)
    .maybeSingle();

  if (existing?.id) {
    if (existing.associate_id && existing.associate_id !== input.associateId) {
      throw new Error(`A placa ${cleanPlate} já está vinculada a outro associado.`);
    }
    if (!existing.brand || !existing.model) {
      const suppliedPlate = normalizeVehiclePlate(String(input.vehicleData?.plate || ''));
      const lookedUp = suppliedPlate === cleanPlate
        ? input.vehicleData as Partial<Vehicle>
        : await lookupService.fetchPlate(cleanPlate);
      await supabase.from('vehicles').update(vehicleLookupPayload(lookedUp, cleanPlate, input.associateId)).eq('id', existing.id);
    } else if (!existing.associate_id) {
      await supabase.from('vehicles').update({ associate_id: input.associateId }).eq('id', existing.id);
    }
    return existing.id;
  }

  const suppliedPlate = normalizeVehiclePlate(String(input.vehicleData?.plate || ''));
  const lookedUp = suppliedPlate === cleanPlate
    ? input.vehicleData as Partial<Vehicle>
    : await lookupService.fetchPlate(cleanPlate);
  const { data, error } = await supabase
    .from('vehicles')
    .insert([{ ...vehicleLookupPayload(lookedUp, cleanPlate, input.associateId), created_at: new Date().toISOString() }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

function vehicleLookupPayload(vehicle: Partial<Vehicle>, plate: string, associateId: string) {
  const returnedPlate = normalizeVehiclePlate(String(vehicle.plate || ''));
  if (returnedPlate !== plate || !vehicle.brand || !vehicle.model) {
    throw new Error('A consulta não retornou dados confiáveis para a placa informada.');
  }
  return {
    plate,
    associate_id: associateId,
    status: 'Ativo',
    brand: String(vehicle.brand).trim().toUpperCase(),
    model: String(vehicle.model).trim().toUpperCase(),
    version: String(vehicle.version || '').trim().toUpperCase() || null,
    year_fab: String(vehicle.year_fab || '').trim() || null,
    year_model: String(vehicle.year_model || '').trim() || null,
    color: String(vehicle.color || '').trim().toUpperCase() || null,
    fuel: String(vehicle.fuel || '').trim() || null,
    type: String(vehicle.type || '').trim() || null,
    chassi: String(vehicle.chassi || '').trim().toUpperCase() || null,
    renavam: String(vehicle.renavam || '').trim() || null,
    uf: String(vehicle.uf || '').trim().toUpperCase() || null,
    city: String(vehicle.city || '').trim().toUpperCase() || null,
  };
}
