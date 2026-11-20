import type { Metadata } from 'next';
import { StudyRoom } from '@/features/room/StudyRoom';

export const metadata: Metadata = { title: 'Study Room' };

export default function StudyRoomPage() {
  return <StudyRoom />;
}
