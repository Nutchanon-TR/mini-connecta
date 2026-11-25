import type { Metadata } from 'next';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { CharacterForm } from '@/features/avatar/CharacterForm';

export const metadata: Metadata = { title: 'Edit character' };

export default function EditCharacterPage() {
  return (
    <AuthLayout>
      <CharacterForm editing />
    </AuthLayout>
  );
}
