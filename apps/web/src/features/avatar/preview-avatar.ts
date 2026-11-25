import type { components } from '@/lib/api.types';
import { readPreview, writePreview } from '@/features/preview/browser-storage';

type Avatar = components['schemas']['Avatar'];

const profileKey = () => (readPreview('signed-in') === 'guest' ? 'guest-profile' : 'profile');

export function readPreviewAvatar(): Avatar | null {
  const raw = readPreview(profileKey());
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('preset' in value)) return null;
    // The HTML preview stored the same value as name.
    const displayName =
      'displayName' in value ? value.displayName : 'name' in value ? value.name : null;
    if (typeof displayName !== 'string' || !displayName.trim()) return null;
    if (value.preset !== 'strawberry' && value.preset !== 'matcha') return null;
    return { displayName: displayName.trim(), preset: value.preset };
  } catch {
    return null;
  }
}

export function savePreviewAvatar(avatar: Avatar) {
  return writePreview(
    profileKey(),
    JSON.stringify({ name: avatar.displayName, preset: avatar.preset }),
  );
}
