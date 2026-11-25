import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { PreviewTheme } from '@/features/preview/PreviewTheme';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PreviewTheme defaultTheme="light">
      <div className="auth-layout">
        <aside className="auth-art" aria-label="Study Room">
          <Image
            className="auth-scene"
            src="/assets/library-art.webp"
            alt=""
            width={640}
            height={640}
            unoptimized
          />
          <div className="auth-art-inner">
            <h2>
              Pick a spot in the <em>Library.</em>
            </h2>
            <p>Find a desk or walk over to talk.</p>
          </div>
        </aside>
        <main className="auth-main">
          <div className="auth-content">
            <Link href="/" className="brand" aria-label="Mini Connecta home">
              <BrandMark discover /> Mini Connecta
            </Link>
            {children}
          </div>
        </main>
      </div>
    </PreviewTheme>
  );
}
