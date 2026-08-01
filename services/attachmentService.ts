import { supabase } from './supabaseClient';

export const ATTACHMENT_BUCKET = 'event-attachments';
export const SIGNED_URL_TTL_SECONDS = 10 * 60;
export const MAX_EVENT_ATTACHMENTS = 20;

type AllowedFileRule = {
  extension: string;
  maxBytes: number;
  signature: (bytes: Uint8Array) => boolean;
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

const allowedFiles: Record<string, AllowedFileRule> = {
  'image/jpeg': {
    extension: 'jpg',
    maxBytes: 10 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  'image/png': {
    extension: 'png',
    maxBytes: 10 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/webp': {
    extension: 'webp',
    maxBytes: 10 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  },
  'application/pdf': {
    extension: 'pdf',
    maxBytes: 15 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]),
  },
  'video/mp4': {
    extension: 'mp4',
    maxBytes: 25 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4),
  },
  'video/quicktime': {
    extension: 'mov',
    maxBytes: 25 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4),
  },
  'application/msword': {
    extension: 'doc',
    maxBytes: 15 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx',
    maxBytes: 15 * 1024 * 1024,
    signature: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
  },
};

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface EventAttachment {
  id?: string;
  event_id?: string;
  file_path?: string;
  name: string;
  type: string;
  url: string;
  size?: string;
  file?: File;
  isNew?: boolean;
}

const resolveMimeType = (file: File) => {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return allowedFiles[file.type] ? file.type : mimeByExtension[extension] || '';
};

export async function validateEventAttachmentFile(file: File) {
  const mimeType = resolveMimeType(file);
  const rule = allowedFiles[mimeType];
  if (!rule) {
    throw new Error(`Formato não permitido: ${file.name}. Use JPG, PNG, WEBP, PDF, MP4, MOV, DOC ou DOCX.`);
  }
  if (file.size <= 0 || file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / 1024 / 1024);
    throw new Error(`${file.name} excede o limite de ${maxMb} MB para esse formato.`);
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!rule.signature(bytes)) {
    throw new Error(`O conteúdo de ${file.name} não corresponde ao formato informado.`);
  }

  return { mimeType, extension: rule.extension };
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
    file_path: row.file_path || '',
    url: '',
    name: row.name || row.file_name || row.filename || 'Anexo',
    type: row.type || row.mime_type || row.file_type || 'file',
    size: row.size,
  };
}

export async function resolveAttachmentUrls(rows: any[]): Promise<EventAttachment[]> {
  const attachments = rows.map(normalizeAttachmentRow);
  const paths = attachments.map((attachment) => attachment.file_path).filter(Boolean) as string[];
  if (!paths.length) return attachments;

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return attachments;

  const signedByPath = new Map(data.map((item) => [item.path, item.signedUrl || '']));
  return attachments.map((attachment) => ({
    ...attachment,
    url: attachment.file_path ? signedByPath.get(attachment.file_path) || '' : '',
  }));
}

export async function uploadEventAttachments(eventId: string, attachments: EventAttachment[]) {
  if (attachments.length > MAX_EVENT_ATTACHMENTS) {
    throw new Error(`Cada sinistro pode ter no máximo ${MAX_EVENT_ATTACHMENTS} anexos.`);
  }

  const saved: EventAttachment[] = [];
  const uploadedPaths: string[] = [];
  try {
    for (const attachment of attachments) {
      if (!attachment.isNew || !attachment.file) {
        if (attachment.url && !attachment.isNew) saved.push(attachment);
        continue;
      }

      const { mimeType, extension } = await validateEventAttachmentFile(attachment.file);
      const path = `${eventId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, attachment.file, { upsert: false, contentType: mimeType, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const displayName = attachment.file.name || attachment.name || 'Anexo';
      const { data, error } = await supabase
        .from('event_attachments')
        .insert([{
          event_id: eventId,
          file_path: path,
          file_name: displayName,
          file_type: mimeType,
          name: displayName,
          type: mimeType,
          mime_type: mimeType,
        }])
        .select()
        .single();

      if (error) throw error;

      const { data: signed } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      saved.push({
        ...normalizeAttachmentRow(data),
        url: signed?.signedUrl || '',
        size: attachment.size,
      });
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.from('event_attachments').delete().eq('event_id', eventId).in('file_path', uploadedPaths);
      await supabase.storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  return saved;
}

export async function deleteEventAttachment(id: string) {
  const { data: row, error: rowError } = await supabase
    .from('event_attachments')
    .select('file_path')
    .eq('id', id)
    .maybeSingle();
  if (rowError) throw rowError;

  const { error: deleteError } = await supabase.from('event_attachments').delete().eq('id', id);
  if (deleteError) throw deleteError;

  if (row?.file_path) {
    const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.file_path]);
    if (storageError) throw storageError;
  }
}
