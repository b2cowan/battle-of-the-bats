'use client';
import { MapPin, ExternalLink } from 'lucide-react';
import { Diamond } from '@/lib/types';

interface Props {
  /** Display name / field name */
  location: string;
  /** Optional matched Diamond record (provides address for Maps link) */
  diamond?: Diamond | null;
  /** Visual size — 'sm' for tables, default for cards */
  size?: 'sm' | 'default';
}

export function getMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function LocationLink({ location, diamond, size = 'default' }: Props) {
  const address = diamond?.address;
  const mapsUrl  = address ? getMapsUrl(address) : getMapsUrl(location);
  const label    = location || diamond?.name || 'Location';

  const fontSize  = size === 'sm' ? '0.8rem'     : '0.85rem';
  const gap       = size === 'sm' ? '0.3rem'     : '0.35rem';
  const iconSize  = size === 'sm' ? 11            : 13;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={address ? `Open ${label} in Google Maps` : `Search "${label}" in Google Maps`}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap,
        fontSize,
        color:      'var(--purple-light)',
        fontWeight: 500,
        transition: 'var(--transition)',
        textDecoration: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <MapPin size={iconSize} style={{ flexShrink: 0 }} />
      {label}
      <ExternalLink size={iconSize - 2} style={{ flexShrink: 0, opacity: 0.6 }} />
    </a>
  );
}
