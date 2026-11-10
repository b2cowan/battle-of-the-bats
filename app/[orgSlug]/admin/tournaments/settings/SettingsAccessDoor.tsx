'use client';
/**
 * `/tournaments/settings` — THE DOOR TO SETTINGS & ACCESS, NOT A PAGE (navigation Phase 2 Part B, E3 + P1, owner 2026-11-10).
 * A Tournament-plan organization's Settings & access is a place with tabs (Members · Payouts · PDF settings · Web address), so
 * its address goes to the first tab the person holds (`TabsDoor`, as a club's `/org` does). ⚰ The card page retired with it:
 * Staff & access is the Members tab, Web address its own tab (P1), Payouts its tab, and the event's "Notification preferences"
 * became the event sidebar's "Your notifications" (T2).
 */
import TabsDoor from '@/components/admin/kit/club/TabsDoor';
import { useTournamentSettingsTabs } from '@/components/admin/kit/useAdminKitNav';

export default function SettingsAccessDoor() {
  return <TabsDoor tabs={useTournamentSettingsTabs()} label="Loading Settings & access…" />;
}
