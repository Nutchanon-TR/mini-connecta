import Image from 'next/image';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { PreviewTheme } from '@/features/preview/PreviewTheme';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PreviewTheme defaultTheme="system">
      <div className="auth-layout">
        <aside className="auth-art" aria-label="Study Room">
          <div className="auth-art-inner">
            <h2>A room to study together</h2>
            <p>Find a desk or walk over to talk.</p>
            <Image
              src="/assets/library-art.webp"
              alt="Illustration of the Study Room"
              width={640}
              height={640}
              unoptimized
            />
          </div>
        </aside>
        <main className="auth-main">
          <div className="auth-content">
            <span className="brand"><BrandMark /> Mini Connecta</span>
            {children}
          </div>
        </main>
      </div>
    </PreviewTheme>
  );
}
