import { supabase } from './supabaseClient';
import { lookupService } from './lookupService';

export async function quickCreateAssociate(input: {
  name: string;
  document?: string;
  type?: 'PF' | 'PJ';
}) {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome do associado.');

  const docToUse = (input.document || '').replace(/\D/g, '');
  const type = input.type || (docToUse.length === 14 ? 'PJ' : 'PF');

  let resolvedName = name;
  if (type === 'PJ' && docToUse.length === 14) {
    const cnpjData = await lookupService.fetchCNPJ(docToUse);
    if (cnpjData?.name || cnpjData?.fantasy) {
      resolvedName = cnpjData.fantasy || cnpjData.name || name;
    }
  }

  const { data: existing } = docToUse
    ? await supabase.from('associates').select('id').eq('document', docToUse).maybeSingle()
    : { data: null };

  if (existing?.id) {
    await supabase.from('associates').update({ name: resolvedName, type }).eq('id', existing.id);
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
  brand?: string;
  model?: string;
}) {
  const cleanPlate = input.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanPlate.length < 7) throw new Error('Informe uma placa válida.');

  const { data: existing } = await supabase
    .from('vehicles')
    .select('id, associate_id')
    .eq('plate', cleanPlate)
    .maybeSingle();

  const brand = (input.brand || '').trim();
  const model = (input.model || '').trim();

  if (existing?.id) {
    if (existing.associate_id && existing.associate_id !== input.associateId) {
      throw new Error(`A placa ${cleanPlate} já está vinculada a outro associado.`);
    }
    const patch: Record<string, any> = { associate_id: input.associateId };
    if (brand) patch.brand = brand.toUpperCase();
    if (model) patch.model = model.toUpperCase();
    await supabase.from('vehicles').update(patch).eq('id', existing.id);
    return existing.id;
  }

  const currentYear = new Date().getFullYear().toString();
  const { data, error } = await supabase
    .from('vehicles')
    .insert([{
      plate: cleanPlate,
      associate_id: input.associateId,
      status: 'Ativo',
      brand: (brand || '—').toUpperCase(),
      model: (model || cleanPlate).toUpperCase(),
      color: 'BRANCA',
      fuel: 'FLEX',
      type: 'Automovel',
      year_fab: currentYear,
      year_model: currentYear,
      created_at: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
