import Image from 'next/image';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { PreviewTheme } from '@/features/preview/PreviewTheme';

export default function IndexPage() {
  return (
    <PreviewTheme defaultTheme="light">
      <div className="landing">
        <header className="landing-header">
          <nav className="landing-frame" aria-label="Main navigation">
            <Link className="brand" href="/" aria-label="Mini Connecta home">
              <BrandMark discover /> Mini Connecta
            </Link>
            <Link className="button secondary" href="/login">
              Sign in
            </Link>
          </nav>
        </header>
        <main>
          <section className="landing-frame landing-hero" aria-labelledby="landing-title">
            <div className="landing-copy">
              <h1 id="landing-title">
                Study together somewhere <em>cosy.</em>
              </h1>
              <p>Find a desk in the 3D Study Room, or walk over to talk with someone nearby.</p>
              <Link className="button primary" href="/discover">
                Explore the Study Room
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <Image
              className="landing-scene"
              src="/assets/library-art.webp"
              width={640}
              height={640}
              alt="Two characters studying together in a warm, book-lined library."
              preload
              unoptimized
            />
          </section>
          <section className="landing-notes" aria-label="In the Study Room">
            <ul className="landing-frame">
              <li>
                <strong>Find a quiet spot</strong>
                <span>Walk around the library with your character.</span>
              </li>
              <li>
                <strong>Walk over to talk</strong>
                <span>Voices get louder as you get closer.</span>
              </li>
              <li>
                <strong>Stay on mute</strong>
                <span>You can join and walk around with your mic off.</span>
              </li>
            </ul>
          </section>
        </main>
      </div>
    </PreviewTheme>
  );
}
