import path from 'node:path';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

const INLINE_PREVIEW_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export function inferAttachmentMimeType(filename: string, declaredMimeType?: string | null): string {
  const declared = declaredMimeType?.trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') return declared;
  return MIME_BY_EXTENSION[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

export function isInlinePreviewMimeType(mimeType: string): boolean {
  return INLINE_PREVIEW_MIME_TYPES.has(mimeType.toLowerCase());
}

export function previewResponseMimeType(mimeType: string): string {
  if (mimeType === 'application/json' || mimeType === 'text/csv') {
    return 'text/plain; charset=utf-8';
  }
  if (mimeType.startsWith('text/')) return `${mimeType}; charset=utf-8`;
  return mimeType;
}
