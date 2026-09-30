'use client';
import dynamic from 'next/dynamic';

// The audit log on the kit (Club Tier Stage 1). The old page the dev switch kept went with Admin Design
// Continuity Part B (area 2, 2026-09-29). Its own chunk, as it always was (Part B area 1's rule).
const AuditLogKit = dynamic(() => import('@/components/admin/kit/club/AuditLogKit'));

export default function AuditLogPage() {
  return <AuditLogKit />;
}
