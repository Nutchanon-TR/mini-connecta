export const presets = {
  strawberry: { label: 'Strawberry', image: '/assets/strawberry.png' },
  matcha: { label: 'Matcha', image: '/assets/matcha.png' },
};

export type Preset = keyof typeof presets;
export type PreviewAvatar = { name: string; preset: Preset };
