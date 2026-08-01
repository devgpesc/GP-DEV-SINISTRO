import { supabase } from './supabaseClient';
import {
  ATTACHMENT_BUCKET,
  EventAttachment,
  SIGNED_URL_TTL_SECONDS,
  validateEventAttachmentFile,
} from './attachmentService';

export const MAX_POSITIONING_ATTACHMENTS = 20;

export interface PositioningAttachment extends EventAttachment {
  positioning_id?: string;
}

const normalize = (row: any): PositioningAttachment => ({
  id: row.id,
  positioning_id: row.positioning_id,
  event_id: row.event_id,
  file_path: row.file_path || '',
  name: row.file_name || 'Anexo',
  type: row.mime_type || 'file',
  url: '',
  size: row.size,
});

export async function resolvePositioningAttachmentUrls(rows: any[]) {
  const attachments = rows.map(normalize);
  const paths = attachments.map((item) => item.file_path).filter(Boolean) as string[];
  if (!paths.length) return attachments;

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return attachments;

  const urls = new Map(data.map((item) => [item.path, item.signedUrl || '']));
  return attachments.map((item) => ({
    ...item,
    url: item.file_path ? urls.get(item.file_path) || '' : '',
  }));
}

export async function uploadPositioningAttachments(
  positioningId: string,
  eventId: string,
  attachments: PositioningAttachment[],
) {
  const newFiles = attachments.filter((item) => item.isNew && item.file);
  const { count, error: countError } = await supabase
    .from('vehicle_positioning_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('positioning_id', positioningId);
  if (countError) throw countError;
  if ((count || 0) + newFiles.length > MAX_POSITIONING_ATTACHMENTS) {
    throw new Error(`Cada posicionamento pode ter no máximo ${MAX_POSITIONING_ATTACHMENTS} anexos.`);
  }

  const saved: PositioningAttachment[] = [];
  const uploadedPaths: string[] = [];
  try {
    for (const attachment of newFiles) {
      const file = attachment.file as File;
      const { mimeType, extension } = await validateEventAttachmentFile(file);
      const path = `${eventId}/positioning/${positioningId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: mimeType,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const { data, error } = await supabase
        .from('vehicle_positioning_attachments')
        .insert({
          positioning_id: positioningId,
          event_id: eventId,
          file_path: path,
          file_name: file.name,
          mime_type: mimeType,
        })
        .select()
        .single();
      if (error) throw error;

      const { data: signed } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      saved.push({
        ...normalize(data),
        url: signed?.signedUrl || '',
        size: attachment.size,
      });
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase
        .from('vehicle_positioning_attachments')
        .delete()
        .eq('positioning_id', positioningId)
        .in('file_path', uploadedPaths);
      await supabase.storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
  return saved;
}

export async function deletePositioningAttachment(id: string) {
  const { data, error } = await supabase
    .from('vehicle_positioning_attachments')
    .select('file_path')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('vehicle_positioning_attachments')
    .delete()
    .eq('id', id);
  if (deleteError) throw deleteError;

  if (data.file_path) {
    const { error: storageError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([data.file_path]);
    if (storageError) throw storageError;
  }
}
