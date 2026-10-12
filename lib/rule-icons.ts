/**
 * THE RULES PAGE'S SECTION ICONS, DRAWN — one map for the public page (`components/public/RulesContent`) and the admin
 * that picks them (Rules & resources: each section's row, its Icon field, the samples). `RULE_ICONS` names them for the
 * organizer; this draws them.
 *
 * ⚠ Typed against that list, so an icon the admin offers cannot go undrawn for families. The public page used to keep a
 * four-entry map of its own and drew Information and Question mark as a Shield (found 2026-10-12, when the admin
 * started showing the icons).
 */
import { createElement } from 'react';
import { AlertCircle, BookOpen, CheckCircle, HelpCircle, Info, Shield, type LucideIcon, type LucideProps } from 'lucide-react';
import type { RULE_ICONS } from './tournament-settings-words';

export type RuleIconName = (typeof RULE_ICONS)[number]['value'];

const GLYPHS: Record<RuleIconName, LucideIcon> = { Shield, BookOpen, AlertCircle, CheckCircle, Info, HelpCircle };

/** A section's icon, drawn. Unset or unknown is the Shield every new section starts with. */
export function RuleIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  const glyph = name && Object.hasOwn(GLYPHS, name) ? GLYPHS[name as RuleIconName] : Shield;
  return createElement(glyph, props);
}
