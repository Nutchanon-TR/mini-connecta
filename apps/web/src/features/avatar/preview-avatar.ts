import { readPreview, writePreview } from '@/features/preview/browser-storage';
import type { PreviewAvatar } from './presets';

export const readPreviewAvatar = () => readPreview('profile');

export function parsePreviewAvatar(raw: string | null): PreviewAvatar | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || !('name' in data) || !('preset' in data)) {
      return null;
    }
    if (typeof data.name !== 'string' || !data.name.trim()) return null;
    if (data.preset !== 'strawberry' && data.preset !== 'matcha') return null;
    return { name: data.name.trim(), preset: data.preset };
  } catch {
    return null;
  }
}

export function savePreviewAvatar(avatar: PreviewAvatar) {
  return writePreview('profile', JSON.stringify(avatar));
}
