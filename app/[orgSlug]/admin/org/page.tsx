'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users2, RefreshCw, MapPin, CreditCard, Settings, FileText, UserCheck, ScrollText, Users, type LucideIcon } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { orgHubDoors } from '@/lib/admin-kit-nav';
import { boardLine } from '@/lib/board-people';
import { useAdminKitNav } from '@/components/admin/kit/useAdminKitNav';
import { NotYours } from '@/components/admin/kit/club/NotYours';
import { useBoardPeople } from '@/lib/use-board-people';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import LoadingState from '@/components/shared/LoadingState';

const ICONS: Record<string, LucideIcon> = {
  'org/members': Users2, tournaments: RefreshCw, 'org/venues': MapPin, 'org/pdf': FileText, coaches: UserCheck,
  'org/billing': CreditCard, 'org/settings': Settings, 'org/audit': ScrollText,
};

/**
 * THE ORGANIZATION HUB — ⚖ Club Tier Stage 13a, Ask 7 = A (owner 2026-11-06; drawing: Stage 13 hub, tab 15).
 *
 * ONE LIST OF DOORS PER PERSON: the tiles are `orgHubDoors` (lib/admin-kit-nav.ts) — the rail's own Organization doors
 * plus Tournaments, Plan & billing and the person's Coaches Portal, each only where it opens. A registrar is no longer
 * offered a Members tile that refuses them, nor a Tournaments tile into a tournament admin of failing pages (F-NAV-7/8).
 *
 * ⚖ THE BOARD BY NAME (ALSO row R1, "names only"): a person who has no Members door sees who runs the club, read-only —
 * names and roles, never an email — so "who creates the season?" has an answer.
 *
 * A person left with ONE door goes straight to it (a replace, so Back does not return here; no door leads back to this
 * hub, so there is no loop). A person with none sees the ONE "not yours" screen. Locked tiles are never added here.
 */
export default function OrgAdminHub() {
  const router = useRouter();
  const { currentOrg, userRole, loading } = useOrg();
  const nav = useAdminKitNav();
  // Rep-only here: the "My Coaches Portal" tile opens the paid team workspace assigned to the
  // admin in THIS org, so it gates on rep access (not the free-coach signal the shell doors use).
  const ownerOrAdmin = userRole === 'owner' || userRole === 'admin';

  const doors = orgHubDoors({
    base: nav.base,
    orgLinks: nav.orgLinks,
    billingLink: nav.billingLink,
    canOpenTournaments: nav.canUse('module_tournaments'),
    coachPortalHref: ownerOrAdmin && nav.hasRepAccess ? `/${currentOrg?.slug ?? ''}/coaches` : null,
  });
  const showsBoard = !!userRole && userRole !== 'owner' && !doors.some(d => d.key === 'org/members') && !isTeamWorkspaceOrg(currentOrg);
  const people = useBoardPeople(showsBoard);
  const ready = !loading && !!userRole && !!currentOrg;
  const onlyDoor = ready && doors.length === 1 && !showsBoard ? doors[0].href : null;

  useEffect(() => {
    if (onlyDoor) router.replace(onlyDoor);
  }, [onlyDoor, router]);

  if (!ready || onlyDoor) return <LoadingState label="Loading the organization…" />;
  if (!doors.length && !showsBoard) return <NotYours page="organization" />;

  return (
    // The portal's reading column (960px), centred, like every club page (owner 2026-10-07; see ClubKit.module.css).
    <div className="p-8 max-w-[960px] mx-auto">
      <AdminPageHeader
        eyebrow="Organization"
        title={currentOrg?.name ?? 'Organization Admin'}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {doors.map(({ key, label, desc, href }) => {
          const Icon = ICONS[key] ?? Users2;
          return (
            <Link
              key={key}
              href={href}
              className="card p-6 flex gap-4 items-start hover:border-blueprint-blue transition-colors"
            >
              <div className="text-blueprint-blue mt-0.5">
                <Icon size={28} />
              </div>
              <div>
                <div className="font-bold text-fl-text text-base">{label}</div>
                <div className="text-data-gray text-sm mt-1">{desc}</div>
              </div>
            </Link>
          );
        })}
        {showsBoard && (
          <div className="card p-6 flex gap-4 items-start" data-org-board>
            <div className="text-blueprint-blue mt-0.5">
              <Users size={28} aria-hidden />
            </div>
            <div>
              <div className="font-bold text-fl-text text-base">The board</div>
              <div className="text-data-gray text-sm mt-1">
                {people === null ? 'Who runs what…' : people.length ? `Who runs what: ${boardLine(people)}` : 'Who runs what: the club’s owner and its admins'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
