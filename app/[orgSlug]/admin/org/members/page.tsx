'use client';
import dynamic from 'next/dynamic';

// Members on the kit (Club Tier Stage 1). The old page the dev switch kept went with Admin Design Continuity
// Part B (area 2, 2026-09-29). Its own chunk, as it always was: a static import would move its sheets in the
// bundle (Part B area 1's rule).
const MembersKit = dynamic(() => import('@/components/admin/kit/club/MembersKit'));

export default function MembersPage() {
  return <MembersKit />;
}
