import type { components } from '@/lib/api.types';

export type Preset = components['schemas']['AvatarPreset'];

export const presets = {
  strawberry: { label: 'Strawberry', image: '/assets/strawberry.png' },
  matcha: { label: 'Matcha', image: '/assets/matcha.png' },
} satisfies Record<Preset, { label: string; image: string }>;
