import type { Metadata } from 'next';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { SignIn } from '@/features/auth/SignIn';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthLayout>
      <SignIn />
    </AuthLayout>
  );
}
