import type { Metadata } from 'next';
import { Discover } from '@/features/discover/Discover';

export const metadata: Metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return <Discover />;
}
