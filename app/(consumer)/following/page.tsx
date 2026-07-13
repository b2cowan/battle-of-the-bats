import type { Metadata } from 'next';
import FollowingList from '@/components/consumer/FollowingList';

// Device-specific content — not for indexing.
export const metadata: Metadata = {
  title: 'Following',
  robots: { index: false, follow: false },
};

export default function FollowingPage() {
  return <FollowingList />;
}
