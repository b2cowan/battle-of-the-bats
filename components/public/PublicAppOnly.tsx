'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import parts from './PublicParts.module.css';

const query = '(display-mode: standalone)';
function subscribe(change: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}
const installed = () => window.matchMedia(query).matches;
const server = () => false;

/** Frame-only mounts: a hidden browser surface must not fetch legacy follow data or open a portal. */
export default function PublicAppOnly({ children }: { children: ReactNode }) {
  const active = useSyncExternalStore(subscribe, installed, server);
  return <div className={parts.appOnly}>{active ? children : null}</div>;
}
