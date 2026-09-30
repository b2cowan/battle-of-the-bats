'use client';
import dynamic from 'next/dynamic';

// Organization settings on the kit (Club Tier Stage 1, with "Your public site"). The old page the dev switch
// kept went with Admin Design Continuity Part B (area 2, 2026-09-29). Its own chunk, as it always was (Part B
// area 1's rule).
const SettingsKit = dynamic(() => import('@/components/admin/kit/club/SettingsKit'));

export default function OrgSettingsPage() {
  return <SettingsKit />;
}
