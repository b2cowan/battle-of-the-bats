'use client';
/**
 * `/org` — THE DOOR TO ORGANIZATION, NOT A PAGE (⚖ Club Tier Stage 13i, A5 — Ask 3 = A, owner 2026-11-06).
 *
 * ⚰ The tile hub retired: Organization is a place with tabs (`OrgFrame`), so its address goes to the FIRST tab the person
 * holds — a replace, so Back does not return here. One tab is that page with no tab row (13a's one-door rule); none is the ONE
 * "not yours" screen. Tournaments, My Coaches Portal and Plan & billing, which the hub also tiled, are reached from the
 * sidebar (a program row, the foot's doors). The board by name (13a R1) is the "The board" tab of anyone without Members.
 */
import TabsDoor from '@/components/admin/kit/club/TabsDoor';
import { useOrgTabs } from '@/components/admin/kit/useAdminKitNav';

export default function OrgDoor() {
  return <TabsDoor tabs={useOrgTabs().tabs} label="Loading the organization…" />;
}
