import type { HelpPageContent, HelpSection } from './index';
import { resolveSectionId } from './index';
import tournamentsHelp from './tournaments';
import coachesHelp from './coaches';
import registrationsHelp from './registrations';
import repTeamsHelp from './rep-teams';
import accountingHelp from './accounting';
import orgHelp from './org';
import exportsHelp from './exports';
import houseLeagueHelp from './house-league';

/**
 * Central registry mapping a module key to its help content. There is no other
 * registry in the codebase — guide pages import their module directly — so this
 * is what lets the in-context help drawer look up "section X of module Y" by key.
 * Scoped to the customer-facing modules a work-page "?" can map to; the
 * platform-admin mirror is intentionally excluded (internal reference, not a
 * drawer target).
 */
export type HelpModuleKey =
  | 'tournaments'
  | 'coaches'
  | 'registrations'
  | 'rep-teams'
  | 'accounting'
  | 'org'
  | 'exports'
  | 'house-league';

export const helpModules: Record<HelpModuleKey, HelpPageContent> = {
  tournaments: tournamentsHelp,
  coaches: coachesHelp,
  registrations: registrationsHelp,
  'rep-teams': repTeamsHelp,
  accounting: accountingHelp,
  org: orgHelp,
  exports: exportsHelp,
  'house-league': houseLeagueHelp,
};

export interface ResolvedHelpSection {
  section: HelpSection;
  id: string;
}

/**
 * Look up specific sections from a module by their anchor ids, preserving the
 * requested order. Unknown ids are skipped (with a dev-only warning) rather than
 * thrown — a help lookup must never break the work page it sits on.
 */
export function getHelpSections(moduleKey: HelpModuleKey, ids: string[]): ResolvedHelpSection[] {
  const mod = helpModules[moduleKey];
  if (!mod) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[help] unknown help module "${moduleKey}"`);
    }
    return [];
  }

  const byId = new Map<string, ResolvedHelpSection>();
  mod.sections.forEach((section, index) => {
    const id = resolveSectionId(section, index);
    byId.set(id, { section, id });
  });

  return ids
    .map(id => {
      const found = byId.get(id);
      if (!found && process.env.NODE_ENV !== 'production') {
        console.warn(`[help] section "${id}" not found in module "${moduleKey}"`);
      }
      return found;
    })
    .filter((s): s is ResolvedHelpSection => Boolean(s));
}
