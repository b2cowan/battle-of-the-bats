'use client';

import { useEffect } from 'react';
import { rememberRefTag } from '@/lib/ref-tag-client';

/** Reads `?ref=` once per page load and keeps it in this tab (lib/ref-tag-client.ts). Draws nothing. */
export default function RefTagCapture() {
  useEffect(() => {
    rememberRefTag(window.location.search);
  }, []);
  return null;
}
