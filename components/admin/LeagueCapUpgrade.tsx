'use client';

import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { isEffectivelyGated } from '@/lib/plan-config';
import { fireLeagueEvent } from '@/lib/league-events-client';
import type { LeagueCapKind } from '@/lib/free-floor';

const CAP_TITLE: Record<LeagueCapKind, string> = {
  league_season: 'One season on your free plan',
  league_division: 'One division on your free plan',
  league_team: 'Up to 8 teams on your free plan',
};

const CAP_BODY: Record<LeagueCapKind, string> = {
  league_season: 'Your free League Starter includes one active season. League lets you run multiple seasons and age groups side by side.',
  league_division: 'Your free League Starter includes one division. Multiple divisions — each with its own schedule and standings — are part of League.',
  league_team: 'Your free League Starter includes up to 8 teams. Upgrade to League for unlimited teams.',
};

/**
 * Upgrade CTA shown when a free League Starter org hits a cap. League is early-access (and an
 * adjacent product, not an in-org self-serve checkout per the billing-shelf rule), so this captures
 * express-interest rather than opening a checkout. Gated on isEffectivelyGated('league') so the
 * label can be revisited if League ever becomes self-serve live.
 */
export function LeagueUpgradeCta({
  className,
  orgId,
  capHit,
}: {
  className?: string;
  /** Attribution for the upgrade_intent_clicked event (verified server-side). */
  orgId?: string | null;
  /** Which wall this CTA sits behind, for the event metadata. */
  capHit?: LeagueCapKind;
}) {
  const gated = isEffectivelyGated('league');
  return (
    <EarlyAccessModalTrigger
      className={className}
      initialPlanInterest={['league']}
      initialFeaturesInterested={['house_league', 'registration', 'public_site']}
      onClick={() => fireLeagueEvent('upgrade_intent_clicked', { orgId, metadata: { capHit, surface: 'league_cap' } })}
    >
      {gated ? 'Express interest in League →' : 'Upgrade to League →'}
    </EarlyAccessModalTrigger>
  );
}

/**
 * Modal shown when a free League Starter org hits a server-enforced cap (season / division / team).
 * Names the operation the operator hit + offers the upgrade CTA. z-index sits just below the
 * early-access overlay (1000) so that form layers on top when the CTA is clicked.
 */
export function LeagueCapUpgradeModal({ capHit, onClose, orgId }: { capHit: LeagueCapKind; onClose: () => void; orgId?: string | null }) {
  return (
    <div
      role="presentation"
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--bg-elevated, #14161b)',
          border: '1px solid var(--hairline, rgba(255,255,255,0.12))',
          borderRadius: 12,
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', margin: '0 0 0.6rem', color: 'var(--white, #fff)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          {CAP_TITLE[capHit]}
        </h2>
        <p style={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--data-gray)', margin: '0 0 1.25rem' }}>
          {CAP_BODY[capHit]}
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            Maybe later
          </button>
          <LeagueUpgradeCta className="btn btn-lime" orgId={orgId} capHit={capHit} />
        </div>
      </div>
    </div>
  );
}
