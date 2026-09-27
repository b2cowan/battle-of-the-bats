'use client';
import React from 'react';
import Link from 'next/link';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';

/**
 * Shown wherever a game would get a location while the tournament has ZERO configured
 * venues — the state that produced dev's silently-unchecked fixtures (Bye Demo's 21 and
 * Free Cup's 18 typed-only games). Instead of a silent text box, the organizer is asked
 * to set venues up; League/Club orgs are offered their org Venue Library first (owner
 * ruling 2026-08-08). Typing remains possible, behind a deliberate link.
 *
 * Wording rule (owner, 2026-08-08): this setup-level prompt says "venues" — the container
 * created on the Venues page — while the sport noun (diamond/court/rink) stays wherever a
 * game's actual playing surface is being picked.
 */
export default function ZeroVenuePrompt({
  orgSlug,
  hasOrgLibrary,
  onCreateVenue,
  onTypeAnyway,
}: {
  orgSlug: string;
  /** League/Club plans have the org venue library; Tournament tiers do not. */
  hasOrgLibrary: boolean;
  onCreateVenue?: () => void;
  /** When present, offers the explicit "type a location anyway" escape. */
  onTypeAnyway?: () => void;
}) {
  const kx = useKitStyle();
  return (
    <div style={kx({
      padding: '0.8rem 0.95rem',
      background: 'var(--primary-faint)',
      border: '1px solid var(--border)',
      borderRadius: '2px',
    }, {
      // Sibling setup nudges on this page (facilityResolveBanner) use the warning tint —
      // matching it here keeps every "you haven't set this up yet" banner one family.
      background: 'rgba(var(--warning-rgb), 0.08)',
      border: '1px solid rgba(var(--warning-rgb), 0.3)',
      borderRadius: '8px',
    })}>
      <p style={kx({ margin: 0, fontSize: '0.8rem', color: 'var(--white-80)', lineHeight: 1.5 }, KIT_INK.primary)}>
        <strong>No venues set up yet.</strong> Games without a real venue can’t be checked
        for double-bookings.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
        {hasOrgLibrary && (
          <Link
            href={`/${orgSlug}/admin/tournaments/venues?import=library`}
            className="btn btn-lime btn-data"
            style={{ textDecoration: 'none' }}
          >
            Import from your Venue Library
          </Link>
        )}
        {onCreateVenue ? (
          <button
            type="button"
            className={`btn btn-data ${hasOrgLibrary ? 'btn-ghost' : 'btn-lime'}`}
            onClick={onCreateVenue}
          >
            Create venues
          </button>
        ) : (
          <Link
            href={`/${orgSlug}/admin/tournaments/venues`}
            className={`btn btn-data ${hasOrgLibrary ? 'btn-ghost' : 'btn-lime'}`}
            style={{ textDecoration: 'none' }}
          >
            Create venues
          </Link>
        )}
      </div>
      {onTypeAnyway && (
        <p style={kx({ margin: '0.55rem 0 0', fontSize: '0.72rem', color: 'var(--white-40)' }, KIT_INK.tertiary)}>
          Or{' '}
          <button
            type="button"
            onClick={onTypeAnyway}
            style={kx({
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--info)', fontSize: 'inherit', textDecoration: 'underline',
            }, KIT_INK.info)}
          >
            type a location anyway
          </button>
          {' '}— it won’t be checked.
        </p>
      )}
    </div>
  );
}
