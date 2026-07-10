'use client';
/**
 * components/ViewportKeyboardVars.tsx
 *
 * Mounts the visual-viewport tracking hook app-wide. Renders nothing; side-effect only.
 */

import { useVisualViewportVars } from '@/lib/use-visual-viewport-vars';

export default function ViewportKeyboardVars() {
  useVisualViewportVars();
  return null;
}
