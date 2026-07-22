import { supabase } from './supabaseClient';

const BUCKET = 'event-attachments';

export interface EventAttachment {
  id?: string;
  event_id?: string;
  name: string;
  type: string;
  url: string;
  size?: string;
  file?: File;
  isNew?: boolean;
}

export function getAttachmentKind(mime: string, name: string) {
  const lower = name.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'word';
  return 'file';
}

export function normalizeAttachmentRow(row: any): EventAttachment {
  return {
    id: row.id,
    event_id: row.event_id,
    url: row.url || row.file_path || '',
    name: row.name || row.file_name || row.filename || 'Anexo',
    type: row.type || row.mime_type || row.file_type || 'file',
    size: row.size,
  };
}

export async function uploadEventAttachments(eventId: string, attachments: EventAttachment[]) {
  const saved: EventAttachment[] = [];

  for (const att of attachments) {
    if (!att.isNew || !att.file) {
      if (att.url && !att.isNew) saved.push(att);
      continue;
    }

    const safeName = att.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${eventId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, att.file, { upsert: false, contentType: att.file.type || undefined });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = publicData.publicUrl;

    const displayName = att.file.name || att.name || 'Anexo';
    const mimeType = att.file.type || getAttachmentKind('', displayName);

    const { data, error } = await supabase
      .from('event_attachments')
      .insert([{
        event_id: eventId,
        // Schema legado exige file_path NOT NULL (caminho no Storage).
        file_path: path,
        file_name: displayName,
        file_type: mimeType,
        url,
        name: displayName,
        type: mimeType,
        mime_type: mimeType,
      }])
      .select()
      .single();

    if (error) throw error;
    saved.push({ ...normalizeAttachmentRow(data), size: att.size });
  }

  return saved;
}

export async function deleteEventAttachment(id: string, url?: string) {
  // Recupera file_path se so tivermos a URL publica.
  let storagePath: string | undefined;
  if (url?.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    storagePath = decodeURIComponent(url.split(`/storage/v1/object/public/${BUCKET}/`)[1] || '');
  }

  const { data: row } = await supabase
    .from('event_attachments')
    .select('file_path, url')
    .eq('id', id)
    .maybeSingle();

  if (row?.file_path) storagePath = row.file_path;
  else if (!storagePath && row?.url?.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    storagePath = decodeURIComponent(row.url.split(`/storage/v1/object/public/${BUCKET}/`)[1] || '');
  }

  await supabase.from('event_attachments').delete().eq('id', id);
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }
}
