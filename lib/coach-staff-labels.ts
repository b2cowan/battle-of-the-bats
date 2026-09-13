/**
 * THE WORD FOR EACH GRANT — as the staff sheet labels it, so a server refusal ("You can’t hand out
 * Internal notes — you don’t hold it yourself.") names the control the coach is looking at. One
 * table, read by the sheet's control list AND by the staff routes; framework-free so a route can
 * import it without pulling a client component in.
 */
import type { AssistantCapabilityGrants } from './coach-capabilities';

export const GRANT_LABELS: Readonly<Record<keyof Required<AssistantCapabilityGrants>, string>> = {
  schedule: 'Schedule',
  scheduleManage: 'Schedule',
  attendance: 'Attendance',
  lineups: 'Lineups',
  development: 'Development',
  staffChat: 'Staff chat',
  scoutingBook: 'Scouting book',
  documents: 'Documents',
  money: 'Team money',
  rosterPii: 'Contacts & birthdates',
  notes: 'Internal notes',
  announcementsSend: 'Email families',
  tryouts: 'Tryouts',
  manageStaff: 'Manage staff',
};

export function grantLabel(key: keyof Required<AssistantCapabilityGrants>): string {
  return GRANT_LABELS[key];
}
