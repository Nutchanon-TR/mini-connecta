import type { Metadata } from 'next';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { CharacterForm } from '@/features/avatar/CharacterForm';

export const metadata: Metadata = { title: 'Create character' };

export default function CharacterPage() {
  return (
    <AuthLayout>
      <CharacterForm />
    </AuthLayout>
  );
}
